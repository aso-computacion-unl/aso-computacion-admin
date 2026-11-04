import * as Sentry from "@sentry/nextjs";

import { buildSentryOptions } from "@/infrastructure/observability/sentry-options";

// Nothing runs on the edge runtime today: the proxy (proxy.ts) runs on Node and loads sentry.server.config.ts. Kept for any future edge route. Inert while neither DSN variable is set.
Sentry.init(buildSentryOptions(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.SENTRY_TRACES_SAMPLE_RATE));
