import {
  ForumAlreadyReportedError,
  ForumReportAlreadyClosedError,
  parseReportReason,
  parseResolutionNote,
  type ForumReport,
} from "@/domain/forum";

import type { ForumReportItemResult } from "../dto/forum-moderation-result.dto";
import type { ForumModerationChange, ForumModerationRepository, ForumPostTarget, ForumReportQueue, ForumReportRow } from "../ports/forum-moderation.ports";
import type { ForumMemberRepository, ForumPostRepository } from "../ports/forum.ports";
import { NotFoundError } from "../use-cases/use-case-error";
import { activeMember, assertVisible } from "./forum-guards";

export const FORUM_REPORTS_PAGE_SIZE = 20;
const EXCERPT_LENGTH = 280;

type Clock = () => Date;

const POST_NOT_FOUND = "Forum post not found";

/** What a moderation step did: `changed` is false when the target was already in the wanted state, so nothing is worth auditing. */
export interface ForumModerationOutcome {
  changed: boolean;
}

function outcomeOf(change: ForumModerationChange, notFound: string): ForumModerationOutcome {
  if (change === "not-found") {
    throw new NotFoundError(notFound);
  }

  return { changed: change === "changed" };
}

export class ReportForumPostUseCase {
  constructor(
    private readonly members: ForumMemberRepository,
    private readonly posts: ForumPostRepository,
    private readonly moderation: ForumModerationRepository,
    private readonly now: Clock = () => new Date(),
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  async execute(input: { memberId: string; target: ForumPostTarget; reason: string }): Promise<{ id: string }> {
    const member = await activeMember(this.members, input.memberId);
    const reason = parseReportReason(input.reason);

    await assertVisible(this.posts, input.target);

    const report: ForumReport = {
      id: this.newId(),
      reporterId: member.id,
      threadId: input.target.kind === "thread" ? input.target.id : null,
      replyId: input.target.kind === "reply" ? input.target.id : null,
      reason,
      status: "OPEN",
      createdAt: this.now(),
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
    };

    // The partial unique index decides: two reports racing cannot both be stored.
    if (!(await this.moderation.createReport(report))) {
      throw new ForumAlreadyReportedError();
    }

    return { id: report.id };
  }
}

function toReportItem({ report, reporterName, post }: ForumReportRow): ForumReportItemResult {
  return {
    id: report.id,
    status: report.status,
    reason: report.reason,
    createdAt: report.createdAt,
    reporterName,
    resolvedAt: report.resolvedAt,
    resolutionNote: report.resolutionNote,
    target: {
      kind: post.kind,
      threadId: post.threadId,
      replyId: report.replyId,
      threadTitle: post.threadTitle,
      excerpt: post.body.length > EXCERPT_LENGTH ? `${post.body.slice(0, EXCERPT_LENGTH)}…` : post.body,
      authorId: post.authorId,
      authorName: post.authorName,
      authorSuspended: post.authorSuspended,
      hidden: post.hidden,
      locked: post.locked,
    },
  };
}

export interface ForumReportsPage {
  items: ForumReportItemResult[];
  total: number;
  page: number;
  pageCount: number;
}

export class ListForumReportsUseCase {
  constructor(private readonly moderation: ForumModerationRepository) {}

  async execute(input: { status: ForumReportQueue; page: number }): Promise<ForumReportsPage> {
    const requested = Number.isInteger(input.page) && input.page >= 1 ? input.page : 1;
    const first = await this.moderation.listReports(input.status, { offset: (requested - 1) * FORUM_REPORTS_PAGE_SIZE, limit: FORUM_REPORTS_PAGE_SIZE });
    const pageCount = Math.max(1, Math.ceil(first.total / FORUM_REPORTS_PAGE_SIZE));
    const page = Math.min(requested, pageCount);
    // A page past the end (a stale link) shows the last page, not an empty one.
    const { items, total } = page === requested ? first : await this.moderation.listReports(input.status, { offset: (page - 1) * FORUM_REPORTS_PAGE_SIZE, limit: FORUM_REPORTS_PAGE_SIZE });

    return { items: items.map(toReportItem), total, page, pageCount };
  }
}

export class CloseForumReportUseCase {
  constructor(
    private readonly moderation: ForumModerationRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: { reportId: string; outcome: "RESOLVED" | "DISMISSED"; note?: string | null; moderatorId: string | null }): Promise<void> {
    const note = parseResolutionNote(input.note);
    const outcome = await this.moderation.closeReport(input.reportId, { status: input.outcome, note, at: this.now(), by: input.moderatorId });

    if (outcome === "not-found") {
      throw new NotFoundError("Forum report not found");
    }

    if (outcome === "closed") {
      throw new ForumReportAlreadyClosedError();
    }
  }
}

export class SetForumPostHiddenUseCase {
  constructor(
    private readonly moderation: ForumModerationRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: { target: ForumPostTarget; hidden: boolean; moderatorId: string | null }): Promise<ForumModerationOutcome> {
    return outcomeOf(await this.moderation.setPostHidden(input.target, input.hidden, { at: this.now(), by: input.moderatorId }), POST_NOT_FOUND);
  }
}

export class SetForumThreadLockedUseCase {
  constructor(
    private readonly moderation: ForumModerationRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: { threadId: string; locked: boolean; moderatorId: string | null }): Promise<ForumModerationOutcome> {
    return outcomeOf(await this.moderation.setThreadLocked(input.threadId, input.locked, { at: this.now(), by: input.moderatorId }), POST_NOT_FOUND);
  }
}

export class SetForumMemberSuspendedUseCase {
  constructor(
    private readonly moderation: ForumModerationRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async execute(input: { memberId: string; suspended: boolean; moderatorId: string | null }): Promise<ForumModerationOutcome> {
    return outcomeOf(await this.moderation.setMemberSuspended(input.memberId, input.suspended, { at: this.now(), by: input.moderatorId }), "Forum member not found");
  }
}
