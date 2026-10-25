import {
  CreateFaqUseCase,
  DeleteOrderedContentUseCase,
  GetOrderedContentUseCase,
  ListOrderedContentUseCase,
  MoveOrderedContentUseCase,
  SetOrderedContentPublishedUseCase,
  UpdateFaqUseCase,
} from "@/application";
import { toFaqResult } from "@/application/mappers/faq-result.mapper";
import { CommandNamePrismaRegistry, FaqPrismaRepository } from "@/infrastructure";

const NOT_FOUND = "Faq not found";

function createFaqUseCases() {
  const faqs = new FaqPrismaRepository();
  const commandNames = new CommandNamePrismaRegistry();

  return {
    list: new ListOrderedContentUseCase(faqs, toFaqResult),
    get: new GetOrderedContentUseCase(faqs, toFaqResult, NOT_FOUND),
    create: new CreateFaqUseCase(faqs, commandNames),
    update: new UpdateFaqUseCase(faqs, commandNames),
    setPublished: new SetOrderedContentPublishedUseCase(faqs, toFaqResult, NOT_FOUND),
    delete: new DeleteOrderedContentUseCase(faqs, NOT_FOUND),
    move: new MoveOrderedContentUseCase(faqs, NOT_FOUND),
  };
}

let useCases: ReturnType<typeof createFaqUseCases> | undefined;

/** Built on first use, not at import time, so a build that only imports the actions needs no database. */
export function getFaqUseCases() {
  useCases ??= createFaqUseCases();
  return useCases;
}
