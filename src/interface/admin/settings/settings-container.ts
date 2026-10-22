import { GetSiteSettingsUseCase, UpdateSiteSettingsUseCase } from "@/application";
import { SiteSettingsPrismaRepository } from "@/infrastructure";

function createSiteSettingsUseCases() {
  const settings = new SiteSettingsPrismaRepository();

  return {
    get: new GetSiteSettingsUseCase(settings),
    update: new UpdateSiteSettingsUseCase(settings),
  };
}

let useCases: ReturnType<typeof createSiteSettingsUseCases> | undefined;

/** Built on first use, not at import time, so a build that only imports the actions needs no database. */
export function getSiteSettingsUseCases() {
  useCases ??= createSiteSettingsUseCases();
  return useCases;
}
