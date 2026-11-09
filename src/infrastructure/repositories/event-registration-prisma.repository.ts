import "server-only";
import type { EventRegistration as PrismaEventRegistration } from "@/generated/prisma/client";

import type { Prisma } from "@/generated/prisma/client";
import type {
  CancelOutcome,
  CancelTarget,
  ConfirmOutcome,
  EventRegistrationRecord,
  EventRegistrationRepository,
  NewEventRegistration,
  RegisterOutcome,
} from "@/application/ports/event-registration-repository.port";
import { cancellationRefusal, isConfirmationExpired, registrationRefusal, type RegistrationMode } from "@/domain/event-registration";

import { prisma } from "../prisma/client";
import { toDomain } from "./event.mapper";

function toRecord(row: PrismaEventRegistration): EventRegistrationRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    mode: row.mode === "unl" ? "unl" : "open",
    name: row.name,
    email: row.email,
    institution: row.institution,
    career: row.career,
    semester: row.semester,
    createdAt: row.createdAt,
    confirmedAt: row.confirmedAt,
    reminderSentAt: row.reminderSentAt,
  };
}

/** A pending row takes no seat and is nobody's business but its own confirmation link. */
const CONFIRMED = { confirmedAt: { not: null } } satisfies Prisma.EventRegistrationWhereInput;

type Tx = Prisma.TransactionClient;

/** Locks the live event row for the rest of the transaction: every seat decision of one event runs one at a time. */
async function lockEvent(tx: Tx, eventId: string) {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Event" WHERE "id" = ${eventId} AND "deletedAt" IS NULL FOR UPDATE
  `;

  return locked.length === 0 ? null : toDomain(await tx.event.findUniqueOrThrow({ where: { id: eventId } })).props;
}

function seatRefusal(tx: Tx, event: NonNullable<Awaited<ReturnType<typeof lockEvent>>>, mode: RegistrationMode, alreadyRegistered: boolean, now: Date) {
  return tx.eventRegistration
    .count({ where: { eventId: event.id, ...CONFIRMED } })
    .then((registered) => registrationRefusal({ event, mode, registered, alreadyRegistered, now }));
}

export class EventRegistrationPrismaRepository implements EventRegistrationRepository {
  /**
   * Locks the event row, reads its CURRENT settings and count, and stores the row only if the shared rule
   * accepts it. The lock serializes every registration of one event, so the last seat goes to one person
   * and a repeated email is seen before it is inserted; other events are not slowed down.
   */
  async register(input: NewEventRegistration, now: Date): Promise<RegisterOutcome> {
    return prisma.$transaction(async (tx) => {
      const event = await lockEvent(tx, input.eventId);

      if (!event) {
        return { status: "not_found" } as const;
      }

      const existing = await tx.eventRegistration.findUnique({
        where: { eventId_email: { eventId: input.eventId, email: input.email } },
        select: { id: true, confirmedAt: true },
      });
      const refusal = await seatRefusal(tx, event, input.mode, existing?.confirmedAt != null, now);

      if (refusal) {
        return { status: refusal } as const;
      }

      const data = {
        mode: input.mode,
        name: input.name,
        institution: input.institution,
        career: input.career,
        semester: input.semester,
        createdAt: now,
        confirmedAt: input.confirmedAt,
        // A new attempt retires the link of the previous one.
        confirmNonce: input.confirmNonce ?? null,
      };
      // Still pending: the same person asked again, so the row is refreshed (same id) rather than refused.
      const row = existing
        ? await tx.eventRegistration.update({ where: { id: existing.id }, data })
        : await tx.eventRegistration.create({ data: { id: input.id, eventId: input.eventId, email: input.email, ...data } });

      return { status: "registered", registration: toRecord(row) } as const;
    });
  }

  /** Same lock and rule as `register`: two pending people racing for the last seat cannot both confirm it. */
  async confirm(eventId: string, id: string, now: Date, nonce: string | null = null): Promise<ConfirmOutcome> {
    return prisma.$transaction(async (tx) => {
      const event = await lockEvent(tx, eventId);

      // A trashed or missing event has no link that confirms anything.
      const row = event ? await tx.eventRegistration.findFirst({ where: { id, eventId } }) : null;

      // The link must be the one of the row's latest attempt: an older email's link finds nothing, confirmed row or not.
      if (!event || !row || row.confirmNonce !== nonce) {
        return { status: "invalid" } as const;
      }

      if (row.confirmedAt) {
        return { status: "already_confirmed", registration: toRecord(row) } as const;
      }

      if (isConfirmationExpired(row.createdAt, now)) {
        return { status: "expired" } as const;
      }

      const refusal = await seatRefusal(tx, event, toRecord(row).mode, false, now);

      if (refusal) {
        return { status: refusal as Exclude<typeof refusal, "duplicate"> };
      }

      return { status: "confirmed", registration: toRecord(await tx.eventRegistration.update({ where: { id }, data: { confirmedAt: now } })) } as const;
    });
  }

  /** Same lock as `register` and `confirm`: the delete and the seat count of whoever registers next are one order, never interleaved. */
  async cancel(eventId: string, who: CancelTarget, now: Date): Promise<CancelOutcome> {
    return prisma.$transaction(async (tx) => {
      const event = await lockEvent(tx, eventId);

      if (!event) {
        return { status: "not_found" } as const;
      }

      const refusal = cancellationRefusal({ event, now });

      if (refusal) {
        return { status: refusal } as const;
      }

      const { count } = await tx.eventRegistration.deleteMany({ where: { eventId, ...("id" in who ? { id: who.id } : { email: who.email }) } });

      return { status: count > 0 ? "cancelled" : "not_registered" } as const;
    });
  }

  async list(eventId: string): Promise<EventRegistrationRecord[]> {
    const rows = await prisma.eventRegistration.findMany({ where: { eventId, ...CONFIRMED }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });

    return rows.map(toRecord);
  }

  async count(eventId: string): Promise<number> {
    return prisma.eventRegistration.count({ where: { eventId, ...CONFIRMED } });
  }

  async countByEvents(eventIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    if (eventIds.length === 0) return new Map();

    const groups = await prisma.eventRegistration.groupBy({ by: ["eventId"], where: { eventId: { in: [...eventIds] }, ...CONFIRMED }, _count: { _all: true } });

    return new Map(groups.map((group) => [group.eventId, group._count._all]));
  }

  async exists(eventId: string, email: string): Promise<boolean> {
    return (await prisma.eventRegistration.findFirst({ where: { eventId, email, ...CONFIRMED }, select: { id: true } })) !== null;
  }

  async listDueForReminder(eventId: string, limit: number): Promise<EventRegistrationRecord[]> {
    if (limit < 1) return [];

    const rows = await prisma.eventRegistration.findMany({ where: { eventId, ...CONFIRMED, reminderSentAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit });

    return rows.map(toRecord);
  }

  async markReminderSent(eventId: string, id: string, at: Date): Promise<boolean> {
    // One conditional statement: of two runs racing for the same person only one changes the row.
    const { count } = await prisma.eventRegistration.updateMany({ where: { id, eventId, ...CONFIRMED, reminderSentAt: null }, data: { reminderSentAt: at } });

    return count === 1;
  }

  async delete(eventId: string, id: string): Promise<boolean> {
    const { count } = await prisma.eventRegistration.deleteMany({ where: { id, eventId } });

    return count > 0;
  }
}
