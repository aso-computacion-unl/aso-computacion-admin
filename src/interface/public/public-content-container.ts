import { GetPublicContentUseCase } from "@/application";
import {
  BoardMemberPrismaRepository,
  EventPhotoPrismaRepository,
  EventPrismaRepository,
  FaqPrismaRepository,
  NewsPrismaRepository,
  PillarPrismaRepository,
  SiteSettingsPrismaRepository,
  SocialLinkPrismaRepository,
} from "@/infrastructure";

let useCase: GetPublicContentUseCase | undefined;

/** Built on first use so importing the route never needs a database. Read-only: no write use case is wired here. */
export function getPublicContentUseCase(): GetPublicContentUseCase {
  useCase ??= new GetPublicContentUseCase(
    new EventPrismaRepository(),
    new EventPhotoPrismaRepository(),
    new FaqPrismaRepository(),
    new PillarPrismaRepository(),
    new SocialLinkPrismaRepository(),
    new BoardMemberPrismaRepository(),
    new SiteSettingsPrismaRepository(),
    new NewsPrismaRepository(),
  );

  return useCase;
}
