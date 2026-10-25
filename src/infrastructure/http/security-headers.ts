/**
 * Application-wide HTTP security headers, applied to every response by
 * `next.config.ts`. Kept in the infrastructure layer (not inline in the Next
 * config) so the policy is unit-testable and has a single source of truth.
 *
 * No "server-only" guard here: `next.config.ts` is evaluated in the Node build
 * context, not a React module graph, so this file must stay importable there.
 *
 * Content-Security-Policy notes:
 *  - `script-src 'self' 'unsafe-inline'`: Next.js injects inline hydration
 *    scripts. Tightening this to nonces requires per-request middleware and is
 *    tracked separately; the value here still blocks third-party script hosts.
 *  - `img-src` allows Cloudinary because uploaded images are served from there.
 *  - `connect-src 'self'` keeps the admin talking only to its own origin, plus the Sentry ingest
 *    origin of the DSN when error tracking is configured (the browser SDK posts there). No DSN, no extra origin.
 */
function sentryIngestOrigin(dsn: string | undefined): string | undefined {
  try {
    const url = new URL(dsn?.trim() ?? "");

    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function contentSecurityPolicyDirectives(nodeEnv: string | undefined, sentryDsn: string | undefined): string[] {
  const sentryOrigin = sentryIngestOrigin(sentryDsn);

  // React's dev runtime evaluates strings (call-stack reconstruction, fast
  // refresh), so `next dev` cannot hydrate under a policy without
  // 'unsafe-eval': every client component stays inert. Production keeps the
  // strict policy; this only widens it while NODE_ENV is "development".
  const devEval = nodeEnv === "development" ? " 'unsafe-eval'" : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${devEval}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self' data:",
    sentryOrigin ? `connect-src 'self' ${sentryOrigin}` : "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
}

export function buildContentSecurityPolicy(nodeEnv: string | undefined, sentryDsn?: string): string {
  return contentSecurityPolicyDirectives(nodeEnv, sentryDsn).join("; ");
}

const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy(process.env.NODE_ENV, process.env.NEXT_PUBLIC_SENTRY_DSN);

export interface SecurityHeader {
  readonly key: string;
  readonly value: string;
}

export const SECURITY_HEADERS: readonly SecurityHeader[] = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // 180 days. No `preload` — reversing a preload commitment is slow, so it is
  // an explicit opt-in decision rather than a default.
  { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
];
