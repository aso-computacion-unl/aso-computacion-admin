import {
  CreateSocialLinkUseCase,
  DeleteOrderedContentUseCase,
  GetOrderedContentUseCase,
  ListOrderedContentUseCase,
  MoveOrderedContentUseCase,
  SetOrderedContentPublishedUseCase,
  UpdateSocialLinkUseCase,
} from "@/application";
import { toSocialLinkResult } from "@/application/mappers/social-link-result.mapper";
import { SocialLinkPrismaRepository } from "@/infrastructure";

const NOT_FOUND = "Social link not found";

function createSocialLinkUseCases() {
  const links = new SocialLinkPrismaRepository();

  return {
    list: new ListOrderedContentUseCase(links, toSocialLinkResult),
    get: new GetOrderedContentUseCase(links, toSocialLinkResult, NOT_FOUND),
    create: new CreateSocialLinkUseCase(links),
    update: new UpdateSocialLinkUseCase(links),
    setPublished: new SetOrderedContentPublishedUseCase(links, toSocialLinkResult, NOT_FOUND),
    delete: new DeleteOrderedContentUseCase(links, NOT_FOUND),
    move: new MoveOrderedContentUseCase(links, NOT_FOUND),
  };
}

let useCases: ReturnType<typeof createSocialLinkUseCases> | undefined;

/** Built on first use, not at import time, so a build that only imports the actions needs no database. */
export function getSocialLinkUseCases() {
  useCases ??= createSocialLinkUseCases();
  return useCases;
}
