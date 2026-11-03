import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ImpactStat } from "@/domain/impact-stat";
import { ImpactStatPrismaRepository } from "@/infrastructure/repositories/impact-stat-prisma.repository";

import { describeOrderedRepositoryContract } from "../support/ordered-repository-contract";

const repository = new ImpactStatPrismaRepository();
const make = (sortOrder: number) => ImpactStat.create({ value: "120+", label: `Estudiantes ${crypto.randomUUID().slice(0, 8)}`, sortOrder });

describeOrderedRepositoryContract("ImpactStatPrismaRepository", repository, make);

describe("ImpactStatPrismaRepository (integration)", () => {
  it("round-trips accented text and keeps the draft flag", async () => {
    const stat = ImpactStat.create({ value: "3 años", label: "De trayectoria académica", sortOrder: 0 });

    await repository.create(stat);

    expect((await repository.getById(stat.props.id))?.props).toEqual(stat.props);
  });
});
