import {
  ListTrashUseCase,
  PurgeBoardMemberUseCase,
  PurgeContentUseCase,
  PurgeEventUseCase,
  PurgeNewsItemUseCase,
  PurgePillarUseCase,
  RestoreEventUseCase,
  RestoreFaqUseCase,
  RestoreNewsItemUseCase,
  RestoreOrderedContentUseCase,
  RestoreTerminalCommandUseCase,
  type TrashKind,
} from "@/application";
import {
  BoardMemberPrismaRepository,
  CommandNamePrismaRegistry,
  EventPrismaRepository,
  FaqPrismaRepository,
  NewsPrismaRepository,
  PillarPrismaRepository,
  SocialLinkPrismaRepository,
  TerminalCommandPrismaRepository,
} from "@/infrastructure";
import { CloudinaryMediaStorage } from "@/infrastructure/storage/cloudinary-media-storage";
import { LazyMediaStorage } from "@/infrastructure/storage/lazy-media-storage";

/** Both operations take an id and resolve once the item is restored or gone. */
export interface TrashOperation {
  execute(command: { id: string }): Promise<void>;
}

function createTrashUseCases() {
  const events = new EventPrismaRepository();
  const news = new NewsPrismaRepository();
  const faqs = new FaqPrismaRepository();
  const commands = new TerminalCommandPrismaRepository();
  const socials = new SocialLinkPrismaRepository();
  const pillars = new PillarPrismaRepository();
  const board = new BoardMemberPrismaRepository();
  const commandNames = new CommandNamePrismaRegistry();
  const storage = new LazyMediaStorage(() => new CloudinaryMediaStorage());

  return {
    list: new ListTrashUseCase({ events, news, faqs, commands, socials, pillars, board }),
    restore: {
      event: new RestoreEventUseCase(events),
      news: new RestoreNewsItemUseCase(news),
      faq: new RestoreFaqUseCase(faqs, commandNames),
      command: new RestoreTerminalCommandUseCase(commands, commandNames),
      social: new RestoreOrderedContentUseCase(socials, "Social link not found"),
      pillar: new RestoreOrderedContentUseCase(pillars, "Pillar not found"),
      board: new RestoreOrderedContentUseCase(board, "Board member not found"),
    } satisfies Record<TrashKind, TrashOperation>,
    purge: {
      event: new PurgeEventUseCase(events, storage),
      news: new PurgeNewsItemUseCase(news, storage),
      faq: new PurgeContentUseCase(faqs, "Faq not found"),
      command: new PurgeContentUseCase(commands, "Terminal command not found"),
      social: new PurgeContentUseCase(socials, "Social link not found"),
      pillar: new PurgePillarUseCase(pillars, storage),
      board: new PurgeBoardMemberUseCase(board, storage),
    } satisfies Record<TrashKind, TrashOperation>,
  };
}

let useCases: ReturnType<typeof createTrashUseCases> | undefined;

/**
 * Built on first use, not at import time: the Cloudinary adapter reads its
 * credentials in the constructor, and a build that merely imports the actions
 * must not need them.
 */
export function getTrashUseCases() {
  useCases ??= createTrashUseCases();
  return useCases;
}
