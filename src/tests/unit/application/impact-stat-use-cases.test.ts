import { beforeEach, describe, expect, it } from "vitest";

import { toImpactStatResult } from "@/application/mappers/impact-stat-result.mapper";
import { CreateImpactStatUseCase } from "@/application/use-cases/create-impact-stat.use-case";
import { MoveOrderedContentUseCase, SetOrderedContentPublishedUseCase } from "@/application/use-cases/ordered-content.use-cases";
import { UpdateImpactStatUseCase } from "@/application/use-cases/update-impact-stat.use-case";
import { NotFoundError } from "@/application/use-cases/use-case-error";
import { ValidationError } from "@/domain";
import type { ImpactStat } from "@/domain/impact-stat";
import { InMemoryOrderedRepository } from "@/tests/fakes/in-memory-ordered-repository";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const TEXT = { value: "120+", label: "Estudiantes" };

describe("impact stat use cases", () => {
  let stats: InMemoryOrderedRepository<ImpactStat>;

  beforeEach(() => {
    stats = new InMemoryOrderedRepository<ImpactStat>();
  });

  it("appends an unpublished stat after the existing ones", async () => {
    const create = new CreateImpactStatUseCase(stats);

    const first = await create.execute(TEXT);
    const second = await create.execute({ ...TEXT, value: "15", isPublished: true });

    expect(first).toMatchObject({ sortOrder: 0, isPublished: false });
    expect(second).toMatchObject({ sortOrder: 1, isPublished: true });
  });

  it("rejects text over the limits without storing anything", async () => {
    await expect(new CreateImpactStatUseCase(stats).execute({ ...TEXT, value: "v".repeat(21) })).rejects.toBeInstanceOf(ValidationError);
    expect(await stats.list()).toEqual([]);
  });

  it("returns only the admin shape: no storage or trash details", async () => {
    const result = await new CreateImpactStatUseCase(stats).execute(TEXT);

    expect(Object.keys(result).sort()).toEqual(["createdAt", "id", "isPublished", "label", "sortOrder", "updatedAt", "value"]);
  });

  it("updates text keeping the position, and fails for an unknown id", async () => {
    const created = await new CreateImpactStatUseCase(stats).execute(TEXT);
    const update = new UpdateImpactStatUseCase(stats);

    expect(await update.execute({ id: created.id, label: "Socios" })).toMatchObject({ label: "Socios", value: "120+", sortOrder: 0 });
    await expect(update.execute({ id: MISSING_ID, label: "x" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("publishes and moves through the shared ordered-content use cases", async () => {
    const create = new CreateImpactStatUseCase(stats);
    const a = await create.execute(TEXT);
    const b = await create.execute({ ...TEXT, value: "15" });

    await new MoveOrderedContentUseCase(stats, "Impact stat not found").execute({ id: b.id, direction: "up" });
    await new SetOrderedContentPublishedUseCase(stats, toImpactStatResult, "Impact stat not found").execute({ id: a.id, isPublished: true });

    expect((await stats.list()).map(({ props }) => [props.id, props.sortOrder, props.isPublished])).toEqual([
      [b.id, 0, false],
      [a.id, 1, true],
    ]);
  });
});
