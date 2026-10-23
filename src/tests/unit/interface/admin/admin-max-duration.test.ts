import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DEPLOY_HOOK_MAX_WAIT_MS, DEPLOY_HOOK_TIMEOUT_MS } from "@/infrastructure/deploy/deploy-hook";

describe("admin function duration", () => {
  // Server actions run inside the page's function: `after()` keeps it open for the debounce window
  // (at most the max wait), on top of the mutation itself (an image upload can take several seconds).
  it("leaves room for an upload, the longest wait and the hook call, within the Vercel Hobby cap of 60 s", () => {
    const source = readFileSync("app/admin/layout.tsx", "utf8");
    const seconds = Number(/^export const maxDuration = (\d+);$/m.exec(source)?.[1]);

    expect(seconds).toBeGreaterThanOrEqual((DEPLOY_HOOK_MAX_WAIT_MS + DEPLOY_HOOK_TIMEOUT_MS) / 1000 + 10);
    expect(seconds).toBeLessThanOrEqual(60);
  });
});
