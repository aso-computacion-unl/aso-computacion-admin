// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { routerMock, signOutMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
  signOutMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/interface/forum/forum-posting", () => ({ signOutOfForum: signOutMock }));

import { clearForumDrafts, readDraft, replyDraftKey, threadDraftKey, writeDraft } from "../../../../app/foro/_components/forum-drafts";
import { SignOutButton } from "../../../../app/_components/member-sign-out-button";
import { click, mount, settle, unmountAll } from "@/tests/support/dom";

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

afterEach(async () => {
  await unmountAll();
});

describe("forum drafts (D5)", () => {
  it("gives back what was saved, field by field", () => {
    writeDraft(threadDraftKey("programacion"), "m1", { title: "Duda", body: "Texto" });

    expect(readDraft(threadDraftKey("programacion"), ["title", "body"], "m1")).toEqual({ title: "Duda", body: "Texto" });
    expect(readDraft(threadDraftKey("materias"), ["title", "body"], "m1")).toBeNull();
  });

  it("gives it back only to the member who typed it, and drops it for anyone else", () => {
    writeDraft(replyDraftKey("t1"), "m1", { body: "algo" });

    expect(readDraft(replyDraftKey("t1"), ["body"], "m2")).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
    expect(readDraft(replyDraftKey("t1"), ["body"], "m1")).toBeNull();
  });

  it("gives nothing, and keeps nothing, when there is no member", () => {
    writeDraft(replyDraftKey("t1"), "m1", { body: "algo" });

    expect(readDraft(replyDraftKey("t1"), ["body"], null)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);

    writeDraft(replyDraftKey("t1"), null, { body: "algo" });

    expect(window.sessionStorage.length).toBe(0);
  });

  it("forgets a draft that went blank, and ignores one that is not the form's fields, has no owner or is not JSON", () => {
    writeDraft(replyDraftKey("t1"), "m1", { body: "algo" });
    writeDraft(replyDraftKey("t1"), "m1", { body: "  " });

    expect(window.sessionStorage.length).toBe(0);

    window.sessionStorage.setItem(replyDraftKey("t2"), JSON.stringify({ memberId: "m1", values: { title: "otro formulario" } }));
    window.sessionStorage.setItem(replyDraftKey("t3"), "{no es json");
    // The shape before drafts had an owner: it cannot be tied to anyone, so it is not given to anyone.
    window.sessionStorage.setItem(replyDraftKey("t4"), JSON.stringify({ body: "sin dueño" }));

    expect(readDraft(replyDraftKey("t2"), ["body"], "m1")).toBeNull();
    expect(readDraft(replyDraftKey("t3"), ["body"], "m1")).toBeNull();
    expect(readDraft(replyDraftKey("t4"), ["body"], "m1")).toBeNull();
  });

  it("clears every draft of the tab and nothing else", () => {
    writeDraft(threadDraftKey("programacion"), "m1", { title: "Duda", body: "Texto" });
    writeDraft(replyDraftKey("t1"), "m1", { body: "algo" });
    window.sessionStorage.setItem("theme", "dark");

    clearForumDrafts();

    expect(window.sessionStorage.length).toBe(1);
    expect(window.sessionStorage.getItem("theme")).toBe("dark");
  });

  it("is dropped by the sign-out, so the next person on the machine does not find it", async () => {
    signOutMock.mockResolvedValue({ success: true });
    writeDraft(replyDraftKey("t1"), "m1", { body: "algo a medias" });
    const host = await mount(createElement(SignOutButton));

    await click(host.querySelector("button")!);
    await settle();

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("is dropped even when the sign-out call fails, so a failed call never leaves the text for the next person", async () => {
    signOutMock.mockRejectedValue(new Error("network"));
    writeDraft(replyDraftKey("t1"), "m1", { body: "algo a medias" });
    const host = await mount(createElement(SignOutButton));

    // The failure is not swallowed (React rethrows it to the error boundary); the drafts are gone all the same.
    await expect(
      (async () => {
        await click(host.querySelector("button")!);
        await settle();
      })(),
    ).rejects.toThrow("network");

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(window.sessionStorage.length).toBe(0);
  });
});
