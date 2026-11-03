import { describe, expect, it, vi } from "vitest";

import { inviteTokens } from "@/infrastructure/auth/invite-token";
import { getInvitationForLink } from "@/interface/auth/invitation-read";
import { makeInvite } from "@/tests/fakes/in-memory-auth";
import { testAuth } from "@/tests/support/test-auth";

const TOKEN = inviteTokens.generate();
const HOUR = 60 * 60 * 1000;

const store = (overrides: Parameters<typeof makeInvite>[0] = {}) =>
  testAuth.invites.create(
    makeInvite({ tokenHash: inviteTokens.hash(TOKEN), createdAt: new Date(Date.now() - HOUR), expiresAt: new Date(Date.now() + HOUR), ...overrides }),
  );

describe("getInvitationForLink", () => {
  it("shows the invited email and role of a pending invite, and nothing else", async () => {
    await store({ email: "ben@example.org", role: "ADMIN" });

    expect(await getInvitationForLink(TOKEN)).toEqual({ email: "ben@example.org", role: "ADMIN" });
  });

  it.each([
    ["used", { usedAt: new Date(), usedByUserId: "x" }],
    ["revoked", { revokedAt: new Date() }],
    ["expired", { expiresAt: new Date(Date.now() - 1000) }],
  ])("is null for a %s invite, the same as for an unknown token", async (_label, overrides) => {
    await store(overrides);

    expect(await getInvitationForLink(TOKEN)).toBeNull();
    expect(await getInvitationForLink(inviteTokens.generate())).toBeNull();
  });

  it("does not look up a value that is not shaped like a token", async () => {
    const lookup = vi.spyOn(testAuth.services.lookupInvite, "execute");

    expect(await getInvitationForLink("not-a-token")).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });
});
