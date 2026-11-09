# Testing

Unit tests (`npm test`), integration tests against Postgres (`npm run test:integration`) and Playwright end to end (`npm run e2e`). Flows are specified in [JOURNEYS.md](JOURNEYS.md); e2e tests name the journey (F#/R#) and decision (D#) they cover.

## e2e harness (`npm run e2e`)

`scripts/run-e2e.mjs` starts the disposable Postgres, migrates, builds and runs Playwright against `next start` on port 3100. `buildAppEnvironment` decides what the app under test sees: every feature variable is forced to empty so a developer's `.env*` never leaks in, and only test-only values are set.

| Variable | In the e2e app | Why |
| --- | --- | --- |
| `MAIL_GMAIL_USER`, `MAIL_GMAIL_APP_PASSWORD` | empty | A developer's Gmail account must never send from a test |
| `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, `AUTH_URL` | empty | The specs describe a server without them (see below) |
| `REGISTRATION_CONFIRM_SECRET` | test value (or the caller's) | Signs the confirmation links the specs seed; shared with the test process |
| `FORUM_SESSION_SECRET` | the caller's, else empty | Opt-in for the signed-in forum suites |

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

### What skips, and why

The open registration form needs a working captcha and a mail account. `e2e` has neither, so the tests that need an accepted registration (`takesRegistrations` in `e2e/audit-registration.spec.ts`) skip. Turning them on needs:

- a mail stub (the Gmail transport has a fixed host, so there is none today),
- Cloudflare's always-pass Turnstile test keys and `AUTH_URL` set to `http://127.0.0.1:3100`, and, with the widget on the page, the specs that assume a form without Turnstile updated (`event-page.spec.ts`, `event-registration.spec.ts`, `admin.spec.ts` invite message, `networkidle` waits).

The confirm-link test does not need them: it seeds its pending row and only needs `REGISTRATION_CONFIRM_SECRET`.

### Unit test of the harness

`node --test scripts/run-e2e.test.mjs` checks `buildAppEnvironment` (it is not part of `npm test`, whose Vitest include is `src/tests/**`).
