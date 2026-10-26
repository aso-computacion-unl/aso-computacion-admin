import { beforeEach, describe, expect, it } from "vitest";

import { NotFoundError } from "@/application/use-cases/use-case-error";
import {
  PurgeableTrashPrismaRepository,
  type TrashDelegate,
} from "@/infrastructure/repositories/trashable-prisma.repository";

interface Row {
  id: string;
  name: string;
  isPublished: boolean;
  deletedAt: Date | null;
}
interface Item {
  props: { id: string; name: string };
}

type Where = { id?: string; deletedAt?: null | { not: null } };

/** Just enough of a Prisma delegate to see which rows each query reaches. */
class FakeDelegate implements TrashDelegate<Row> {
  rows: Row[] = [];

  private match(where: Where) {
    return this.rows.filter(
      (row) =>
        (where.id === undefined || row.id === where.id) &&
        (where.deletedAt === undefined || (where.deletedAt === null ? row.deletedAt === null : row.deletedAt !== null)),
    );
  }

  async updateMany({ where, data }: { where: Where; data: Record<string, unknown> }) {
    const found = this.match(where);

    for (const row of found) Object.assign(row, data);

    return { count: found.length };
  }

  async findFirst({ where }: { where: Where }) {
    return this.match(where)[0] ?? null;
  }

  async findMany({ where }: { where: Where }) {
    return this.match(where).sort((a, b) => b.deletedAt!.getTime() - a.deletedAt!.getTime());
  }

  async deleteMany({ where }: { where: Where }) {
    const found = this.match(where);
    this.rows = this.rows.filter((row) => !found.includes(row));

    return { count: found.length };
  }
}

class Clash extends Error {}

const delegate = new FakeDelegate();

class TestRepository extends PurgeableTrashPrismaRepository<Item, Row> {
  protected readonly delegate = delegate;
  protected readonly trashConfig = {
    notFound: "Thing not found",
    toDomain: (row: Row): Item => ({ props: { id: row.id, name: row.name } }),
    toUpdate: (item: Item) => ({ name: item.props.name }),
    mapConflict: (error: unknown): never => {
      throw error instanceof Clash ? new Error("name is taken") : error;
    },
  };
}

const row = (id: string, deletedAt: Date | null = null): Row => ({ id, name: id, isPublished: true, deletedAt });
const item = (id: string, name = id): Item => ({ props: { id, name } });

describe("TrashablePrismaRepository", () => {
  let repository: TestRepository;

  beforeEach(() => {
    delegate.rows = [row("live"), row("old", new Date("2026-01-01")), row("recent", new Date("2026-02-01"))];
    repository = new TestRepository();
  });

  it("trash stamps a live row and unpublishes it", async () => {
    await repository.trash("live");

    expect(delegate.rows.find((r) => r.id === "live")).toMatchObject({ isPublished: false, deletedAt: expect.any(Date) });
  });

  it("trash refuses an unknown or already trashed row and changes nothing", async () => {
    const before = structuredClone(delegate.rows);

    await expect(repository.trash("missing")).rejects.toEqual(new NotFoundError("Thing not found"));
    await expect(repository.trash("old")).rejects.toBeInstanceOf(NotFoundError);

    expect(delegate.rows).toEqual(before);
  });

  it("getTrashed finds a trashed row with its deletion time and ignores a live one", async () => {
    expect(await repository.getTrashed("old")).toEqual({ entity: item("old"), deletedAt: new Date("2026-01-01") });
    expect(await repository.getTrashed("live")).toBeNull();
    expect(await repository.getTrashed("missing")).toBeNull();
  });

  it("listTrashed returns only trashed rows, most recent first", async () => {
    expect((await repository.listTrashed()).map((entry) => entry.entity.props.id)).toEqual(["recent", "old"]);
  });

  it("restore writes the entity back over a trashed row and makes it live", async () => {
    const restored = await repository.restore(item("old", "renamed"));

    expect(restored).toEqual(item("old", "renamed"));
    expect(delegate.rows.find((r) => r.id === "old")).toMatchObject({ name: "renamed", deletedAt: null });
  });

  it("restore refuses a live or unknown row and writes nothing", async () => {
    const before = structuredClone(delegate.rows);

    await expect(repository.restore(item("live", "changed"))).rejects.toBeInstanceOf(NotFoundError);
    await expect(repository.restore(item("missing"))).rejects.toBeInstanceOf(NotFoundError);

    expect(delegate.rows).toEqual(before);
  });

  it("restore lets the model turn a database conflict into its own error, and passes other failures through", async () => {
    delegate.updateMany = async () => {
      throw new Clash();
    };
    await expect(repository.restore(item("old"))).rejects.toThrow("name is taken");

    delegate.updateMany = async () => {
      throw new Error("db down");
    };
    await expect(repository.restore(item("old"))).rejects.toThrow("db down");
  });

  it("purge removes a trashed row only", async () => {
    await expect(repository.purge("live")).rejects.toBeInstanceOf(NotFoundError);
    await expect(repository.purge("missing")).rejects.toBeInstanceOf(NotFoundError);
    expect(delegate.rows).toHaveLength(3);

    await repository.purge("old");

    expect(delegate.rows.map((r) => r.id).sort()).toEqual(["live", "recent"]);
  });
});
