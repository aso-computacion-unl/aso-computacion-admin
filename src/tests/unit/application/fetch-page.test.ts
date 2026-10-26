import { describe, expect, it, vi } from "vitest";

import { fetchPage } from "@/application/ports/list-criteria";

function source(total: number) {
  const rows = Array.from({ length: total }, (_, index) => index + 1);

  return {
    count: vi.fn(async () => total),
    load: vi.fn(async (limit: number, offset: number) => rows.slice(offset, offset + limit)),
  };
}

describe("fetchPage", () => {
  it("returns the requested window with the totals", async () => {
    const { count, load } = source(45);

    expect(await fetchPage({ page: 2, pageSize: 20 }, count, load)).toEqual({
      items: Array.from({ length: 20 }, (_, index) => index + 21),
      total: 45,
      page: 2,
      pageSize: 20,
      pageCount: 3,
    });
  });

  it("returns the short last page", async () => {
    const { count, load } = source(45);

    expect((await fetchPage({ page: 3, pageSize: 20 }, count, load)).items).toEqual([41, 42, 43, 44, 45]);
  });

  it("clamps a page past the end to the last one, instead of showing an empty list", async () => {
    const { count, load } = source(45);
    const page = await fetchPage({ page: 9000, pageSize: 20 }, count, load);

    expect(page.page).toBe(3);
    expect(page.items).toHaveLength(5);
    expect(load).toHaveBeenCalledWith(20, 40);
  });

  it("is one empty page when nothing matches, and never loads", async () => {
    const { count, load } = source(0);

    expect(await fetchPage({ page: 4, pageSize: 20 }, count, load)).toEqual({ items: [], total: 0, page: 1, pageSize: 20, pageCount: 1 });
    expect(load).not.toHaveBeenCalled();
  });

  it.each([0, -3, 1.5, Number.NaN])("treats page %s as the first page", async (page) => {
    const { count, load } = source(30);

    expect((await fetchPage({ page, pageSize: 20 }, count, load)).page).toBe(1);
  });

  it.each([0, -1, 2.5, Number.NaN])("refuses a page size of %s", async (pageSize) => {
    const { count, load } = source(30);

    await expect(fetchPage({ page: 1, pageSize }, count, load)).rejects.toThrow(RangeError);
  });
});
