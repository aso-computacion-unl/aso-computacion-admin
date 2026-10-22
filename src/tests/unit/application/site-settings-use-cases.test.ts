import { beforeEach, describe, expect, it } from "vitest";

import { GetSiteSettingsUseCase } from "@/application/use-cases/get-site-settings.use-case";
import { UpdateSiteSettingsUseCase } from "@/application/use-cases/update-site-settings.use-case";
import { ValidationError } from "@/domain";
import { InMemorySiteSettingsRepository } from "@/tests/fakes/in-memory-site-settings.repository";

const FIRST = { tagline: "Primera", description: "Descripción", about: "Acerca de" };

describe("site settings use cases", () => {
  let repository: InMemorySiteSettingsRepository;

  beforeEach(() => {
    repository = new InMemorySiteSettingsRepository();
  });

  it("get returns null until the settings are first saved (the landing keeps its own copy)", async () => {
    expect(await new GetSiteSettingsUseCase(repository).execute()).toBeNull();
  });

  it("update saves the settings and get returns them", async () => {
    const saved = await new UpdateSiteSettingsUseCase(repository).execute(FIRST);

    expect(saved).toMatchObject(FIRST);
    expect(await new GetSiteSettingsUseCase(repository).execute()).toEqual(saved);
  });

  it("a second update replaces the first", async () => {
    const update = new UpdateSiteSettingsUseCase(repository);
    await update.execute(FIRST);

    await update.execute({ ...FIRST, tagline: "Segunda" });

    expect(await new GetSiteSettingsUseCase(repository).execute()).toMatchObject({ tagline: "Segunda", about: "Acerca de" });
  });

  it("rejects invalid text and keeps what was saved before", async () => {
    const update = new UpdateSiteSettingsUseCase(repository);
    await update.execute(FIRST);

    await expect(update.execute({ ...FIRST, about: "a".repeat(601) })).rejects.toBeInstanceOf(ValidationError);

    expect(await new GetSiteSettingsUseCase(repository).execute()).toMatchObject(FIRST);
  });
});
