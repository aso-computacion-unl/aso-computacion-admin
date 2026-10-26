import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { FORBIDDEN_MESSAGE } from "@/interface/admin/action-result";
import { guardsOfEveryAction } from "@/tests/support/guard-first";
import { signInAs, testAuth } from "@/tests/support/test-auth";

type Role = "ADMIN" | "EDITOR";

/**
 * The authorization and audit policy of every server action, in one place. EDITOR: create, edit,
 * publish, reorder, trash and restore content. ADMIN only: settings, permanent deletion, users,
 * other people's sessions and the audit log. `audit` is the entry the action writes on success.
 * A new action fails its suite until it has a row here.
 */
export const ACTION_POLICY: Record<string, Record<string, { role: Role; audit: string }>> = {
  "src/interface/admin/events/actions.ts": {
    createEvent: { role: "EDITOR", audit: "event.create" },
    updateEvent: { role: "EDITOR", audit: "event.update" },
    setEventPublished: { role: "EDITOR", audit: "event.publish" },
    trashEvent: { role: "EDITOR", audit: "event.trash" },
    uploadEventPhoto: { role: "EDITOR", audit: "event.photo_add" },
    updateEventPhotoAlt: { role: "EDITOR", audit: "event.photo_alt" },
    moveEventPhoto: { role: "EDITOR", audit: "event.photo_move" },
    deactivateEventPhoto: { role: "EDITOR", audit: "event.photo_remove" },
  },
  "src/interface/admin/news/actions.ts": {
    createNewsItem: { role: "EDITOR", audit: "news.create" },
    updateNewsItem: { role: "EDITOR", audit: "news.update" },
    setNewsItemPublished: { role: "EDITOR", audit: "news.publish" },
    trashNewsItem: { role: "EDITOR", audit: "news.trash" },
    uploadNewsCover: { role: "EDITOR", audit: "news.cover_set" },
    removeNewsCover: { role: "EDITOR", audit: "news.cover_remove" },
  },
  "src/interface/admin/board/actions.ts": {
    createBoardMember: { role: "EDITOR", audit: "board.create" },
    updateBoardMember: { role: "EDITOR", audit: "board.update" },
    setBoardMemberPublished: { role: "EDITOR", audit: "board.publish" },
    trashBoardMember: { role: "EDITOR", audit: "board.trash" },
    moveBoardMember: { role: "EDITOR", audit: "board.move" },
    uploadBoardMemberPhoto: { role: "EDITOR", audit: "board.photo_set" },
    removeBoardMemberPhoto: { role: "EDITOR", audit: "board.photo_remove" },
  },
  "src/interface/admin/faqs/actions.ts": {
    createFaq: { role: "EDITOR", audit: "faq.create" },
    updateFaq: { role: "EDITOR", audit: "faq.update" },
    setFaqPublished: { role: "EDITOR", audit: "faq.publish" },
    trashFaq: { role: "EDITOR", audit: "faq.trash" },
    moveFaq: { role: "EDITOR", audit: "faq.move" },
  },
  "src/interface/admin/pillars/actions.ts": {
    createPillar: { role: "EDITOR", audit: "pillar.create" },
    updatePillar: { role: "EDITOR", audit: "pillar.update" },
    setPillarPublished: { role: "EDITOR", audit: "pillar.publish" },
    trashPillar: { role: "EDITOR", audit: "pillar.trash" },
    movePillar: { role: "EDITOR", audit: "pillar.move" },
    uploadPillarImage: { role: "EDITOR", audit: "pillar.image_set" },
    removePillarImage: { role: "EDITOR", audit: "pillar.image_remove" },
  },
  "src/interface/admin/socials/actions.ts": {
    createSocialLink: { role: "EDITOR", audit: "social.create" },
    updateSocialLink: { role: "EDITOR", audit: "social.update" },
    setSocialLinkPublished: { role: "EDITOR", audit: "social.publish" },
    trashSocialLink: { role: "EDITOR", audit: "social.trash" },
    moveSocialLink: { role: "EDITOR", audit: "social.move" },
  },
  "src/interface/admin/commands/actions.ts": {
    createCommand: { role: "EDITOR", audit: "command.create" },
    updateCommand: { role: "EDITOR", audit: "command.update" },
    setCommandPublished: { role: "EDITOR", audit: "command.publish" },
    trashCommand: { role: "EDITOR", audit: "command.trash" },
    moveCommand: { role: "EDITOR", audit: "command.move" },
  },
  "src/interface/admin/settings/actions.ts": {
    updateSiteSettings: { role: "ADMIN", audit: "settings.update" },
  },
  "src/interface/admin/trash/actions.ts": {
    restoreTrashed: { role: "EDITOR", audit: "faq.restore" },
    purgeTrashed: { role: "ADMIN", audit: "faq.purge" },
  },
  "src/interface/admin/users/actions.ts": {
    inviteUser: { role: "ADMIN", audit: "user.invite" },
    changeUserRole: { role: "ADMIN", audit: "user.role_change" },
    setUserActive: { role: "ADMIN", audit: "user.deactivate" },
  },
  "src/interface/admin/sessions/actions.ts": {
    // Anyone may revoke their own sessions; revoking someone else's takes ADMIN (checked by the use case).
    revokeSession: { role: "EDITOR", audit: "session.revoke" },
  },
};

