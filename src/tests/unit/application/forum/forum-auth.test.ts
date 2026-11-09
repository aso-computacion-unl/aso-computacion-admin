import { beforeEach, describe, expect, it } from "vitest";

import { CheckForumSuspensionUseCase, CloseForumSessionUseCase, FORUM_SESSION_TTL_MS, OpenForumSessionUseCase, ResolveForumLoginUseCase, ValidateForumSessionUseCase } from "@/application/forum/forum-auth.use-cases";
import { InMemoryForumMemberRepository, InMemoryForumSessionRepository, makeForumMember } from "@/tests/fakes/in-memory-forum";

const NOW = new Date("2026-10-26T12:00:00.000Z");
const identity = { email: "Ana.Perez@UNL.edu.ec", emailVerified: true, subject: "sub-ana", name: "Ana Pérez", hostedDomain: "unl.edu.ec" };

let members: InMemoryForumMemberRepository;
let login: ResolveForumLoginUseCase;

beforeEach(() => {
  members = new InMemoryForumMemberRepository();
  login = new ResolveForumLoginUseCase(members, { allowedDomain: "unl.edu.ec" }, () => NOW, () => "abcd-1234");
});

describe("ResolveForumLoginUseCase", () => {
  it("creates the member on the first login: lower-cased email, Google name, active, no sign-up step", async () => {
    const outcome = await login.execute(identity);

    expect(outcome).toMatchObject({ ok: true, member: { id: "abcd-1234", email: "ana.perez@unl.edu.ec", googleSub: "sub-ana", displayName: "Ana Pérez", status: "ACTIVE" } });
    expect(members.members.size).toBe(1);
    expect((await members.findById("abcd-1234"))?.lastLoginAt).toEqual(NOW);
  });

  it("recognises the member by Google sub on the next login and creates nothing", async () => {
    await login.execute(identity);
    const second = await login.execute({ ...identity, name: "Otro nombre" });

    expect(second).toMatchObject({ ok: true, member: { id: "abcd-1234", displayName: "Ana Pérez" } });
    expect(members.members.size).toBe(1);
  });

  it("never turns a missing name or an address into the public name", async () => {
    const outcome = await login.execute({ ...identity, name: undefined });

    expect(outcome).toMatchObject({ ok: true, member: { displayName: "Estudiante abcd" } });
  });

  it.each([
    ["an unverified email", { emailVerified: false }, "unverified"],
    ["an email outside the institutional domain", { email: "ana@gmail.com", hostedDomain: "unl.edu.ec" }, "domain"],
    ["a look-alike domain", { email: "ana@evil-unl.edu.ec" }, "domain"],
    ["a sub-domain", { email: "ana@mail.unl.edu.ec" }, "domain"],
    ["no hosted domain (a personal Google account with an institutional address)", { hostedDomain: undefined }, "domain"],
    ["a hosted domain that does not match", { hostedDomain: "gmail.com" }, "domain"],
    ["a token without a subject", { subject: undefined }, "no-subject"],
  ])("refuses %s and creates nobody", async (_label, override, reason) => {
    expect(await login.execute({ ...identity, ...override })).toEqual({ ok: false, reason });
    expect(members.members.size).toBe(0);
  });

  it("is disabled, for everybody, without an allowed domain", async () => {
    for (const allowedDomain of [undefined, "", "  "]) {
      const disabled = new ResolveForumLoginUseCase(members, { allowedDomain }, () => NOW);

      expect(await disabled.execute(identity)).toEqual({ ok: false, reason: "disabled" });
    }

    expect(members.members.size).toBe(0);
  });

  it("accepts the domain written with an @ or upper-case letters", async () => {
    const lenient = new ResolveForumLoginUseCase(members, { allowedDomain: "@UNL.edu.ec" }, () => NOW);

    expect((await lenient.execute(identity)).ok).toBe(true);
  });

  it("refuses a suspended member and does not record a login", async () => {
    members.members.set("m1", makeForumMember({ id: "m1", email: "ana.perez@unl.edu.ec", googleSub: "sub-ana", status: "SUSPENDED", suspendedAt: NOW }));

    expect(await login.execute(identity)).toEqual({ ok: false, reason: "suspended" });
    expect((await members.findById("m1"))?.lastLoginAt).toBeNull();
  });

  it("refuses a known email that arrives with another Google identity", async () => {
    members.members.set("m1", makeForumMember({ id: "m1", email: "ana.perez@unl.edu.ec", googleSub: "someone-else" }));

    expect(await login.execute(identity)).toEqual({ ok: false, reason: "identity-conflict" });
  });

  it("refuses an email that is not an address at all, as outside the domain", async () => {
    expect(await login.execute({ ...identity, email: "not-an-email" })).toEqual({ ok: false, reason: "domain" });
    expect(members.members.size).toBe(0);
  });

  it("signs in the member another request created at the same moment, instead of failing the second login", async () => {
    const winner = makeForumMember({ id: "winner", email: "ana.perez@unl.edu.ec", googleSub: "sub-ana" });

    // The competing first login lands between our lookup and our insert.
    members.create = async () => {
      members.members.set(winner.id, winner);

      return false;
    };

    expect(await login.execute(identity)).toMatchObject({ ok: true, member: { id: "winner" } });
    expect(members.members.size).toBe(1);
  });

  it("refuses the login when the insert lost the race and nobody holds that Google identity", async () => {
    members.create = async () => false;

    expect(await login.execute(identity)).toEqual({ ok: false, reason: "identity-conflict" });
  });
});

