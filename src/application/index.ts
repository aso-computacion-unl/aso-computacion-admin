/**
 * Application layer entry point.
 *
 * This layer holds use cases and ports (repositories, media storage) that
 * orchestrate domain behavior. It must stay framework-independent: no
 * imports from `next/*`, the Prisma client, the Cloudinary SDK, or `jose`
 * are allowed here. See `src/tests/unit/architecture-boundaries.test.ts`.
 */
export { NotFoundError } from "./use-cases/use-case-error";
export type {
  ImageUploadFile,
  MediaStoragePort,
  UploadOptions,
  UploadResult,
} from "./ports/media-storage.port";
export { UploadImageUseCase } from "./use-cases/upload-image.use-case";
export type { UploadImageInput } from "./use-cases/upload-image.use-case";
export type {
  EventDetailResult,
  EventListItemResult,
  EventPhotoResult,
  EventResult,
} from "./dto/event-result.dto";
export type { EventPhotoRepository } from "./ports/event-photo-repository.port";
export type { ListCriteria, PublicationCounts, PublicationStatus } from "./ports/list-criteria";
export { CountByStatusUseCase } from "./use-cases/count-by-status.use-case";
export type { EventRepository } from "./ports/event-repository.port";
export {
  AttachEventPhotoUseCase,
  EVENT_PHOTO_FOLDER,
  EVENT_PHOTO_MIN_WIDTH,
} from "./use-cases/attach-event-photo.use-case";
export { CreateEventUseCase } from "./use-cases/create-event.use-case";
export { DeactivateEventPhotoUseCase } from "./use-cases/deactivate-event-photo.use-case";
export { GetEventUseCase } from "./use-cases/get-event.use-case";
export { ListEventsUseCase } from "./use-cases/list-events.use-case";
export { ReorderEventPhotosUseCase } from "./use-cases/reorder-event-photos.use-case";
export { SetEventPublishedUseCase } from "./use-cases/set-event-published.use-case";
export { UpdateEventPhotoAltUseCase } from "./use-cases/update-event-photo-alt.use-case";
export { UpdateEventUseCase } from "./use-cases/update-event.use-case";
export type { FaqResult } from "./dto/faq-result.dto";
export type { OrderedContent, OrderedContentRepository } from "./ports/ordered-content-repository.port";
export {
  GetOrderedContentUseCase,
  ListOrderedContentUseCase,
  MoveOrderedContentUseCase,
  SetOrderedContentPublishedUseCase,
  nextSortOrder,
} from "./use-cases/ordered-content.use-cases";
export type { CommandNameOwner, CommandNameRegistry } from "./ports/command-name-registry.port";
export { assertCommandNameFree } from "./use-cases/assert-command-name-free";
export { CreateFaqUseCase } from "./use-cases/create-faq.use-case";
export { UpdateFaqUseCase } from "./use-cases/update-faq.use-case";
export type { TerminalCommandResult } from "./dto/terminal-command-result.dto";
export { CreateTerminalCommandUseCase } from "./use-cases/create-terminal-command.use-case";
export { UpdateTerminalCommandUseCase } from "./use-cases/update-terminal-command.use-case";
export type { SocialLinkResult } from "./dto/social-link-result.dto";
export { CreateSocialLinkUseCase } from "./use-cases/create-social-link.use-case";
export { UpdateSocialLinkUseCase } from "./use-cases/update-social-link.use-case";
export type { PillarImageResult, PillarResult } from "./dto/pillar-result.dto";
export { CreatePillarUseCase } from "./use-cases/create-pillar.use-case";
export { RemovePillarImageUseCase } from "./use-cases/remove-pillar-image.use-case";
export {
  PILLAR_IMAGE_FOLDER,
  PILLAR_IMAGE_MIN_WIDTH,
  SetPillarImageUseCase,
} from "./use-cases/set-pillar-image.use-case";
export { UpdatePillarUseCase } from "./use-cases/update-pillar.use-case";
export type { SiteSettingsResult } from "./dto/site-settings-result.dto";
export type { SiteSettingsRepository } from "./ports/site-settings-repository.port";
export { GetSiteSettingsUseCase } from "./use-cases/get-site-settings.use-case";
export { UpdateSiteSettingsUseCase } from "./use-cases/update-site-settings.use-case";
export type { BoardMemberPhotoResult, BoardMemberResult } from "./dto/board-member-result.dto";
export { CreateBoardMemberUseCase } from "./use-cases/create-board-member.use-case";
export { RemoveBoardMemberPhotoUseCase } from "./use-cases/remove-board-member-photo.use-case";
export {
  BOARD_PHOTO_FOLDER,
  BOARD_PHOTO_MIN_WIDTH,
  SetBoardMemberPhotoUseCase,
} from "./use-cases/set-board-member-photo.use-case";
export { UpdateBoardMemberUseCase } from "./use-cases/update-board-member.use-case";
export type { PublicContentSnapshot } from "./dto/public-content.dto";
export { GetPublicContentUseCase } from "./use-cases/get-public-content.use-case";
export { RebuildOnWindowCrossingUseCase } from "./use-cases/rebuild-on-window-crossing.use-case";
export type { WindowCrossingResult } from "./use-cases/rebuild-on-window-crossing.use-case";
export type { LastBuildMarker, SiteRebuildTrigger } from "./ports/site-rebuild.port";
export { parseLandingSeedContent, SeedSourceError } from "./seed/landing-seed-content";
export type { LandingSeedContent } from "./seed/landing-seed-content";
export { SeedLandingContentUseCase, SeedPlanInvalidError, emptyExistingKeys } from "./seed/seed-landing-content.use-case";
export type { SeedDependencies, SeedPlan, SeedResult } from "./seed/seed-landing-content.use-case";
export type { NewsCoverResult, NewsItemResult } from "./dto/news-item-result.dto";
export type { NewsRepository } from "./ports/news-repository.port";
export { CreateNewsItemUseCase } from "./use-cases/create-news-item.use-case";
export { GetNewsItemUseCase } from "./use-cases/get-news-item.use-case";
export { ListNewsItemsUseCase } from "./use-cases/list-news-items.use-case";
export { RemoveNewsCoverUseCase } from "./use-cases/remove-news-cover.use-case";
export { NEWS_COVER_FOLDER, NEWS_COVER_MIN_WIDTH, SetNewsCoverUseCase } from "./use-cases/set-news-cover.use-case";
export { SetNewsItemPublishedUseCase } from "./use-cases/set-news-item-published.use-case";
export { UpdateNewsItemUseCase } from "./use-cases/update-news-item.use-case";
export type { TrashableRepository, TrashedItem } from "./ports/trashable-repository.port";
export { TRASH_KINDS } from "./dto/trash-result.dto";
export type { TrashItemResult, TrashKind } from "./dto/trash-result.dto";
export { ListTrashUseCase } from "./use-cases/list-trash.use-case";
export type { TrashSources } from "./use-cases/list-trash.use-case";
export {
  PurgeBoardMemberUseCase,
  PurgeContentUseCase,
  PurgeEventUseCase,
  PurgeNewsItemUseCase,
  PurgePillarUseCase,
} from "./use-cases/purge-content.use-case";
export {
  RestoreContentUseCase,
  RestoreEventUseCase,
  RestoreFaqUseCase,
  RestoreNewsItemUseCase,
  RestoreOrderedContentUseCase,
  RestoreTerminalCommandUseCase,
} from "./use-cases/restore-content.use-case";
export { TrashContentUseCase } from "./use-cases/trash-content.use-case";
export type { TrashContentResult } from "./use-cases/trash-content.use-case";
export { RestoreConflictError } from "./use-cases/use-case-error";
export * from "./auth/admin-invite.use-cases";
export * from "./auth/auth-errors";
export * from "./auth/list-audit-log.use-case";
export * from "./auth/resolve-google-login.use-case";
export * from "./auth/session.use-cases";
export * from "./auth/user.use-cases";
export type * from "./ports/auth.ports";
export { ForbiddenError } from "./use-cases/use-case-error";
export {
  CloseForumSessionUseCase,
  FORUM_SESSION_TTL_MS,
  OpenForumSessionUseCase,
  ResolveForumLoginUseCase,
  ValidateForumSessionUseCase,
} from "./forum/forum-auth.use-cases";
export type { ForumActor, ForumGoogleIdentity, ForumLoginConfig, ForumLoginDenial, ForumLoginOutcome } from "./forum/forum-auth.use-cases";
export type {
  ForumCategoryResult,
  ForumReplyResult,
  ForumThreadListItemResult,
  ForumThreadResult,
} from "./dto/forum-result.dto";
export {
  CreateForumCategoryUseCase,
  DeleteForumCategoryUseCase,
  ForumCategoryNotEmptyError,
  ListForumCategoriesUseCase,
  UpdateForumCategoryUseCase,
} from "./forum/forum-categories.use-cases";
export { ForumThrottledError, POSTING_LIMITS, PostingThrottle } from "./forum/posting-throttle";
export {
  CreateForumThreadUseCase,
  EditForumReplyUseCase,
  EditForumThreadUseCase,
  FORUM_THREADS_PAGE_SIZE,
  GetForumThreadUseCase,
  ListForumThreadsUseCase,
  ReplyToForumThreadUseCase,
} from "./forum/forum-threads.use-cases";
export type { ForumThreadsPage, ForumThreadView } from "./forum/forum-threads.use-cases";
export { buildForumServices } from "./forum/forum-services";
export type { ForumRepositories, ForumServices } from "./forum/forum-services";
export type {
  EventRegistrationRecord,
  EventRegistrationRepository,
  NewEventRegistration,
  RegisterOutcome,
} from "./ports/event-registration-repository.port";
export {
  DeleteEventRegistrationUseCase,
  GetEventRegistrationStatusUseCase,
  ListEventRegistrationsUseCase,
  RegisterWithOpenFormUseCase,
  RegisterWithUnlAccountUseCase,
} from "./event-registration/event-registration.use-cases";
export type { EventRegistrationStatus, RegistrationState } from "./event-registration/event-registration.use-cases";
export { buildEventRegistrationServices } from "./event-registration/event-registration-services";
export type { EventRegistrationServices } from "./event-registration/event-registration-services";
export { GetPublicEventUseCase } from "./use-cases/get-public-event.use-case";
