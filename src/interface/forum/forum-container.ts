import { buildForumServices, type ForumServices } from "@/application";
import { ForumCategoryPrismaRepository, ForumMemberPrismaRepository, ForumModerationPrismaRepository, ForumPostPrismaRepository, ForumReactionPrismaRepository, ForumSessionPrismaRepository } from "@/infrastructure";
import { forumAllowedDomain } from "@/infrastructure/forum/forum-config";

function createForumServices(): ForumServices {
  return buildForumServices(
    {
      members: new ForumMemberPrismaRepository(),
      sessions: new ForumSessionPrismaRepository(),
      categories: new ForumCategoryPrismaRepository(),
      posts: new ForumPostPrismaRepository(),
      moderation: new ForumModerationPrismaRepository(),
      reactions: new ForumReactionPrismaRepository(),
    },
    { allowedDomain: forumAllowedDomain() },
  );
}

let services: ForumServices | undefined;

/** Built on first use, so importing a forum action or route never opens a database connection. */
export function getForumServices(): ForumServices {
  services ??= createForumServices();
  return services;
}
