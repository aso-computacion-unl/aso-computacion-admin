# Testing

Unit tests (`npm test`), integration tests against Postgres (`npm run test:integration`) and Playwright end to end (`npm run e2e`). Flows are specified in [JOURNEYS.md](JOURNEYS.md); e2e tests name the journey (F#/R#) and decision (D#) they cover.

## e2e harness (`npm run e2e`)

`scripts/run-e2e.mjs` starts the disposable Postgres, migrates, builds and runs Playwright against `next start` on port 3100. `buildAppEnvironment` decides what the app under test sees: every feature variable is forced to empty so a developer's `.env*` never leaks in, and only test-only values are set.

| Variable | In the e2e app | Why |
| --- | --- | --- |
| `MAIL_GMAIL_USER`, `MAIL_GMAIL_APP_PASSWORD` | fake test values | The app needs a mail account to look configured; a developer's Gmail account must never send from a test |
| `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT`, `MAIL_SMTP_SECURE` | `127.0.0.1`, `3125`, `false` | Every message goes to the local SMTP sink instead of `smtp.gmail.com:465` (test-only variables, unset in production) |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare's always-pass test keys | The open form's widget renders and passes; the server verifies the token with the test secret (needs network access to `challenges.cloudflare.com`) |
| `AUTH_URL` | `http://127.0.0.1:3100` | The public origin of the links in emails and invitations |
| `REGISTRATION_CONFIRM_SECRET` | test value (or the caller's) | Signs the confirmation links; shared with the test process, which seeds its own pending rows |
| `FORUM_SESSION_SECRET` | the caller's, else empty | Opt-in for the signed-in forum suites |

Every other feature variable is forced to empty (a developer's `.env*` never leaks in).

### Mail: the SMTP sink

`scripts/run-e2e.mjs` starts `e2e/support/smtp-sink.ts` (a few dozen lines on `node:net`, no dependency) on `127.0.0.1:3125` for the Playwright run. It accepts any message and stores each as a JSON file in the directory `E2E_MAIL_DIR`. A spec reads the email the way a person would, with `e2e/support/mail-sink.ts`:

```ts
const [mail] = await waitForMail("ana@example.com");   // polls until the app has sent it
await page.goto(confirmationLink(mail!));              // /inscripciones/<slug>/confirmar?token=…
```

`waitForMail(address, { count })` waits for at least `count` mails to that address (any case, international domains in punycode); `mail` has `from`, `to`, `subject`, `text` and `html`, decoded. Specs never sign confirmation tokens to *obtain* a link; `confirmToken` in `audit-registration.spec.ts` is only for seeding rows that are already pending. `R4 → R5` in that file is the whole path: open form with the real Cloudflare widget, link from the sink, confirmation, one seat fewer.

Each accepted registration spends one unit of the daily mail budget (`MAIL_DAILY_LIMIT`, default 400) in the disposable database.

### The Turnstile widget in the browser

Cloudflare's script keeps a page from reaching `networkidle`, so form specs never wait for it. `e2e/support/turnstile.ts` exports `openForm(page, slug)`: it swaps Cloudflare's script for a stub widget that passes at once (no network, a token the server's test secret accepts) and waits until the widget is mounted, which also means the form is hydrated. The R4 → R5 test uses the real widget and clicks until the check passes. Pages without a widget keep waiting on the visible state they need.

### Signed-in forum suites

```
FORUM_SESSION_SECRET=<32+ characters> npm run e2e
```

Without it `forum-member`, `audit-forum` and the UNL-member registration test skip. Specs that need a member use `e2e/support/forum-session.ts`:

```ts
const member = await plantForumMemberSession(prisma, { memberId: "m1", displayName: "Daniela P." });
await context.addCookies([member.cookie]);
```

It upserts the `ForumMember` and `ForumSession` rows and signs the `forum-session` token the way the app does. Options: `suspended`, `revoked`, `lifetimeSeconds` (negative: already expired), `email`, `sessionId`. `signForumSessionToken` signs a token alone.

### What skips

Only the signed-in forum suites, and only without `FORUM_SESSION_SECRET` (above). The open registration form no longer skips: the harness has Turnstile and a mail sink.

The rules the old harness proved by being unconfigured are covered another way: "no Turnstile secret closes the form (503)" by `src/tests/unit/infrastructure/http/turnstile.test.ts` and a mocked 503 in `event-page.spec.ts`; "secret without site key says unavailable" by `inscripciones-event-page.test.ts`; "no AUTH_URL, no invite link" by `users/actions.test.ts`.

### Unit test of the harness

`node --test scripts/run-e2e.test.mjs` checks `buildAppEnvironment` and the sink with nodemailer (it is not part of `npm test`, whose Vitest include is `src/tests/**`).
