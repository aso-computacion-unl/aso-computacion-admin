import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, requestSiteRebuildMock, revalidatePathMock, target } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  requestSiteRebuildMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  target: { setPublished: { execute: vi.fn() }, trash: { execute: vi.fn() } },
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/infrastructure/deploy/deploy-hook", () => ({ requestSiteRebuild: requestSiteRebuildMock }));
vi.mock("@/interface/admin/bulk/bulk-container", () => ({ getBulkTarget: () => target }));

import { NotFoundError } from "@/application";
import { ValidationError } from "@/domain";
import { bulkSetPublished, bulkTrash } from "@/interface/admin/bulk/actions";
import { cookieJar } from "@/tests/support/action-policy";
import { signInAs, testAuth } from "@/tests/support/test-auth";

// The in-memory log lists newest first; the tests read it in the order things happened.
const audited = () => [...testAuth.audit.entries].reverse();
const auditedIds = () => audited().map((entry) => entry.entityId);

describe("bulk actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
    target.setPublished.execute.mockResolvedValue({});
    target.trash.execute.mockResolvedValue({ wasPublished: true });
  });

  describe("bulkSetPublished", () => {
    it("publishes every item and writes one audit entry per item, attributed to the actor", async () => {
      cookieJar(cookiesMock, await signInAs("EDITOR"));

      const result = await bulkSetPublished("faq", ["a", "b", "c"], true);

      expect(result).toEqual({
        results: [
          { id: "a", ok: true },
          { id: "b", ok: true },
          { id: "c", ok: true },
        ],
      });
      expect(target.setPublished.execute.mock.calls).toEqual([
        [{ id: "a", isPublished: true }],
        [{ id: "b", isPublished: true }],
        [{ id: "c", isPublished: true }],
      ]);
      expect(audited().map((entry) => [entry.action, entry.entityType, entry.entityId, entry.actorUserId])).toEqual([
        ["faq.publish", "faq", "a", "test-editor"],
        ["faq.publish", "faq", "b", "test-editor"],
        ["faq.publish", "faq", "c", "test-editor"],
      ]);
    });

    it.each([
      ["impact", "/admin/impact", "cifra de impacto"],
      ["testimonial", "/admin/testimonials", "testimonio"],
      ["sponsor", "/admin/sponsors", "aliado"],
    ])("publishes the social proof kind %s and audits it under its own name", async (kind, path, noun) => {
      cookieJar(cookiesMock, await signInAs("EDITOR"));

      expect(await bulkSetPublished(kind, ["a"], true)).toEqual({ results: [{ id: "a", ok: true }] });

      expect(audited().map((entry) => [entry.action, entry.entityType, entry.summary])).toEqual([[`${kind}.publish`, kind, `Publicado en lote: ${noun}`]]);
      expect(revalidatePathMock).toHaveBeenCalledWith(path);
    });

    it("reports a failure per item, keeps going, audits only what changed and asks for one rebuild", async () => {
      cookieJar(cookiesMock, await signInAs("EDITOR"));
      target.setPublished.execute
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new NotFoundError("Faq not found"))
        .mockRejectedValueOnce(new ValidationError("photo", "a published member needs a photo"))
        .mockRejectedValueOnce(new Error("db exploded: secret detail"))
        .mockResolvedValueOnce({});
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const result = await bulkSetPublished("faq", ["a", "b", "c", "d", "e"], true);

      expect(result).toEqual({
        results: [
          { id: "a", ok: true },
          { id: "b", ok: false, error: "No se encontró la pregunta frecuente." },
          { id: "c", ok: false, error: expect.stringContaining("foto") },
          { id: "d", ok: false, error: "Ocurrió un error inesperado. Intente nuevamente." },
          { id: "e", ok: true },
        ],
      });
      expect(JSON.stringify(result)).not.toContain("secret detail");
      expect(auditedIds()).toEqual(["a", "e"]);
      expect(requestSiteRebuildMock).toHaveBeenCalledTimes(1);
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/faqs");
    });

    it("audits an unpublish as such and passes the flag as a strict boolean", async () => {
      cookieJar(cookiesMock, await signInAs("EDITOR"));

      await bulkSetPublished("news", ["a"], "yes" as unknown as boolean);

      expect(target.setPublished.execute).toHaveBeenCalledWith({ id: "a", isPublished: false });
      expect(testAuth.audit.entries.map((entry) => entry.action)).toEqual(["news.unpublish"]);
    });

    it("asks for no rebuild when nothing changed", async () => {
      cookieJar(cookiesMock, await signInAs("EDITOR"));
      target.setPublished.execute.mockRejectedValue(new NotFoundError("Faq not found"));

      const result = await bulkSetPublished("faq", ["a", "b"], true);

      expect(result).toMatchObject({ results: [{ ok: false }, { ok: false }] });
      expect(requestSiteRebuildMock).not.toHaveBeenCalled();
      expect(testAuth.audit.entries).toEqual([]);
    });

    it("refuses a bad kind, no ids, too many ids or a non-list, without touching anything", async () => {
      cookieJar(cookiesMock, await signInAs("EDITOR"));

      expect(await bulkSetPublished("forum", ["a"], true)).toEqual({ error: "El tipo de elemento no es válido." });
      for (const ids of [[], "a", null, Array.from({ length: 51 }, (_, index) => `id-${index}`)]) {
        expect(await bulkSetPublished("faq", ids as string[], true)).toEqual({ error: "Elija entre 1 y 50 elementos." });
      }
      expect(target.setPublished.execute).not.toHaveBeenCalled();
      expect(testAuth.audit.entries).toEqual([]);
    });

    it("processes a repeated id once", async () => {
      cookieJar(cookiesMock, await signInAs("EDITOR"));

      await bulkSetPublished("faq", ["a", "a"], true);

      expect(target.setPublished.execute).toHaveBeenCalledTimes(1);
      expect(auditedIds()).toEqual(["a"]);
    });
  });

  describe("bulkTrash", () => {
    it("moves each item to the trash with its own audit entry, and refreshes the list and the trash", async () => {
      cookieJar(cookiesMock, await signInAs("EDITOR"));

      const result = await bulkTrash("event", ["a", "b"]);

      expect(result).toEqual({ results: [{ id: "a", ok: true }, { id: "b", ok: true }] });
      expect(audited().map((entry) => [entry.action, entry.entityType, entry.entityId])).toEqual([
        ["event.trash", "event", "a"],
        ["event.trash", "event", "b"],
      ]);
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/events");
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/papelera");
    });

    it("asks for a rebuild only when a trashed item was visible on the site", async () => {
      cookieJar(cookiesMock, await signInAs("EDITOR"));
      target.trash.execute.mockResolvedValue({ wasPublished: false });

      await bulkTrash("event", ["a", "b"]);
      expect(requestSiteRebuildMock).not.toHaveBeenCalled();

      target.trash.execute.mockResolvedValueOnce({ wasPublished: false }).mockResolvedValueOnce({ wasPublished: true });
      await bulkTrash("event", ["c", "d"]);
      expect(requestSiteRebuildMock).toHaveBeenCalledTimes(1);
    });

    it("reports an item that is already gone and audits the others", async () => {
      cookieJar(cookiesMock, await signInAs("EDITOR"));
      target.trash.execute.mockResolvedValueOnce({ wasPublished: true }).mockRejectedValueOnce(new NotFoundError("Event not found"));

      const result = await bulkTrash("event", ["a", "gone"]);

      expect(result).toEqual({ results: [{ id: "a", ok: true }, { id: "gone", ok: false, error: "No se encontró el evento o la foto." }] });
      expect(auditedIds()).toEqual(["a"]);
    });
  });
});
