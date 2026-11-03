import { GetPublicContentUseCase, GetPublicSocialProofUseCase } from "@/application";
import {
  BoardMemberPrismaRepository,
  EventPhotoPrismaRepository,
  EventPrismaRepository,
  FaqPrismaRepository,
  NewsPrismaRepository,
  PillarPrismaRepository,
  SiteSettingsPrismaRepository,
  SocialLinkPrismaRepository,
  SponsorPrismaRepository,
  TerminalCommandPrismaRepository,
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
    new TerminalCommandPrismaRepository(),
  );

  return useCase;
}

let socialProofUseCase: GetPublicSocialProofUseCase | undefined;

/** The S9 social proof, read next to the main snapshot. Same rules: built on first use, read-only. */
export function getPublicSocialProofUseCase(): GetPublicSocialProofUseCase {
  socialProofUseCase ??= new GetPublicSocialProofUseCase(new SponsorPrismaRepository());

  return socialProofUseCase;
}
