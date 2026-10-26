import { describe, expect, it } from "vitest";

import { describeDeployStatus, formatElapsed } from "@/interface/admin/deploy-status-label";

const NOW = new Date("2026-10-25T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatElapsed", () => {
  it.each([
    [0, "hace un momento"],
    [30 * SECOND, "hace un momento"],
    [59 * SECOND, "hace un momento"],
    [MINUTE, "hace 1 min"],
    [3 * MINUTE + 20 * SECOND, "hace 3 min"],
    [59 * MINUTE, "hace 59 min"],
    [HOUR, "hace 1 h"],
    [2 * HOUR + 40 * MINUTE, "hace 2 h"],
    [23 * HOUR, "hace 23 h"],
    [DAY, "hace 1 d"],
    [10 * DAY, "hace 10 d"],
  ])("%d ms -> %s", (elapsed, text) => {
    expect(formatElapsed(ago(elapsed), NOW)).toBe(text);
  });

  it("treats a timestamp in the future (clock skew between instances) as just now", () => {
    expect(formatElapsed(new Date(NOW.getTime() + 5 * MINUTE), NOW)).toBe("hace un momento");
  });
});

describe("describeDeployStatus", () => {
  it("says so when no deploy was ever requested", () => {
    expect(describeDeployStatus(null, NOW)).toMatchObject({ tone: "none", text: "Aún no se solicitó ningún despliegue." });
  });

  it("reports a success with its age", () => {
    const status = { attemptedAt: ago(3 * MINUTE), ok: true, httpStatus: 200, errorKind: null };

    expect(describeDeployStatus(status, NOW)).toMatchObject({ tone: "ok", text: "Último despliegue: hace 3 min · OK" });
  });

  it("reports an HTTP failure with its status, and tells what to do", () => {
    const status = { attemptedAt: ago(2 * HOUR), ok: false, httpStatus: 500, errorKind: null };
    const described = describeDeployStatus(status, NOW);

    expect(described).toMatchObject({ tone: "failed", text: "Último despliegue: Falló (HTTP 500) · hace 2 h" });
    expect(described.hint).toMatch(/guardado/);
    expect(described.hint).toMatch(/diari/);
  });

  it.each([
    ["timeout", "Falló (tiempo agotado)"],
    ["network", "Falló (sin conexión con Cloudflare)"],
    [null, "Falló"],
  ])("reports a failure without an HTTP answer (%s)", (errorKind, label) => {
    const status = { attemptedAt: ago(MINUTE), ok: false, httpStatus: null, errorKind };

    expect(describeDeployStatus(status, NOW).text).toBe(`Último despliegue: ${label} · hace 1 min`);
  });
});
