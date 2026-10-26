import { describe, expect, it } from "vitest";

import { parseReportQueueParams, reportQueueHref } from "@/interface/admin/forum/report-queue-params";

describe("parseReportQueueParams", () => {
  it("defaults to the first page of the open reports", () => {
    expect(parseReportQueueParams({})).toEqual({ status: "open", page: 1 });
  });

  it("reads the closed queue and a page number", () => {
    expect(parseReportQueueParams({ estado: "cerrados", pagina: "3" })).toEqual({ status: "closed", page: 3 });
  });

  it("reduces anything else to the defaults: unknown states, repeated or hostile pages never error", () => {
    expect(parseReportQueueParams({ estado: "todos", pagina: "0" })).toEqual({ status: "open", page: 1 });
    expect(parseReportQueueParams({ estado: ["cerrados", "abiertos"], pagina: ["2", "3"] })).toEqual({ status: "closed", page: 2 });
    expect(parseReportQueueParams({ pagina: "-1" }).page).toBe(1);
    expect(parseReportQueueParams({ pagina: "1e3" }).page).toBe(1);
    expect(parseReportQueueParams({ pagina: "9999999999" }).page).toBe(1);
  });
});

describe("reportQueueHref", () => {
  it("is the bare path for the first page of the open queue, and keeps the state and page otherwise", () => {
    expect(reportQueueHref("open", 1)).toBe("/admin/foro/reportes");
    expect(reportQueueHref("open", 2)).toBe("/admin/foro/reportes?pagina=2");
    expect(reportQueueHref("closed", 1)).toBe("/admin/foro/reportes?estado=cerrados");
    expect(reportQueueHref("closed", 3)).toBe("/admin/foro/reportes?estado=cerrados&pagina=3");
  });
});
