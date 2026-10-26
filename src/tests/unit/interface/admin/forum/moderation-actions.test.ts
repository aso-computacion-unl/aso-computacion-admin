import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, revalidatePathMock } = vi.hoisted(() => ({ cookiesMock: vi.fn(), revalidatePathMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
}));

import { SESSION_EXPIRED_MESSAGE } from "@/interface/admin/action-result";
import * as actions from "@/interface/admin/forum/moderation-actions";
import { getAdminForumReports } from "@/interface/admin/forum/forum-moderation-read";
import { FORUM_COOKIE_NAME } from "@/infrastructure/forum/forum-session-jwt";
import { makeForumMember, makeForumReply, makeForumReport, makeForumThread } from "@/tests/fakes/in-memory-forum";
import { cookieJar, registerPolicyCases } from "@/tests/support/action-policy";
import { signInAs, testAuth } from "@/tests/support/test-auth";
import { signInToForumAs, testForum } from "@/tests/support/test-forum";

const ACTIONS_PATH = "src/interface/admin/forum/moderation-actions.ts";

// Fresh state on every call: the policy suite runs one action more than once in a test.
function world() {
  testForum.members.members.set("m1", makeForumMember({ id: "m1", email: "ana@unl.edu.ec", googleSub: "s1", displayName: "Ana" }));
  testForum.members.members.set("m2", makeForumMember({ id: "m2", email: "beto@unl.edu.ec", googleSub: "s2", displayName: "Beto" }));
  testForum.store.threads.set("t1", makeForumThread({ id: "t1", authorId: "m1" }));
  testForum.store.replies.set("r1", makeForumReply({ id: "r1", threadId: "t1", authorId: "m2" }));
  testForum.store.reports.set("p1", makeForumReport({ id: "p1", reporterId: "m2", threadId: "t1" }));
}

