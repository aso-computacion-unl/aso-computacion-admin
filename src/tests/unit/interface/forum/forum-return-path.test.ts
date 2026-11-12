import { describe, expect, it } from "vitest";

import { FORUM_RETURN_PATH_MAX_LENGTH, forumSignInHref, isRegistrationReturnPath, parseForumReturnPath } from "@/interface/forum/forum-return-path";

describe("parseForumReturnPath", () => {
  it.each(["/foro", "/foro/hilo/abc123", "/foro/c/programacion?estado=resueltos&pagina=2", "/foro/eventos/hackathon-2026", "/foro/authors"])("keeps the same-origin forum path %s", (path) => {
    expect(parseForumReturnPath(path)).toBe(path);
  });

  it.each(["/inscripciones/taller-git", "/inscripciones/taller-git?utm_source=landing", "/inscripciones/a%20b"])("keeps the same-origin event registration path %s", (path) => {
    expect(parseForumReturnPath(path)).toBe(path);
  });

  it.each(["/inscripciones", "/inscripciones?utm_source=landing"])("S1: keeps the list of registrations %s, where the header's sign-in starts", (path) => {
    expect(parseForumReturnPath(path)).toBe(path);
  });

  it("normalizes dot segments that stay inside the forum and drops a fragment", () => {
    expect(parseForumReturnPath("/foro/c/./programacion")).toBe("/foro/c/programacion");
    expect(parseForumReturnPath("/foro/c/x/../y#respuesta")).toBe("/foro/c/y");
  });

  it.each([undefined, null, ""])("ignores a missing value (%s)", (value) => {
    expect(parseForumReturnPath(value)).toBeNull();
  });

  it.each([
    ["an absolute external URL", "https://evil.example/foro/hilo/1"],
    ["a scheme-relative URL", "//evil.example/foro/x"],
    ["a scheme without slashes", "javascript:alert(1)"],
    ["a relative path without the leading slash", "foro/hilo/1"],
    ["a backslash", "/foro\\evil.example"],
    ["a backslash after the prefix", "/foro/c\\..\\..\\admin"],
    ["a double slash after the prefix", "/foro//evil.example"],
    ["a path outside the forum", "/admin"],
    ["the admin area", "/admin/foro"],
    ["a look-alike prefix", "/foroadmin"],
    ["the forum root with a query", "/foro?error=failed"],
    ["dot segments that leave the forum", "/foro/../admin"],
    ["encoded dot segments that leave the forum", "/foro/%2e%2e/admin"],
    ["an encoded slash", "/foro/%2f%2fevil.example"],
    ["an encoded backslash", "/foro/%5Cevil.example"],
    ["an encoded percent (double encoding)", "/foro/%252e%252e/admin"],
    ["an encoded control character", "/foro/hilo/1%0d%0aSet-Cookie:x=1"],
    ["a raw newline", "/foro/hilo/1\nx"],
    ["a raw tab hiding a slash", "/foro/\t/evil.example"],
    ["a raw space", "/foro/hilo/1 x"],
    ["the registration root with a slash", "/inscripciones/"],
    ["a look-alike of the registration prefix", "/inscripcionesx/taller"],
    ["dot segments that leave the registration route", "/inscripciones/../admin"],
    ["encoded dot segments that leave the registration route", "/inscripciones/%2e%2e/admin"],
    ["a double slash after the registration prefix", "/inscripciones//evil.example"],
    ["a scheme-relative URL hidden in the query of the list", "/inscripciones?next=//evil.example"],
    ["a look-alike of the list with no slash", "/inscripcionesX"],
    ["dot segments from the registration pages into the forum auth routes", "/inscripciones/../foro/auth/google/start"],
    ["an encoded line break in the query of the list", "/inscripciones?%0d%0a"],
    ["a backslash after the registration prefix", "/inscripciones/x\\evil.example"],
    ["the OAuth start route", "/foro/auth/google/start"],
    ["the OAuth callback route", "/foro/auth/google/callback?code=c"],
    ["the auth namespace in other case", "/foro/AUTH/google/start"],
    ["the auth namespace root", "/foro/auth"],
    ["an auth path reached through dot segments", "/foro/c/../auth/google/start"],
  ])("ignores %s", (_label, value) => {
    expect(parseForumReturnPath(value)).toBeNull();
  });

  it("accepts up to the maximum length and ignores anything longer", () => {
    const prefix = "/foro/hilo/";

    expect(parseForumReturnPath(prefix + "a".repeat(FORUM_RETURN_PATH_MAX_LENGTH - prefix.length))).not.toBeNull();
    expect(parseForumReturnPath(prefix + "a".repeat(FORUM_RETURN_PATH_MAX_LENGTH - prefix.length + 1))).toBeNull();
  });
});

describe("forumSignInHref", () => {
  it("is the plain sign-in page without a path to return to", () => {
    expect(forumSignInHref()).toBe("/foro");
    expect(forumSignInHref("https://evil.example")).toBe("/foro");
  });

  it("carries a valid path as an encoded next parameter", () => {
    expect(forumSignInHref("/foro/hilo/abc")).toBe("/foro?next=%2Fforo%2Fhilo%2Fabc");
  });
});

describe("isRegistrationReturnPath", () => {
  it("S1: takes the list and an event's page as registration pages, so a failed sign-in is told there", () => {
    expect(isRegistrationReturnPath("/inscripciones")).toBe(true);
    expect(isRegistrationReturnPath("/inscripciones?utm_source=landing")).toBe(true);
    expect(isRegistrationReturnPath("/inscripciones/taller-git")).toBe(true);
  });

  it("leaves the forum and a look-alike out", () => {
    expect(isRegistrationReturnPath("/foro/hilo/abc")).toBe(false);
    expect(isRegistrationReturnPath("/inscripcionesx")).toBe(false);
    expect(isRegistrationReturnPath(null)).toBe(false);
  });
});
