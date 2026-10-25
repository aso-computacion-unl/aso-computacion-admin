import * as Sentry from "@sentry/nextjs";

import { buildSentryOptions } from "@/infrastructure/observability/sentry-options";

// Inert while neither DSN variable is set: see buildSentryOptions.
Sentry.init(buildSentryOptions(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.SENTRY_TRACES_SAMPLE_RATE));
