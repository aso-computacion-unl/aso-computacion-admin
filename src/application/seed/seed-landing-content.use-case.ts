import { assertBoardMemberPhotoAlt, BoardMember } from "@/domain/board-member";
import { Event } from "@/domain/event";
import { Faq } from "@/domain/faq";
import { assertImageMimeType, assertImageMinWidth, assertImageSize } from "@/domain/image";
import { assertPillarImageAlt, Pillar } from "@/domain/pillar";
import { SiteSettings } from "@/domain/site-settings";
import { SocialLink } from "@/domain/social-link";

import { toBoardMemberResult } from "../mappers/board-member-result.mapper";
import type { ImageUploadFile, MediaStoragePort } from "../ports/media-storage.port";
import type { EventRepository } from "../ports/event-repository.port";
import type { OrderedContentRepository } from "../ports/ordered-content-repository.port";
import type { SiteSettingsRepository } from "../ports/site-settings-repository.port";
import { CreateBoardMemberUseCase } from "../use-cases/create-board-member.use-case";
import { CreateEventUseCase } from "../use-cases/create-event.use-case";
import { CreateFaqUseCase } from "../use-cases/create-faq.use-case";
import { CreatePillarUseCase } from "../use-cases/create-pillar.use-case";
import { CreateSocialLinkUseCase } from "../use-cases/create-social-link.use-case";
import { SetOrderedContentPublishedUseCase } from "../use-cases/ordered-content.use-cases";
import { PurgeBoardMemberUseCase, PurgePillarUseCase } from "../use-cases/purge-content.use-case";
import { BOARD_PHOTO_MIN_WIDTH, SetBoardMemberPhotoUseCase } from "../use-cases/set-board-member-photo.use-case";
import { PILLAR_IMAGE_MIN_WIDTH, SetPillarImageUseCase } from "../use-cases/set-pillar-image.use-case";
import { TrashContentUseCase } from "../use-cases/trash-content.use-case";
import { UpdateSiteSettingsUseCase } from "../use-cases/update-site-settings.use-case";
import { UploadImageUseCase } from "../use-cases/upload-image.use-case";
import {
  type LandingSeedContent,
  type LandingSeedImage,
  normalizeSeedKey,
  socialSeedKey,
} from "./landing-seed-content";

export type SeedEntity = "settings" | "event" | "faq" | "pillar" | "social" | "board";

/** Order in which entities are seeded and reports list them: `buildSteps` pushes them in this order. */
export const SEED_ENTITIES: readonly SeedEntity[] = ["settings", "event", "faq", "pillar", "social", "board"];

export interface SeedPlanItem {
  entity: SeedEntity;
  /** The stable key the item is matched on across runs. */
  key: string;
  /** What a human recognises it by. */
  label: string;
  action: "create" | "skip";
  /** Why it is skipped. */
  reason?: string;
  /** True when it is created visible on the landing. */
  publish: boolean;
  image?: { path: string; width: number };
}

export interface SeedProblem {
  entity: SeedEntity;
  key: string;
  message: string;
}

export interface SeedPlan {
  items: SeedPlanItem[];
  warnings: string[];
  /** Anything that would make `apply` fail. A plan with problems is never applied. */
  problems: SeedProblem[];
}

export interface SeedResultItem extends SeedPlanItem {
  outcome: "created" | "skipped" | "failed";
  error?: string;
}

export interface SeedResult {
  /** The items attempted; after a failure the run stops, so later items are absent. */
  items: SeedResultItem[];
  warnings: string[];
  failed: boolean;
}

/** The normalised stable keys already stored, per entity. */
export interface SeedExistingKeys {
  eventSlugs: ReadonlySet<string>;
  faqs: ReadonlySet<string>;
  pillars: ReadonlySet<string>;
  socials: ReadonlySet<string>;
  board: ReadonlySet<string>;
  settings: boolean;
}

export function emptyExistingKeys(): SeedExistingKeys {
  return { eventSlugs: new Set(), faqs: new Set(), pillars: new Set(), socials: new Set(), board: new Set(), settings: false };
}