describe("forum sessions", () => {
  let sessions: InMemoryForumSessionRepository;
  let clock: Date;
  let ids: number;

  const open = () => new OpenForumSessionUseCase(sessions, () => clock, () => `session-${(ids += 1)}`);
  const validate = () => new ValidateForumSessionUseCase(sessions, () => clock);

  beforeEach(() => {
    members.members.set("m1", makeForumMember({ id: "m1" }));
    sessions = new InMemoryForumSessionRepository(members);
    clock = NOW;
    ids = 0;
  });

  it("opens a session that lasts seven days, truncating the user agent and replacing the presented one", async () => {
    const first = await open().execute({ memberId: "m1", userAgent: "x".repeat(300), ipHash: "hash" });
    const second = await open().execute({ memberId: "m1", replaces: first.sessionId });

    expect(first.expiresAt.getTime() - NOW.getTime()).toBe(FORUM_SESSION_TTL_MS);
    expect(sessions.sessions.get(first.sessionId)).toMatchObject({ memberId: "m1", ipHash: "hash", revokedAt: NOW });
    expect(sessions.sessions.get(first.sessionId)?.userAgent).toHaveLength(200);
    expect(sessions.sessions.get(second.sessionId)?.revokedAt).toBeNull();
  });

  it("validates a live session into the actor: member id, session id and public name, never the email", async () => {
    const { sessionId } = await open().execute({ memberId: "m1" });

    const actor = await validate().execute({ sessionId, memberId: "m1" });

    expect(actor).toEqual({ memberId: "m1", sessionId, displayName: "Ana" });
  });

  it.each([
    ["an unknown session", async () => "ghost", "m1"],
    ["a session of another member", async () => (await open().execute({ memberId: "m1" })).sessionId, "m2"],
  ])("refuses %s", async (_label, session, memberId) => {
    members.members.set("m2", makeForumMember({ id: "m2", email: "b@unl.edu.ec", googleSub: "sub-b" }));

    expect(await validate().execute({ sessionId: await session(), memberId })).toBeNull();
  });

  it("refuses a revoked session and an expired one", async () => {
    const revoked = await open().execute({ memberId: "m1" });
    await sessions.revoke(revoked.sessionId, NOW);
    const expiring = await open().execute({ memberId: "m1" });
    clock = new Date(NOW.getTime() + FORUM_SESSION_TTL_MS);

    expect(await validate().execute({ sessionId: revoked.sessionId, memberId: "m1" })).toBeNull();
    expect(await validate().execute({ sessionId: expiring.sessionId, memberId: "m1" })).toBeNull();
  });

  it("refuses the session of a suspended member on the next request", async () => {
    const { sessionId } = await open().execute({ memberId: "m1" });
    members.members.set("m1", makeForumMember({ id: "m1", status: "SUSPENDED", suspendedAt: NOW }));

    expect(await validate().execute({ sessionId, memberId: "m1" })).toBeNull();
  });

  it("rewrites lastSeenAt at most once a minute", async () => {
    const { sessionId } = await open().execute({ memberId: "m1" });

    await validate().execute({ sessionId, memberId: "m1" });
    clock = new Date(NOW.getTime() + 61_000);
    await validate().execute({ sessionId, memberId: "m1" });

    expect(sessions.touched).toEqual([sessionId]);
  });

  it("closes a session once", async () => {
    const { sessionId } = await open().execute({ memberId: "m1" });
    const close = new CloseForumSessionUseCase(sessions, () => clock);

    await close.execute({ sessionId });
    await close.execute({ sessionId });

    expect(sessions.sessions.get(sessionId)?.revokedAt).toEqual(NOW);
    expect(await validate().execute({ sessionId, memberId: "m1" })).toBeNull();
  });
});

describe("CheckForumSuspensionUseCase (D1)", () => {
  let sessions: InMemoryForumSessionRepository;

  const check = (input: { sessionId: string; memberId: string }) => new CheckForumSuspensionUseCase(sessions).execute(input);
  const suspend = (id: string) => members.members.set(id, makeForumMember({ id, status: "SUSPENDED", suspendedAt: NOW }));

  beforeEach(() => {
    members.members.set("m1", makeForumMember({ id: "m1" }));
    sessions = new InMemoryForumSessionRepository(members);
  });

  it("is true for the session of a suspended member, also once the suspension closed that session", async () => {
    const { sessionId } = await new OpenForumSessionUseCase(sessions, () => NOW, () => "s1").execute({ memberId: "m1" });

    suspend("m1");
    expect(await check({ sessionId, memberId: "m1" })).toBe(true);

    await sessions.revoke(sessionId, NOW);
    expect(await check({ sessionId, memberId: "m1" })).toBe(true);
  });

  it("is false for an active member, a reactivated one, an unknown session, and a session of somebody else", async () => {
    const { sessionId } = await new OpenForumSessionUseCase(sessions, () => NOW, () => "s1").execute({ memberId: "m1" });
    members.members.set("m2", makeForumMember({ id: "m2", email: "b@unl.edu.ec", googleSub: "sub-b" }));
    suspend("m2");

    expect(await check({ sessionId, memberId: "m1" })).toBe(false);
    expect(await check({ sessionId: "ghost", memberId: "m1" })).toBe(false);
    // The cookie names a session of m1 and claims to be m2, who is suspended: the claim does not count.
    expect(await check({ sessionId, memberId: "m2" })).toBe(false);

    suspend("m1");
    members.members.set("m1", makeForumMember({ id: "m1" }));
    expect(await check({ sessionId, memberId: "m1" })).toBe(false);
  });
});
