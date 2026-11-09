import type { ForumMember, ForumMemberStatus } from "@/domain/forum";

export const FORUM_MEMBERS_PAGE_SIZE = 20;

export type ForumMemberFilter = "all" | "suspended";

/** What a moderator filters the members by: the account's state and a text that the name or the email must contain. */
export interface ForumMemberCriteria {
  filter: ForumMemberFilter;
  /** Already trimmed; blank means no search. */
  search: string;
}

/** The members of the forum as a moderator browses them; the write side (suspend, reactivate) is `ForumModerationRepository`. */
export interface ForumMemberDirectory {
  /** Newest account first. `search` matches the display name or the email as plain text, ignoring case. */
  list(criteria: ForumMemberCriteria, page: { offset: number; limit: number }): Promise<{ items: ForumMember[]; total: number }>;
}

/**
 * One member in the moderators' list. It carries the email, which the admin needs to tell two students apart; the
 * Google id never leaves the server.
 */
export interface ForumMemberListItemResult {
  id: string;
  displayName: string;
  email: string;
  status: ForumMemberStatus;
  suspendedAt: Date | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface ForumMembersPage {
  items: ForumMemberListItemResult[];
  total: number;
  page: number;
  pageCount: number;
}

function toListItem(member: ForumMember): ForumMemberListItemResult {
  return {
    id: member.id,
    displayName: member.displayName,
    email: member.email,
    status: member.status,
    suspendedAt: member.suspendedAt,
    createdAt: member.createdAt,
    lastLoginAt: member.lastLoginAt,
  };
}

export class ListForumMembersUseCase {
  constructor(private readonly members: ForumMemberDirectory) {}

  async execute(input: { filter: ForumMemberFilter; search: string; page: number }): Promise<ForumMembersPage> {
    const criteria = { filter: input.filter, search: input.search.trim() };
    const requested = Number.isInteger(input.page) && input.page >= 1 ? input.page : 1;
    const first = await this.members.list(criteria, { offset: (requested - 1) * FORUM_MEMBERS_PAGE_SIZE, limit: FORUM_MEMBERS_PAGE_SIZE });
    const pageCount = Math.max(1, Math.ceil(first.total / FORUM_MEMBERS_PAGE_SIZE));
    const page = Math.min(requested, pageCount);
    // A page past the end (a stale link) shows the last page, not an empty one.
    const { items, total } = page === requested ? first : await this.members.list(criteria, { offset: (page - 1) * FORUM_MEMBERS_PAGE_SIZE, limit: FORUM_MEMBERS_PAGE_SIZE });

    return { items: items.map(toListItem), total, page, pageCount };
  }
}
