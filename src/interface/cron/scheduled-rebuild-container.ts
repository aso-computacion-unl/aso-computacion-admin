import { RebuildOnWindowCrossingUseCase } from "@/application";
import { triggerSiteRebuildNow } from "@/infrastructure/deploy/deploy-hook";
import { readLastSuccessAt } from "@/infrastructure/deploy/deploy-status";
import { EventPrismaRepository, NewsPrismaRepository } from "@/infrastructure";

let useCase: RebuildOnWindowCrossingUseCase | undefined;

/** Built on first use so importing the route never needs a database. */
export function getRebuildOnWindowCrossing(): RebuildOnWindowCrossingUseCase {
  useCase ??= new RebuildOnWindowCrossingUseCase(new EventPrismaRepository(), new NewsPrismaRepository(), { lastSuccessAt: readLastSuccessAt }, { trigger: triggerSiteRebuildNow });

  return useCase;
}
