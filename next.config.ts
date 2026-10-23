import type { NextConfig } from "next";

import { SECURITY_HEADERS } from "@/infrastructure/http/security-headers";

const nextConfig: NextConfig = {
  // Drop the `X-Powered-By: Next.js` header: it discloses the framework to
  // no benefit.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Covers IMAGE_MAX_SIZE_BYTES (5MB) plus multipart/framing overhead so
      // realistic admin image uploads aren't rejected before the action's
      // own size/signature checks ever run.
      bodySizeLimit: "6mb",
    },
  },
  // Apply the shared security-header policy to every route. Kept in the
  // infrastructure layer so it is unit-tested (security-headers.test.ts).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS.map((header) => ({ ...header })),
      },
    ];
  },
};

export default nextConfig;