export interface SeedDependencies {
  events: EventRepository;
  faqs: OrderedContentRepository<Faq>;
  pillars: OrderedContentRepository<Pillar>;
  socials: OrderedContentRepository<SocialLink>;
  board: OrderedContentRepository<BoardMember>;
  settings: SiteSettingsRepository;
  storage: MediaStoragePort;
  /** Reads a local image by the path the content gives it (e.g. `/src/assets/team/ana.jpg`). */
  readImage: (path: string) => Promise<ImageUploadFile>;
}

export class SeedPlanInvalidError extends Error {
  constructor(readonly problems: readonly SeedProblem[]) {
    super(`The seed plan has ${problems.length} problem(s); nothing was written:\n${problems.map((p) => `  - ${p.entity} "${p.key}": ${p.message}`).join("\n")}`);
    this.name = "SeedPlanInvalidError";
  }
}

interface Step {
  item: SeedPlanItem;
  /** Domain checks that need no I/O; throws what the real use case would throw. */
  validate: () => void;
  /** Reads the image, when the item has one, the way the upload will. */
  checkImage?: () => Promise<void>;
  execute: () => Promise<void>;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Loads the landing's content into the admin through the same use cases the
 * admin UI calls, so every domain rule applies (board privacy S4, photo
 * minimum widths, a member needs a photo to be published).
 *
 * - `plan` is read-only: it decides, per item, create or skip, and checks
 *   everything that can be checked without writing (domain rules, image files).
 * - `apply` refuses a plan with problems, then creates what is missing and
 *   nothing else. Items are matched on a stable key (event slug, FAQ question,
 *   pillar word, social platform + url, board name, the settings singleton), so
 *   a second run creates nothing, and an item that exists is never touched:
 *   admin edits are never overwritten. A seeded item the admin renamed or
 *   deleted is created again on the next run: the key is all the seed knows.
 * - An item whose image step fails is removed for good again, so a rerun can finish it.
 * - Event photos are never seeded (L36).
 */
export class SeedLandingContentUseCase {
  private readonly createEvent: CreateEventUseCase;
  private readonly createFaq: CreateFaqUseCase;
  private readonly createSocial: CreateSocialLinkUseCase;
  private readonly updateSettings: UpdateSiteSettingsUseCase;
  private readonly createPillar: CreatePillarUseCase;
  private readonly setPillarImage: SetPillarImageUseCase;
  private readonly trashPillar: TrashContentUseCase<Pillar>;
  private readonly purgePillar: PurgePillarUseCase;
  private readonly createMember: CreateBoardMemberUseCase;
  private readonly setMemberPhoto: SetBoardMemberPhotoUseCase;
  private readonly publishMember: SetOrderedContentPublishedUseCase<BoardMember, ReturnType<typeof toBoardMemberResult>>;
  private readonly trashMember: TrashContentUseCase<BoardMember>;
  private readonly purgeMember: PurgeBoardMemberUseCase;

  constructor(private readonly deps: SeedDependencies) {
    const upload = new UploadImageUseCase(deps.storage);

    this.createEvent = new CreateEventUseCase(deps.events);
    // Seeded FAQs never carry a command, so there is no name to check.
    this.createFaq = new CreateFaqUseCase(deps.faqs, { findOwner: async () => null });
    this.createSocial = new CreateSocialLinkUseCase(deps.socials);
    this.updateSettings = new UpdateSiteSettingsUseCase(deps.settings);
    this.createPillar = new CreatePillarUseCase(deps.pillars);
    this.setPillarImage = new SetPillarImageUseCase(deps.pillars, upload, deps.storage);
    this.trashPillar = new TrashContentUseCase(deps.pillars, "Pillar not found");
    this.purgePillar = new PurgePillarUseCase(deps.pillars, deps.storage);
    this.createMember = new CreateBoardMemberUseCase(deps.board);
    this.setMemberPhoto = new SetBoardMemberPhotoUseCase(deps.board, upload, deps.storage);
    this.publishMember = new SetOrderedContentPublishedUseCase(deps.board, toBoardMemberResult, "Board member not found");
    this.trashMember = new TrashContentUseCase(deps.board, "Board member not found");
    this.purgeMember = new PurgeBoardMemberUseCase(deps.board, deps.storage);
  }

