import {
  CreateImpactStatUseCase,
  GetOrderedContentUseCase,
  ListOrderedContentUseCase,
  MoveOrderedContentUseCase,
  ReorderOrderedContentUseCase,
  SetOrderedContentPublishedUseCase,
  TrashContentUseCase,
  UpdateImpactStatUseCase,
} from "@/application";
import { toImpactStatResult } from "@/application/mappers/impact-stat-result.mapper";
import { ImpactStatPrismaRepository } from "@/infrastructure";

const NOT_FOUND = "Impact stat not found";

function createImpactStatUseCases() {
  const stats = new ImpactStatPrismaRepository();

  return {
    list: new ListOrderedContentUseCase(stats, toImpactStatResult),
    get: new GetOrderedContentUseCase(stats, toImpactStatResult, NOT_FOUND),
    create: new CreateImpactStatUseCase(stats),
    update: new UpdateImpactStatUseCase(stats),
    setPublished: new SetOrderedContentPublishedUseCase(stats, toImpactStatResult, NOT_FOUND),
    trash: new TrashContentUseCase(stats, NOT_FOUND),
    move: new MoveOrderedContentUseCase(stats, NOT_FOUND),
    reorder: new ReorderOrderedContentUseCase(stats, NOT_FOUND),
  };
}

let useCases: ReturnType<typeof createImpactStatUseCases> | undefined;

/** Built on first use, not at import time, like the other containers. */
export function getImpactStatUseCases() {
  useCases ??= createImpactStatUseCases();
  return useCases;
}