export function cookieJar(cookiesMock: Mock, value: string | undefined) {
  cookiesMock.mockResolvedValue({ get: (name: string) => (name === "admin_session" && value !== undefined ? { name, value } : undefined) });
}

export interface PolicySuite {
  /** Repository-relative path of the actions module. */
  actionsPath: string;
  actionCalls: Record<string, () => Promise<unknown>>;
  cookiesMock: Mock;
  /** Mocks that must stay untouched when the role is refused (container, use cases, cache, navigation). */
  untouchedMocks: Mock[];
}

/** An action that ends in `redirect()` throws it; for these cases that is a normal end. */
async function outcomeOf(call: () => Promise<unknown>): Promise<unknown> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof Error && error.message === "REDIRECT") return undefined;
    throw error;
  }
}

/** Registers, inside the caller's describe, the role matrix and audit cases for one actions module. */
export function registerPolicyCases(suite: PolicySuite): void {
  const policy = ACTION_POLICY[suite.actionsPath] ?? {};
  const names = Object.keys(suite.actionCalls).sort();
  const adminOnly = names.filter((name) => policy[name]?.role === "ADMIN");
  const editorLevel = names.filter((name) => policy[name]?.role === "EDITOR");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SECRET", "test-secret-test-secret-test-secret-1234");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("the policy table covers every action, and each action's guard is the one the table says", () => {
    const guards = guardsOfEveryAction(suite.actionsPath);

    expect(Object.keys(policy).sort()).toEqual(names);
    expect(Object.fromEntries(Object.entries(guards).map(([name, guard]) => [name, guard === 'requireRole("ADMIN")' ? "ADMIN" : "EDITOR"]))).toEqual(
      Object.fromEntries(names.map((name) => [name, policy[name]?.role])),
    );
  });

  describe.each(adminOnly)("%s (ADMIN only)", (name) => {
    const call = () => suite.actionCalls[name]!();

    it("is refused for an EDITOR: forbidden, no write, nothing recorded", async () => {
      cookieJar(suite.cookiesMock, await signInAs("EDITOR"));

      expect(await outcomeOf(call)).toEqual({ error: FORBIDDEN_MESSAGE });
      for (const mock of suite.untouchedMocks) expect(mock).not.toHaveBeenCalled();
      expect(testAuth.audit.entries).toEqual([]);
    });
  });

  describe.each(names)("%s", (name) => {
    const call = () => suite.actionCalls[name]!();
    const expectedAudit = policy[name]?.audit;

    it("records its audit entry for an ADMIN, attributed to them", async () => {
      cookieJar(suite.cookiesMock, await signInAs("ADMIN"));

      await outcomeOf(call);

      expect(testAuth.audit.entries.map((entry) => [entry.action, entry.actorKind, entry.actorUserId])).toEqual([[expectedAudit, "user", "test-admin"]]);
    });
  });

  describe.each(editorLevel)("%s (EDITOR allowed)", (name) => {
    const call = () => suite.actionCalls[name]!();

    it("is allowed for an EDITOR and recorded under their id", async () => {
      cookieJar(suite.cookiesMock, await signInAs("EDITOR"));

      const result = await outcomeOf(call);

      expect(result).not.toEqual({ error: FORBIDDEN_MESSAGE });
      expect(testAuth.audit.entries.map((entry) => [entry.action, entry.actorUserId])).toEqual([[policy[name]?.audit, "test-editor"]]);
    });
  });

  it("attributes an emergency session's actions to break_glass, with no user id", async () => {
    cookieJar(suite.cookiesMock, await signInAs("break_glass"));

    await outcomeOf(suite.actionCalls[names[0]!]!);

    expect(testAuth.audit.entries.map((entry) => [entry.actorKind, entry.actorUserId])).toEqual([["break_glass", null]]);
  });

  it("an audit failure does not change what the action returns", async () => {
    const name = names[0]!;
    cookieJar(suite.cookiesMock, await signInAs("ADMIN"));
    const withAudit = await outcomeOf(suite.actionCalls[name]!);

    testAuth.audit.entries.length = 0;
    testAuth.audit.failWith = new Error("db down");
    cookieJar(suite.cookiesMock, await signInAs("ADMIN"));

    expect(await outcomeOf(suite.actionCalls[name]!)).toEqual(withAudit);
    expect(testAuth.audit.entries).toEqual([]);
  });
}