describe("forum moderation server actions", () => {
  describe("role matrix and audit", () => {
    registerPolicyCases({
      actionsPath: ACTIONS_PATH,
      actionCalls: {
        setForumThreadHidden: async () => (world(), actions.setForumThreadHidden("t1", true)),
        setForumReplyHidden: async () => (world(), actions.setForumReplyHidden("r1", true)),
        setForumThreadLocked: async () => (world(), actions.setForumThreadLocked("t1", true)),
        setForumMemberSuspended: async () => (world(), actions.setForumMemberSuspended("m1", true)),
        closeForumReport: async () => (world(), actions.closeForumReport("p1", "RESOLVED", "Ocultado")),
      },
      cookiesMock,
      untouchedMocks: [revalidatePathMock],
    });
  });

  describe("behaviour", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
      vi.stubEnv("FORUM_SESSION_SECRET", "forum-secret-forum-secret-forum-secret-1234");
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      world();
      cookieJar(cookiesMock, await signInAs("EDITOR"));
    });

    const audit = () => [...testAuth.audit.entries].reverse().map((entry) => [entry.action, entry.entityType, entry.entityId]);

    it("hides and shows a thread, audits each step and refreshes the queue", async () => {
      expect(await actions.setForumThreadHidden("t1", true)).toEqual({ success: true });
      expect(testForum.store.threads.get("t1")?.hiddenAt).not.toBeNull();
      expect(await actions.setForumThreadHidden("t1", false)).toEqual({ success: true });
      expect(testForum.store.threads.get("t1")?.hiddenAt).toBeNull();

      expect(audit()).toEqual([
        ["forum.thread.hide", "forum_thread", "t1"],
        ["forum.thread.unhide", "forum_thread", "t1"],
      ]);
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/foro/reportes");
    });

    it("hides and shows a reply, clearing it as the best answer", async () => {
      testForum.store.threads.set("t1", makeForumThread({ id: "t1", authorId: "m1", bestReplyId: "r1" }));

      expect(await actions.setForumReplyHidden("r1", true)).toEqual({ success: true });
      expect(testForum.store.threads.get("t1")?.bestReplyId).toBeNull();
      expect(await actions.setForumReplyHidden("r1", false)).toEqual({ success: true });

      expect(audit()).toEqual([
        ["forum.reply.hide", "forum_reply", "r1"],
        ["forum.reply.unhide", "forum_reply", "r1"],
      ]);
    });

    it("locks and unlocks a thread", async () => {
      expect(await actions.setForumThreadLocked("t1", true)).toEqual({ success: true });
      expect(testForum.store.threads.get("t1")?.lockedAt).not.toBeNull();
      expect(await actions.setForumThreadLocked("t1", false)).toEqual({ success: true });
      expect(testForum.store.threads.get("t1")?.lockedAt).toBeNull();

      expect(audit()).toEqual([
        ["forum.thread.lock", "forum_thread", "t1"],
        ["forum.thread.unlock", "forum_thread", "t1"],
      ]);
    });

    it("suspends a member, revokes their forum sessions, and reactivates them", async () => {
      const { sessionId } = await signInToForumAs({ id: "m1" });

      expect(await actions.setForumMemberSuspended("m1", true)).toEqual({ success: true });
      expect(testForum.members.members.get("m1")?.status).toBe("SUSPENDED");
      expect(testForum.sessions.sessions.get(sessionId)?.revokedAt).not.toBeNull();

      expect(await actions.setForumMemberSuspended("m1", false)).toEqual({ success: true });
      expect(testForum.members.members.get("m1")?.status).toBe("ACTIVE");
      expect(audit()).toEqual([
        ["forum.member.suspend", "forum_member", "m1"],
        ["forum.member.reactivate", "forum_member", "m1"],
      ]);
    });

    it("closes a report as resolved or dismissed with the moderator's id, and a second close is refused", async () => {
      expect(await actions.closeForumReport("p1", "RESOLVED", " Ocultado ")).toEqual({ success: true });
      expect(testForum.store.reports.get("p1")).toMatchObject({ status: "RESOLVED", resolvedBy: "test-editor", resolutionNote: "Ocultado" });

      expect(await actions.closeForumReport("p1", "DISMISSED")).toEqual({ error: "Otra persona ya cerró este reporte." });

      testForum.store.reports.set("p2", makeForumReport({ id: "p2", reporterId: "m1", threadId: "t1" }));
      expect(await actions.closeForumReport("p2", "DISMISSED")).toEqual({ success: true });
      expect(audit()).toEqual([
        ["forum.report.resolve", "forum_report", "p1"],
        ["forum.report.dismiss", "forum_report", "p2"],
      ]);
    });

    it("says in Spanish what is wrong, and stores and audits nothing", async () => {
      expect(await actions.closeForumReport("p1", "DISMISSED", "x".repeat(501))).toEqual({ fieldErrors: { note: "La nota admite hasta 500 caracteres." } });
      expect(await actions.closeForumReport("p1", "DELETED" as never)).toMatchObject({ fieldErrors: { outcome: expect.any(String) } });
      expect(testForum.store.reports.get("p1")?.status).toBe("OPEN");

      for (const result of [
        await actions.setForumThreadHidden("ghost", true),
        await actions.setForumReplyHidden("ghost", true),
        await actions.setForumThreadLocked("ghost", true),
        await actions.setForumMemberSuspended("ghost", true),
        await actions.closeForumReport("ghost", "DISMISSED"),
      ]) {
        expect(result).toEqual({ error: expect.stringMatching(/^No se encontr/) });
      }

      expect(testAuth.audit.entries).toEqual([]);
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });

    it("keeps emails, post bodies and reasons out of the audit entries", async () => {
      await actions.setForumMemberSuspended("m1", true);
      await actions.setForumThreadHidden("t1", true);
      await actions.closeForumReport("p1", "RESOLVED", "Nota privada");

      const text = JSON.stringify(testAuth.audit.entries);

      expect(text).not.toContain("@");
      expect(text).not.toContain("Nota privada");
      expect(text).not.toContain("Cuerpo");
    });
  });

  describe("who may moderate", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
      vi.stubEnv("FORUM_SESSION_SECRET", "forum-secret-forum-secret-forum-secret-1234");
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      world();
    });

    const everyAction = () => [
      actions.setForumThreadHidden("t1", true),
      actions.setForumReplyHidden("r1", true),
      actions.setForumThreadLocked("t1", true),
      actions.setForumMemberSuspended("m1", true),
      actions.closeForumReport("p1", "RESOLVED"),
    ];

    const untouched = () => {
      expect(testForum.store.threads.get("t1")).toMatchObject({ hiddenAt: null, lockedAt: null });
      expect(testForum.store.replies.get("r1")?.hiddenAt).toBeNull();
      expect(testForum.members.members.get("m1")?.status).toBe("ACTIVE");
      expect(testForum.store.reports.get("p1")?.status).toBe("OPEN");
      expect(testAuth.audit.entries).toEqual([]);
      expect(revalidatePathMock).not.toHaveBeenCalled();
    };

    it("refuses a visitor without a session: every action says the session expired and nothing is stored", async () => {
      cookieJar(cookiesMock, undefined);

      expect(await Promise.all(everyAction())).toEqual(Array(5).fill({ error: SESSION_EXPIRED_MESSAGE }));
      untouched();
    });

    it("refuses a forum member, even one holding a valid forum session: the cookie is not an admin session", async () => {
      const { cookie } = await signInToForumAs({ id: "m2" });
      cookiesMock.mockResolvedValue({ get: (name: string) => (name === FORUM_COOKIE_NAME ? { name, value: cookie } : undefined) });

      expect(await Promise.all(everyAction())).toEqual(Array(5).fill({ error: SESSION_EXPIRED_MESSAGE }));
      untouched();
    });

    it("lists the queue for an editor and an admin, and sends a visitor to the login", async () => {
      cookieJar(cookiesMock, await signInAs("EDITOR"));
      expect((await getAdminForumReports({ status: "open", page: 1 })).items.map((item) => item.id)).toEqual(["p1"]);
      cookieJar(cookiesMock, await signInAs("ADMIN"));
      expect((await getAdminForumReports({ status: "closed", page: 1 })).items).toEqual([]);

      cookieJar(cookiesMock, undefined);
      await expect(getAdminForumReports({ status: "open", page: 1 })).rejects.toThrow("REDIRECT /login");
    });
  });
});
