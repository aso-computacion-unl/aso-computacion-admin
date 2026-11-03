import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain/domain-error";
import {
  assertCanEditPost,
  assertCanPost,
  assertThreadAcceptsReplies,
  FORUM_MEMBER_NAME_MAX_LENGTH,
  ForumMemberSuspendedError,
  ForumPostNotOwnedError,
  ForumThreadLockedError,
  parseCategoryDescription,
  parseCategoryName,
  parseDisplayName,
  parseReplyBody,
  parseThreadBody,
  parseThreadTitle,
  type ForumMember,
  type ForumThread,
} from "@/domain/forum";

const member = (overrides: Partial<ForumMember> = {}): ForumMember => ({
  id: "m1",
  email: "ana@unl.edu.ec",
  googleSub: "sub-1",
  displayName: "Ana",
  status: "ACTIVE",
  suspendedAt: null,
  createdAt: new Date("2026-10-26T00:00:00.000Z"),
  lastLoginAt: null,
  ...overrides,
});

const thread = (overrides: Partial<ForumThread> = {}): ForumThread => ({
  id: "t1",
  categoryId: "c1",
  authorId: "m1",
  title: "Duda",
  body: "Cuerpo",
  createdAt: new Date("2026-10-26T00:00:00.000Z"),
  updatedAt: new Date("2026-10-26T00:00:00.000Z"),
  editedAt: null,
  lastActivityAt: new Date("2026-10-26T00:00:00.000Z"),
  lockedAt: null,
  hiddenAt: null,
  bestReplyId: null,
  ...overrides,
});

describe("parseDisplayName", () => {
  it("keeps a plain name, collapsing whitespace", () => {
    expect(parseDisplayName("  Ana   María  Pérez ", "m1")).toBe("Ana María Pérez");
  });

  it("strips control and direction-override characters", () => {
    expect(parseDisplayName("Ana\u202E\u0007 Pérez\u0000", "m1")).toBe("Ana Pérez");
  });

  it("caps the length", () => {
    expect(parseDisplayName("a".repeat(200), "m1")).toHaveLength(FORUM_MEMBER_NAME_MAX_LENGTH);
  });

  it.each([undefined, "", "   ", "ana@unl.edu.ec"])("falls back to a neutral name for %j, never to an address", (raw) => {
    expect(parseDisplayName(raw, "abcd1234")).toBe("Estudiante abcd");
  });
});

describe("thread and reply text", () => {
  it("trims and requires a title of 1 to 120 characters", () => {
    expect(parseThreadTitle("  ¿Cómo empiezo?  ")).toBe("¿Cómo empiezo?");
    expect(() => parseThreadTitle("   ")).toThrow(ValidationError);
    expect(() => parseThreadTitle("x".repeat(121))).toThrow(ValidationError);
  });

  it("requires a thread body of 1 to 10000 characters and a reply body of 1 to 5000", () => {
    expect(parseThreadBody("x".repeat(10000))).toHaveLength(10000);
    expect(() => parseThreadBody("x".repeat(10001))).toThrow(ValidationError);
    expect(parseReplyBody("x".repeat(5000))).toHaveLength(5000);
    expect(() => parseReplyBody("x".repeat(5001))).toThrow(ValidationError);
    expect(() => parseReplyBody("")).toThrow(ValidationError);
  });

  it("refuses a NUL character, which Postgres cannot store", () => {
    expect(() => parseReplyBody("hola\u0000")).toThrow(ValidationError);
  });

  it("normalises Windows line endings", () => {
    expect(parseReplyBody("uno\r\ndos")).toBe("uno\ndos");
  });
});

describe("category text", () => {
  it("requires a name of 1 to 60 characters and an optional description of at most 200", () => {
    expect(parseCategoryName(" Programación ")).toBe("Programación");
    expect(() => parseCategoryName("x".repeat(61))).toThrow(ValidationError);
    expect(parseCategoryDescription("  ")).toBeNull();
    expect(parseCategoryDescription(undefined)).toBeNull();
    expect(() => parseCategoryDescription("x".repeat(201))).toThrow(ValidationError);
  });
});

describe("what a member may do", () => {
  it("lets an active member post and refuses a suspended one", () => {
    expect(() => assertCanPost(member())).not.toThrow();
    expect(() => assertCanPost(member({ status: "SUSPENDED", suspendedAt: new Date() }))).toThrow(ForumMemberSuspendedError);
  });

  it("refuses replies to a locked thread, ", () => {
    expect(() => assertThreadAcceptsReplies(thread())).not.toThrow();
    expect(() => assertThreadAcceptsReplies(thread({ lockedAt: new Date() }))).toThrow(ForumThreadLockedError);
  });

  it("lets only the author edit, and nobody edit a hidden post (it is out of the author's hands)", () => {
    expect(() => assertCanEditPost({ authorId: "m1", hiddenAt: null }, "m1")).not.toThrow();
    expect(() => assertCanEditPost({ authorId: "m1", hiddenAt: null }, "m2")).toThrow(ForumPostNotOwnedError);
    expect(() => assertCanEditPost({ authorId: "m1", hiddenAt: new Date() }, "m1")).toThrow(ForumPostNotOwnedError);
  });
});
