import { describe, expect, it } from "vitest";

import { scrubSentryEvent } from "@/infrastructure/observability/sentry-scrub";

const HOOK = "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/9f8e7d6c-secret-token";
const INVITE_TOKEN = "invite-secret-token_AbC123";

describe("scrubSentryEvent", () => {
  it("drops the request body and cookies", () => {
    const event = scrubSentryEvent({
      request: { url: "https://admin.test/admin/events", method: "POST", data: { password: "hunter2" }, cookies: { aso_session: "jwt" } },
    });

    expect(event.request).toEqual({ url: "https://admin.test/admin/events", method: "POST" });
  });

  it("reduces the request URL to origin and path, so an OAuth callback never sends code or state", () => {
    const event = scrubSentryEvent({
      request: { url: "https://admin.test/api/auth/google/callback?code=4%2Fsecret-code&state=secret-state#frag", method: "GET" },
    });

    expect(event.request?.url).toBe("https://admin.test/api/auth/google/callback");
    expect(JSON.stringify(event)).not.toContain("secret");
  });

  it("drops the query string of the request, in its string and object forms", () => {
    const asString = scrubSentryEvent({ request: { url: "https://admin.test/cb", query_string: "code=secret-code&state=secret-state" } });
    const asObject = scrubSentryEvent({ request: { url: "https://admin.test/cb", query_string: { code: "secret-code", state: "secret-state" } } });

    expect(asString.request).toEqual({ url: "https://admin.test/cb" });
    expect(asObject.request).toEqual({ url: "https://admin.test/cb" });
  });

  it("does not leak a request URL it cannot parse", () => {
    const event = scrubSentryEvent({ request: { url: "not a url?code=secret-code" } });

    expect(JSON.stringify(event)).not.toContain("secret-code");
  });

  it("drops authorization and cookie headers whatever their case, keeps the rest", () => {
    const event = scrubSentryEvent({
      request: {
        headers: { Authorization: "Bearer abc", COOKIE: "aso_session=jwt", "Set-Cookie": "a=b", "X-Api-Key": "k", "user-agent": "curl", accept: "*/*" },
      },
    });

    expect(event.request?.headers).toEqual({ "user-agent": "curl", accept: "*/*" });
  });

  it("drops the preview token header, so a token never reaches the error tracker", () => {
    const event = scrubSentryEvent({
      request: { url: "https://admin.test/api/public/preview", headers: { "X-Preview-Token": "eyJ.preview.token", accept: "*/*" } },
    });

    expect(event.request?.headers).toEqual({ accept: "*/*" });
    expect(JSON.stringify(event)).not.toContain("eyJ.preview.token");
  });

  it("reduces URLs in breadcrumbs to their origin, so the deploy hook token never leaves", () => {
    const event = scrubSentryEvent({
      breadcrumbs: [
        { category: "http", data: { url: HOOK, method: "POST", status_code: 200 } },
        { category: "console", message: `fetch to ${HOOK} failed` },
      ],
    });

    expect(event.breadcrumbs?.[0]?.data).toEqual({ url: "https://api.cloudflare.com", method: "POST", status_code: 200 });
    expect(event.breadcrumbs?.[1]?.message).toBe("fetch to https://api.cloudflare.com failed");
    expect(JSON.stringify(event)).not.toContain("secret-token");
  });

  it("reduces URLs in transaction spans and in exception messages too", () => {
    const event = scrubSentryEvent({
      spans: [{ description: `POST ${HOOK}`, data: { "http.url": HOOK, "http.response.status_code": 200 } }],
      exception: { values: [{ type: "Error", value: `request to ${HOOK} failed` }] },
    });

    expect(event.spans?.[0]).toEqual({ description: "POST https://api.cloudflare.com", data: { "http.url": "https://api.cloudflare.com", "http.response.status_code": 200 } });
    expect(event.exception?.values?.[0]?.value).toBe("request to https://api.cloudflare.com failed");
  });

  it("leaves an event without any of those parts untouched", () => {
    const event = { level: "error", request: { headers: { accept: "*/*" } } };

    expect(scrubSentryEvent({ ...event })).toEqual(event);
  });

  it("hides a request URL with no origin, such as a file URL", () => {
    expect(scrubSentryEvent({ request: { url: "file:///home/aso/.env" } }).request?.url).toBe("[url]");
  });

  it("replaces a URL in a text that cannot be parsed instead of keeping it", () => {
    const event = scrubSentryEvent({ breadcrumbs: [{ message: "bad target http://[ in config" }] });

    expect(event.breadcrumbs?.[0]?.message).toBe("bad target [url] in config");
  });

  it("strips credentials and paths from non-http URLs such as a database connection string", () => {
    const event = scrubSentryEvent({
      exception: { values: [{ value: "connect failed: postgresql://admin:s3cret@db.internal:5432/aso?schema=public" }] },
    });

    expect(event.exception?.values?.[0]?.value).toBe("connect failed: postgresql://db.internal");
  });

  describe("admin invite tokens", () => {
    it("redacts the token segment of /invitacion/<token> in the request URL, query and fragment included", () => {
      const event = scrubSentryEvent({ request: { url: `https://admin.test/invitacion/${INVITE_TOKEN}?x=1#frag`, method: "GET" } });

      expect(event.request?.url).toBe("https://admin.test/invitacion/[token]");
      expect(JSON.stringify(event)).not.toContain(INVITE_TOKEN);
    });

    it("keeps the invite query of the Google start route redacted", () => {
      const event = scrubSentryEvent({ request: { url: `https://admin.test/auth/google/start?invite=${INVITE_TOKEN}`, method: "GET" } });

      expect(event.request?.url).toBe("https://admin.test/auth/google/start");
      expect(JSON.stringify(event)).not.toContain(INVITE_TOKEN);
    });

    it("drops the Referer header, which carries the invitation page URL on the Google start request", () => {
      const event = scrubSentryEvent({
        request: { url: "https://admin.test/auth/google/start", headers: { Referer: `https://admin.test/invitacion/${INVITE_TOKEN}`, accept: "*/*" } },
      });

      expect(event.request?.headers).toEqual({ accept: "*/*" });
      expect(JSON.stringify(event)).not.toContain(INVITE_TOKEN);
    });

    it("redacts the token in the transaction name, as a bare path and with a method prefix", () => {
      const bare = scrubSentryEvent({ transaction: `/invitacion/${INVITE_TOKEN}` });
      const prefixed = scrubSentryEvent({ transaction: `GET /invitacion/${INVITE_TOKEN}` });
      const parameterized = scrubSentryEvent({ transaction: "GET /invitacion/[token]" });

      expect(bare.transaction).toBe("/invitacion/[token]");
      expect(prefixed.transaction).toBe("GET /invitacion/[token]");
      expect(parameterized.transaction).toBe("GET /invitacion/[token]");
    });

    it("redacts the token in breadcrumb URLs: data.url, navigation to/from, and absolute URLs in messages", () => {
      const event = scrubSentryEvent({
        breadcrumbs: [
          { category: "fetch", data: { url: `/invitacion/${INVITE_TOKEN}`, method: "GET" } },
          { category: "navigation", data: { from: `/invitacion/${INVITE_TOKEN}`, to: "/auth/google/start" } },
          { category: "navigation", data: { from: "/admin", to: `/invitacion/${INVITE_TOKEN}?utm=1` } },
          { category: "console", message: `visited https://admin.test/invitacion/${INVITE_TOKEN}` },
        ],
      });

      expect(event.breadcrumbs?.[0]?.data).toEqual({ url: "/invitacion/[token]", method: "GET" });
      expect(event.breadcrumbs?.[1]?.data).toEqual({ from: "/invitacion/[token]", to: "/auth/google/start" });
      expect(event.breadcrumbs?.[2]?.data).toEqual({ from: "/admin", to: "/invitacion/[token]?utm=1" });
      expect(JSON.stringify(event)).not.toContain(INVITE_TOKEN);
    });

    it("leaves an unrelated URL, path and transaction unchanged", () => {
      const event = scrubSentryEvent({
        transaction: "GET /admin/users",
        request: { url: "https://admin.test/admin/users", headers: { referer: "https://admin.test/admin" } },
        breadcrumbs: [{ category: "navigation", data: { from: "/admin", to: "/admin/users" } }],
      });

      expect(event.transaction).toBe("GET /admin/users");
      expect(event.request?.url).toBe("https://admin.test/admin/users");
      expect(event.breadcrumbs?.[0]?.data).toEqual({ from: "/admin", to: "/admin/users" });
    });
  });
});
