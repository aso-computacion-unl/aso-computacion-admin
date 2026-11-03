import type { Role } from "@/domain/user";

import type { AuditActorKind, AuditLogReader } from "../ports/auth.ports";

export const PREVIEW_CODE_ACTION = "preview.token_create";
export const PREVIEW_CODES_LIMIT = 10;

/** Who is looking: the role and account of the session, as the guard resolved them. */
export interface PreviewCodeViewer {
  role: Role;
  /** Null for the emergency login, which is a synthetic Admin. */
  userId: string | null;
}

/**
 * One generation of a preview code. The code itself is stateless and is never stored or audited,
 * so a row says only when, by whom and for how long: there is nothing here that could open the preview.
 */
export interface PreviewCodeRow {
  id: string;
  at: Date;
  actorKind: AuditActorKind;
  actorUserId: string | null;
  /** The lifetime key the action recorded (`1h`, `24h`, `7d`); null on entries written before it was recorded. */
  lifetimeHint: string | null;
  /** The fallback for those older entries: it names the lifetime in words. */
  summary: string;
}

/**
 * The recent preview-code generations, newest first. An Admin sees every one; an Editor only their own,
 * because who handed a code to whom is not theirs to read. The scope is applied twice, in the query and
 * on the rows that come back, so a reader that ignored the filter would still not leak another user's row.
 */
export class ListPreviewCodesUseCase {
  constructor(private readonly reader: AuditLogReader) {}

  async execute(viewer: PreviewCodeViewer): Promise<PreviewCodeRow[]> {
    const ownOnly = viewer.role !== "ADMIN";

    if (ownOnly && !viewer.userId) return [];

    const { items } = await this.reader.list({
      entityType: "preview",
      ...(ownOnly && viewer.userId ? { actor: viewer.userId } : {}),
      page: 1,
      pageSize: PREVIEW_CODES_LIMIT,
    });

    return items
      .filter((entry) => entry.action === PREVIEW_CODE_ACTION)
      .filter((entry) => !ownOnly || (entry.actorKind === "user" && entry.actorUserId === viewer.userId))
      .map((entry) => ({
        id: entry.id,
        at: entry.at,
        actorKind: entry.actorKind,
        actorUserId: entry.actorUserId,
        lifetimeHint: entry.entityId,
        summary: entry.summary,
      }));
  }
}
