import type { NextConfig } from "next";

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
};

export default nextConfig;