  /** Read-only. Without `existing`, what is already stored is read from the repositories. */
  async plan(content: LandingSeedContent, existing?: SeedExistingKeys): Promise<SeedPlan> {
    const { steps, warnings } = this.buildSteps(content, existing ?? (await this.readExistingKeys()));

    return { items: steps.map((step) => step.item), warnings, problems: await this.findProblems(steps) };
  }

  async apply(content: LandingSeedContent): Promise<SeedResult> {
    const { steps, warnings } = this.buildSteps(content, await this.readExistingKeys());
    const problems = await this.findProblems(steps);

    if (problems.length > 0) {
      throw new SeedPlanInvalidError(problems);
    }

    const items: SeedResultItem[] = [];

    for (const step of steps) {
      if (step.item.action === "skip") {
        items.push({ ...step.item, outcome: "skipped" });
        continue;
      }

      try {
        await step.execute();
        items.push({ ...step.item, outcome: "created" });
      } catch (error) {
        items.push({ ...step.item, outcome: "failed", error: message(error) });
        return { items, warnings, failed: true };
      }
    }

    return { items, warnings, failed: false };
  }

  /** Everything that would make a create fail and can be known without writing. Skipped items are not checked. */
  private async findProblems(steps: readonly Step[]): Promise<SeedProblem[]> {
    const problems: SeedProblem[] = [];

    for (const { item, validate, checkImage } of steps) {
      if (item.action === "skip") continue;

      try {
        validate();
        await checkImage?.();
      } catch (error) {
        problems.push({ entity: item.entity, key: item.key, message: message(error) });
      }
    }

    return problems;
  }

  private async readExistingKeys(): Promise<SeedExistingKeys> {
    const [events, faqs, pillars, socials, board, settings] = await Promise.all([
      this.deps.events.list(),
      this.deps.faqs.list(),
      this.deps.pillars.list(),
      this.deps.socials.list(),
      this.deps.board.list(),
      this.deps.settings.get(),
    ]);

    return {
      eventSlugs: new Set(events.map((event) => normalizeSeedKey(event.props.slug))),
      faqs: new Set(faqs.map((faq) => normalizeSeedKey(faq.props.question))),
      pillars: new Set(pillars.map((pillar) => normalizeSeedKey(pillar.props.word))),
      socials: new Set(socials.map((link) => socialSeedKey(link.props.platform, link.props.url))),
      board: new Set(board.map((member) => normalizeSeedKey(member.props.name))),
      settings: settings !== null,
    };
  }

