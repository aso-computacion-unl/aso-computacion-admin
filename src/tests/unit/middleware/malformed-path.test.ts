import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TEST_SECRET, buildRequest, signTestToken } from "./support";

// A fresh middleware module per test: the session secret "reported once" latch lives in the module graph.
let proxy: typeof import("../../../../proxy").proxy;

// `new URL()` keeps a malformed percent escape as written, which is what Next hands the middleware.
const MALFORMED_PAGES = ["/foro/eventos/%E0%A4%A", "/foro/hilo/%E0%A4%A", "/foro/c/%E0%A4%A/nuevo", "/invitacion/%E0%A4%A", "/admin/events/%E0%A4%A/edit", "/admin/%"];
const MALFORMED_API = ["/api/public/events/%E0%A4%A/calendar.ics", "/api/public/events/%E0%A4%A/registrations", "/api/admin/%E0%A4%A"];
const WELL_FORMED_PUBLIC = [
  "/foro",
  "/foro/eventos/x",
  "/foro/eventos/a%20b",
  "/foro/hilo/x",
  "/foro/c/x/nuevo",
  "/invitacion/x",
  "/api/public/events/x/calendar.ics",
  "/api/public/events/x/registrations",
  "/api/public/events/seats",
  "/login",
  "/api/health",
];

beforeEach(async () => {
  vi.resetModules();
  ({ proxy } = await import("../../../../proxy"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("middleware: undecodable paths", () => {
  it.each(MALFORMED_PAGES)("BAD-001: %s answers a text/html 400", async (path) => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);

    const response = await proxy(buildRequest(path));

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toBe("<h1>Bad request</h1>");
  });

  it.each(MALFORMED_API)("BAD-002: %s answers a JSON 400", async (path) => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);

    const response = await proxy(buildRequest(path));

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "Bad request" });
  });

  it.each([...MALFORMED_PAGES, ...MALFORMED_API])("BAD-003: %s answers 400 even with a missing or invalid secret", async (path) => {
    for (const secret of [undefined, "short"]) {
      vi.stubEnv("ADMIN_SECRET", secret);

      const response = await proxy(buildRequest(path));

      expect(response.status, `${path} with secret ${String(secret)}`).toBe(400);
    }
  });

  it("BAD-004: a malformed path under /admin is a 400 before the session check, even with a valid cookie", async () => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);

    const response = await proxy(buildRequest("/admin/events/%E0%A4%A/edit", await signTestToken(86400)));

    expect(response.status).toBe(400);
  });
});

describe("middleware: public paths are not auth-guarded", () => {
  it.each(WELL_FORMED_PUBLIC)("PUB-001: %s passes through with no cookie and a valid secret", async (path) => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);

    const response = await proxy(buildRequest(path));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it.each(WELL_FORMED_PUBLIC)("PUB-002: %s passes through with a misconfigured secret", async (path) => {
    for (const secret of [undefined, "short"]) {
      vi.stubEnv("ADMIN_SECRET", secret);

      const response = await proxy(buildRequest(path, "invalid"));

      expect(response.status, `${path} with secret ${String(secret)}`).toBe(200);
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it.each(["/administrator", "/administrator/x", "/api/administrator"])("PUB-003: %s is not an admin path, so it is not guarded either", async (path) => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);

    const response = await proxy(buildRequest(path));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["/", "/admin", "/admin/events", "/admin/board/x/edit"])("PUB-004: %s is still guarded: no cookie redirects to /login", async (path) => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);

    const response = await proxy(buildRequest(path));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });
});

// Next matches the middleware and the page against the decoded path too, so an encoded spelling of an
// admin path reaches the admin page: the guard has to recognise it the same way.
describe("middleware: encoded admin paths are guarded", () => {
  const ENCODED_ADMIN = [
    "/%61dmin",
    "/%61dmin/events",
    "/admin%2Fevents",
    "/admin%2fevents",
    "/admin%2F",
    "/%2Fadmin",
    "/%2F%61dmin%2Fevents",
    // Next 16 treats a decoded backslash as a slash, so these reach the admin page or the root page.
    "/%5Cadmin",
    "/admin%5Cevents",
    "/%5Cadmin%5Cevents",
    "/%5C%5Cadmin",
    "/%2F%5Cadmin",
    "/%5C",
  ];

  it.each(ENCODED_ADMIN)("ENC-001: %s with no cookie redirects to /login", async (path) => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);

    const response = await proxy(buildRequest(path));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    expect(response.headers.get("x-middleware-next")).toBeNull();
  });

  it.each(ENCODED_ADMIN)("ENC-002: %s with a misconfigured secret is a 503, like the plain path", async (path) => {
    vi.stubEnv("ADMIN_SECRET", "short");

    const response = await proxy(buildRequest(path));

    expect(response.status).toBe(503);
  });

  it.each(["/%61dministrator", "/foro%2Fadmin", "/%2561dmin", "/foro%5Cadmin"])("ENC-003: %s does not decode to an admin path (Next decodes once), so it passes through", async (path) => {
    vi.stubEnv("ADMIN_SECRET", TEST_SECRET);

    const response = await proxy(buildRequest(path));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
