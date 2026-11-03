import * as Sentry from "@sentry/nextjs";

import { buildSentryOptions } from "@/infrastructure/observability/sentry-options";

// Inert while NEXT_PUBLIC_SENTRY_DSN is unset. Only literal `process.env.NEXT_PUBLIC_*` reads are inlined into the bundle.
Sentry.init(buildSentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
