import type { ForumModerationRepository } from "../ports/forum-moderation.ports";
import type { ForumCategoryRepository, ForumMemberRepository, ForumPostRepository, ForumSessionRepository } from "../ports/forum.ports";
import { CloseForumSessionUseCase, OpenForumSessionUseCase, ResolveForumLoginUseCase, ValidateForumSessionUseCase, type ForumLoginConfig } from "./forum-auth.use-cases";
import { CreateForumCategoryUseCase, DeleteForumCategoryUseCase, ListForumCategoriesUseCase, UpdateForumCategoryUseCase } from "./forum-categories.use-cases";
import {
  CreateForumThreadUseCase,
  EditForumReplyUseCase,
  EditForumThreadUseCase,
  GetForumThreadUseCase,
  ListForumThreadsUseCase,
  ReplyToForumThreadUseCase,
} from "./forum-threads.use-cases";
import {
  CloseForumReportUseCase,
  ListForumReportsUseCase,
  ReportForumPostUseCase,
  SetForumMemberSuspendedUseCase,
  SetForumPostHiddenUseCase,
  SetForumThreadLockedUseCase,
} from "./forum-moderation.use-cases";
import { PostingThrottle } from "./posting-throttle";

export interface ForumRepositories {
  members: ForumMemberRepository;
  sessions: ForumSessionRepository;
  categories: ForumCategoryRepository;
  posts: ForumPostRepository;
  moderation: ForumModerationRepository;
}

/** Wires every forum use case over the given repositories: the container passes Prisma ones, tests pass in-memory ones. */
export function buildForumServices({ members, sessions, categories, posts, moderation }: ForumRepositories, login: ForumLoginConfig, now: () => Date = () => new Date()) {
  const throttle = new PostingThrottle(posts, now);

  return {
    resolveLogin: new ResolveForumLoginUseCase(members, login, now),
    openSession: new OpenForumSessionUseCase(sessions, now),
    validateSession: new ValidateForumSessionUseCase(sessions, now),
    closeSession: new CloseForumSessionUseCase(sessions, now),
    listCategories: new ListForumCategoriesUseCase(categories),
    createCategory: new CreateForumCategoryUseCase(categories, now),
    updateCategory: new UpdateForumCategoryUseCase(categories, now),
    deleteCategory: new DeleteForumCategoryUseCase(categories),
    listThreads: new ListForumThreadsUseCase(categories, posts),
    getThread: new GetForumThreadUseCase(categories, posts),
    createThread: new CreateForumThreadUseCase(members, categories, posts, throttle, now),
    reply: new ReplyToForumThreadUseCase(members, posts, throttle, now),
    editThread: new EditForumThreadUseCase(members, posts, now),
    editReply: new EditForumReplyUseCase(members, posts, now),
    reportPost: new ReportForumPostUseCase(members, posts, moderation, now),
    listReports: new ListForumReportsUseCase(moderation),
    closeReport: new CloseForumReportUseCase(moderation, now),
    setPostHidden: new SetForumPostHiddenUseCase(moderation, now),
    setThreadLocked: new SetForumThreadLockedUseCase(moderation, now),
    setMemberSuspended: new SetForumMemberSuspendedUseCase(moderation, now),
  };
}

export type ForumServices = ReturnType<typeof buildForumServices>;
