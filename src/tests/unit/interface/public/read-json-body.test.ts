import { describe, expect, it } from "vitest";

import { readJsonObject } from "@/interface/public/read-json-body";

const MAX = 64;

function post(body: BodyInit | null, headers: Record<string, string> = { "content-type": "application/json" }) {
  return new Request("http://localhost:3000/api/public/events/x/registrations", { method: "POST", headers, body });
}

describe("readJsonObject", () => {
  it("reads a JSON object", async () => {
    expect(await readJsonObject(post('{"name":"Ana"}'), MAX)).toEqual({ ok: true, value: { name: "Ana" } });
  });

  it("accepts a JSON content type with a charset, in any case", async () => {
    expect(await readJsonObject(post("{}", { "content-type": "Application/JSON; charset=utf-8" }), MAX)).toEqual({ ok: true, value: {} });
  });

  it("refuses anything that is not JSON with 415", async () => {
    expect(await readJsonObject(post("{}", { "content-type": "text/plain" }), MAX)).toEqual({ ok: false, status: 415 });
    expect(await readJsonObject(post("{}", {}), MAX)).toEqual({ ok: false, status: 415 });
  });

  it("refuses with 413, before reading, a body that declares more than the limit", async () => {
    const request = post("{}", { "content-type": "application/json", "content-length": String(MAX + 1) });

    expect(await readJsonObject(request, MAX)).toEqual({ ok: false, status: 413 });
    expect(request.bodyUsed).toBe(false);
  });

  it("refuses with 413 a body that grows past the limit whatever it declared", async () => {
    const big = JSON.stringify({ name: "a".repeat(MAX) });

    expect(await readJsonObject(post(big), MAX)).toEqual({ ok: false, status: 413 });
    expect(await readJsonObject(post(big, { "content-type": "application/json", "content-length": "2" }), MAX)).toEqual({ ok: false, status: 413 });
  });

  it("refuses with 400 a body that is not valid JSON, empty, or not an object", async () => {
    for (const body of ["{oops", "", "[1,2]", "null", '"texto"', "7"]) {
      expect(await readJsonObject(post(body), MAX)).toEqual({ ok: false, status: 400 });
    }
  });

  it("refuses with 400 a request without a body", async () => {
    expect(await readJsonObject(new Request("http://localhost:3000/x", { method: "GET", headers: { "content-type": "application/json" } }), MAX)).toEqual({ ok: false, status: 400 });
  });
});