  private buildSteps(content: LandingSeedContent, existing: SeedExistingKeys): { steps: Step[]; warnings: string[] } {
    const steps: Step[] = [];
    const warnings: string[] = [];

    /** Skipped when the key exists; otherwise the step as given. */
    const step = (
      found: boolean,
      item: Omit<SeedPlanItem, "action" | "reason">,
      rest: Omit<Step, "item">,
    ): void => {
      steps.push({
        item: found ? { ...item, action: "skip", reason: "already exists" } : { ...item, action: "create" },
        ...rest,
      });
    };

    const imageCheck = (image: LandingSeedImage) => async () => {
      const file = await this.deps.readImage(image.url);

      assertImageMimeType(file.type);
      assertImageSize(file.size);
    };

    if (content.settings) {
      const settings = content.settings;

      step(existing.settings, { entity: "settings", key: "site", label: "Site settings", publish: true }, {
        validate: () => void SiteSettings.create(settings),
        execute: async () => void (await this.updateSettings.execute(settings)),
      });
    }

    for (const event of content.events) {
      const { photos, ...fields } = event;

      if (photos.length > 0) {
        warnings.push(`Event "${event.slug}": event photos are not seeded; upload them through the admin.`);
      }

      step(existing.eventSlugs.has(normalizeSeedKey(event.slug)), { entity: "event", key: event.slug, label: event.title, publish: true }, {
        validate: () => void Event.create({ ...fields, isPublished: true }),
        execute: async () => void (await this.createEvent.execute({ ...fields, isPublished: true })),
      });
    }

    for (const faq of content.faqs) {
      step(existing.faqs.has(normalizeSeedKey(faq.question)), { entity: "faq", key: faq.question, label: faq.question, publish: true }, {
        validate: () => void Faq.create({ ...faq, sortOrder: 0, isPublished: true }),
        execute: async () => void (await this.createFaq.execute({ ...faq, isPublished: true })),
      });
    }

    for (const pillar of content.pillars) {
      const { image, ...text } = pillar;

      step(
        existing.pillars.has(normalizeSeedKey(pillar.word)),
        { entity: "pillar", key: pillar.word, label: `${pillar.word} — ${pillar.title}`, publish: true, ...(image && { image: { path: image.url, width: image.width } }) },
        {
          validate: () => {
            Pillar.create({ ...text, sortOrder: 0, isPublished: true });

            if (image) {
              assertPillarImageAlt(image.alt);
              assertImageMinWidth(image.width, PILLAR_IMAGE_MIN_WIDTH);
            }
          },
          ...(image && { checkImage: imageCheck(image) }),
          execute: async () => {
            const created = await this.createPillar.execute({ ...text, isPublished: true });

            if (!image) return;

            try {
              await this.setPillarImage.execute({ id: created.id, file: await this.deps.readImage(image.url), alt: image.alt });
            } catch (error) {
              throw await this.afterRollback(error, "pillar", created.id, async () => {
                await this.trashPillar.execute({ id: created.id });
                await this.purgePillar.execute({ id: created.id });
              });
            }
          },
        },
      );
    }

    for (const social of content.socials) {
      step(
        existing.socials.has(socialSeedKey(social.platform, social.url)),
        { entity: "social", key: `${social.platform} ${social.url}`, label: `${social.label} ${social.handle}`, publish: true },
        {
          validate: () => void SocialLink.create({ ...social, sortOrder: 0, isPublished: true }),
          execute: async () => void (await this.createSocial.execute({ ...social, isPublished: true })),
        },
      );
    }

    for (const member of content.board) {
      const { photo } = member;

      if (!photo) {
        warnings.push(`Board member "${member.name}" is created without a photo, as a draft: a member needs a photo to be published.`);
      }

      step(
        existing.board.has(normalizeSeedKey(member.name)),
        { entity: "board", key: member.name, label: `${member.name} — ${member.role}`, publish: photo !== null, ...(photo && { image: { path: photo.url, width: photo.width } }) },
        {
          validate: () => {
            BoardMember.create({ name: member.name, role: member.role, sortOrder: 0 });

            if (photo) {
              assertBoardMemberPhotoAlt(photo.alt);
              assertImageMinWidth(photo.width, BOARD_PHOTO_MIN_WIDTH);
            }
          },
          ...(photo && { checkImage: imageCheck(photo) }),
          execute: async () => {
            const created = await this.createMember.execute({ name: member.name, role: member.role });

            if (!photo) return;

            try {
              await this.setMemberPhoto.execute({ id: created.id, file: await this.deps.readImage(photo.url), alt: photo.alt });
              await this.publishMember.execute({ id: created.id, isPublished: true });
            } catch (error) {
              throw await this.afterRollback(error, "board member", created.id, async () => {
                await this.trashMember.execute({ id: created.id });
                await this.purgeMember.execute({ id: created.id });
              });
            }
          },
        },
      );
    }

    return { steps, warnings };
  }

  /** Undoes a half-created item (trashed, then purged: a seed failure must leave nothing behind) so the next run starts it again; says so when even that fails. */
  private async afterRollback(error: unknown, what: string, id: string, rollback: () => Promise<void>): Promise<Error> {
    try {
      await rollback();
      return error instanceof Error ? error : new Error(String(error));
    } catch (rollbackError) {
      return new Error(`${message(error)} (rolling back the half-created ${what} "${id}" also failed: ${message(rollbackError)}; remove it in the admin before rerunning)`);
    }
  }
}
