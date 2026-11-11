# Deploying the admin

The admin runs on **Vercel**, stores data in **Neon** (Postgres) and images in **Cloudinary**. It feeds the static landing (Cloudflare Pages) through `GET /api/public/content` and a deploy hook. Nothing here is automated: each service is set up once by hand.

Order of work: [Neon](#1-neon-postgres) → [Cloudinary](#2-cloudinary) → [Vercel](#3-vercel) → [seed](#5-seeding-the-landing-content) → [wire the landing](#6-wiring-the-landing). The [checklist](#8-first-deploy-checklist) at the end puts it in one list.

## 1. Neon (Postgres)

1. Create a project and a database (any region; pick the Vercel region closest to it in step 3).
2. From **Connect**, copy two connection strings:
   - **Pooled** (host contains `-pooler`): what the running app uses. Use it as copied, with `sslmode=verify-full` (what the `pg` driver does for `require` anyway, minus its warning on every start), e.g. `postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/DB?sslmode=verify-full`. No `pgbouncer=true`: since Prisma 7 the app talks to Postgres through the `pg` driver (`@prisma/adapter-pg`), which ignores that parameter and sends unnamed prepared statements, so PgBouncer's transaction mode works without it.
   - **Direct** (no `-pooler`): used only for migrations and the seed.
3. Apply the migrations once from your machine, with the **direct** string. The Prisma CLI reads the database URL from `DATABASE_URL` in `prisma.config.ts` (the schema has no `url`, and there is no separate direct-URL variable), so the direct string is passed as `DATABASE_URL` for that one command. A `.env` in the current directory is loaded too, without overriding variables already set:

   ```bash
   DATABASE_URL='<direct connection string>' npx prisma migrate deploy
   ```

   `migrate deploy` applies the committed migrations in `prisma/migrations/` and nothing else; it never resets or generates anything. It is deliberately **not** part of the Vercel build command: a build would run it through the pooler, where Prisma's migration lock can fail.

4. Later migrations do not need the string copied again. The `Migrate production database` workflow (`.github/workflows/migrate.yml`) runs the same command with the direct string stored once in GitHub:

   - One-time setup: in the repository's **Settings → Environments → `production-db`** (deployment branches limited to `main`), add the secret `MIGRATE_DATABASE_URL` with the **direct** string. From a terminal: `gh secret set MIGRATE_DATABASE_URL --env production-db` and paste it when asked. Update it there if the Neon password is ever rotated.
   - It runs on its own on every push to `main` that touches `prisma/migrations/`, and only ever with what is on `main`: a pull request branch never runs with the production string.
   - Vercel deploys `main` the moment a merge lands, so the tables have to be there first. Merge the migration **in its own pull request** (only `prisma/migrations/`; migrations stay additive, so the running code ignores it), wait for the workflow to finish, then merge the code that needs it.

   The workflow refuses an empty or pooled string, and never runs for pull requests.

The app's SQL (`FOR UPDATE` row locks, `INSERT ... ON CONFLICT` for the login throttle) uses plain transactions and holds no session state, so it fits PgBouncer's transaction mode on paper. It has only been run against a local Postgres, never against Neon (and never through `@prisma/adapter-pg` there, the driver adapter introduced with Prisma 7): check the first login and the first photo upload after deploying. The runtime pool is the `pg` default of 10 connections per instance with a 5 second connection timeout; both are set in `src/infrastructure/prisma/client.ts`.

## 2. Cloudinary

1. Create a free account. The **cloud name** is on the dashboard.
2. **Settings → API Keys**: create or reuse a key. You need the **API key** and the **API secret**.
3. Nothing else to configure: uploads are signed server-side by the SDK, so no upload preset is needed.

Everything lands under one base folder, `CLOUDINARY_FOLDER` (default `aso-computacion`), with one subfolder per feature: `events`, `pillars`, `news`, `board`, `sponsors`. The old `testimonials` subfolder only holds photos of kept rows; it is still counted as in use by the unused-image cleanup. The unused-image cleanup only touches those subfolders; files in any other subfolder (or loose in the base folder) are never listed for deletion. Use a different folder per environment if one account serves several (`aso-computacion-staging`).

The image URLs the public API returns contain the cloud name and each asset's `publicId`; both are public by design (see "Public read API" in [REFERENCIA.md](REFERENCIA.md#public-read-api)). The API **secret** is the only private value.

## 3. Vercel

1. **Add New → Project**, import this repository. Framework preset: **Next.js**. Root directory: the repository root.
2. **Node.js version: 22.x** (Settings → General). `package.json` requires `>=22.12.0` and `.nvmrc` says `22`.
3. Build settings, all defaults:

   | Setting | Value |
   |---------|-------|
   | Install command | `npm ci` (its `postinstall` runs `prisma generate`, which writes the client into the git-ignored `src/generated/prisma` and needs no `DATABASE_URL`; dev dependencies must be installed, Prisma's CLI is one) |
   | Build command | `npm run build` |
   | Output | Next.js default |

   The build needs **no** database or Cloudinary variables: the adapters are created on first use, not at import time.
4. Add the [environment variables](#4-environment-variables) for **Production** and redeploy (variables only reach new deployments).
5. Do not copy the production variables into **Preview**. A preview that shares the production database and password lets any branch edit live content; give previews their own Neon branch, or leave them without variables (login is then disabled and says so in the logs).

### `maxDuration`

`app/admin/layout.tsx` sets `maxDuration = 30` (seconds) for every admin page and action. After an edit, `after()` keeps the invocation open while the landing rebuild debounces: up to 15 s of waiting, a 5 s timeout on the hook call and a 3 s one on recording its status (`src/infrastructure/deploy/deploy-hook.ts`). If your Vercel plan caps function duration **below 30 s**, the deployment may be rejected or the wait cut short, and the rebuild for that burst of edits is lost. The daily cron rebuild then picks the change up, so nothing breaks permanently. If you hit the cap, lower `maxDuration` and `DEPLOY_HOOK_MAX_WAIT_MS` together. Check your plan's current limit in the Vercel docs; it was not verified here.

## 4. Environment variables

Set on Vercel (Production) unless the table says otherwise. The names and placeholders come from `.env.example`. Mark every secret as **Sensitive** in Vercel.

| Variable | Required | What it does |
|----------|----------|--------------|
| `DATABASE_URL` | yes | Postgres connection string. On Vercel: the **pooled** Neon URL (step 1). Locally: your own database. |
| `TEST_DATABASE_URL` | never on Vercel | Disposable database for `npm run test:integration` only. Must match the exact local target written in `.env.example`; never point it at Neon. |
| `ADMIN_PASSWORD` | yes | The shared **emergency (break-glass) password**. **At least 16 characters**, enforced: shorter, missing or still a placeholder disables the password login and logs an error. Once Google is configured it only works with `BREAK_GLASS_PASSWORD_LOGIN=1` (section 4a). |
| `ADMIN_SECRET` | yes | Signs the session cookie, the "known device" cookie and the short-lived Google login cookie, and keys the hash of each session's client address. At least 32 characters. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for Google login | The OAuth client of section 4a. Mark the secret Sensitive. Set all three Google variables or none: a partial set is a configuration error (section 4a). |
| `AUTH_URL` | for Google login | Public origin of this admin, `https://…` with no path (plain `http` only for localhost). The OAuth redirect URI is `${AUTH_URL}/auth/google/callback`. |
| `ADMIN_BOOTSTRAP_EMAILS` | no | Comma-separated emails that become ADMIN on their **first** successful Google login, if no user with that email exists yet. An existing user (demoted or deactivated) is never changed by it. |
| `ALLOWED_EMAIL_DOMAIN` | no | Only Google Workspace accounts of this domain can log in (e.g. `unl.edu.ec`): both the email domain and Google's `hd` claim must match, so a personal account is refused. Unset: any verified account that is on the user list. |
| `BREAK_GLASS_PASSWORD_LOGIN` | no | Exactly `1` keeps the shared-password login available after Google is configured, or while its configuration is incomplete. Anything else turns it off (it is on by itself only when none of the three Google variables is set). |
| `FORUM_ALLOWED_EMAIL_DOMAIN` | for the forum | The institutional email domain students must belong to: `unl.edu.ec`. both the email domain and Google's `hd` claim must match, and the email must be verified. **Unset or empty: the forum login is off** (section 4b). |
| `FORUM_SESSION_SECRET` | for the forum | Signs the `forum_sid` cookie and the forum's Google login cookie. At least 32 characters and **different from `ADMIN_SECRET`** (equal is refused). Missing or invalid: the forum login is off. Mark it Sensitive. |
| `FORUM_GOOGLE_CLIENT_ID`, `FORUM_GOOGLE_CLIENT_SECRET` | no | A separate Google OAuth client for the forum. Set both or neither; unset, the forum reuses `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. |
| `TURNSTILE_SECRET_KEY` | for the open registration form | Cloudflare Turnstile **secret** key (section 4c). Mark it Sensitive. Missing, empty or a placeholder **in production: the open registration form answers 503** (fail closed), so nobody registers without the antispam check. Set it **together with `TURNSTILE_SITE_KEY`** (the next row): a secret without a site key logs a warning and closes the form of `/inscripciones/<slug>`. |
| `TURNSTILE_SITE_KEY` | with the secret | The **public** site key of the same Turnstile widget (section 4c), read at request time by `/inscripciones/<slug>` to show the widget. Letters, digits, `_` and `-` only; anything else counts as unset. With the secret set and this missing, that page shows "La inscripción no está disponible" instead of the form and logs the misconfiguration once. |
| `MAIL_GMAIL_USER` | for email | The Gmail address of the association that sends the registration emails (section 4d). Missing, a placeholder or not an address: no email goes out and the open form answers 503. |
| `MAIL_GMAIL_APP_PASSWORD` | for email | A Google **app password** for that account (16 letters; the spaces Google shows are ignored). Not the account password. Mark it Sensitive. |
| `MAIL_FROM_NAME` | no | Display name of the sender. Default `ASO Computación`. |
| `MAIL_DAILY_LIMIT` | no | Most emails sent in one day (Ecuador time), confirmations and reminders together. Default `400`, under Gmail's ~500. A whole number from 1 to 100000; anything else is ignored (the default applies) and reported by the configuration check. |
| `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT`, `MAIL_SMTP_SECURE` | **test-only: leave unset in production** | Send through another SMTP server instead of `smtp.gmail.com:465`. Only `npm run e2e` sets them, to its local mail sink (`MAIL_SMTP_SECURE` is `true` or `false`; with it unset the connection is secure only on port 465). All unset means Gmail exactly as before; a value that does not parse (no host, a port outside 1-65535) is ignored as a whole and Gmail stays. |
| `REGISTRATION_CONFIRM_SECRET` | for email | Signs the email-confirmation links (valid 48 h). At least 32 characters and different from `ADMIN_SECRET` and `FORUM_SESSION_SECRET`. Missing or invalid: the open form answers 503. Rotating it invalidates the links already sent. Mark it Sensitive. |
| `CLOUDINARY_CLOUD_NAME` | yes | Cloudinary cloud name (step 2). |
| `CLOUDINARY_API_KEY` | yes | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | yes | Cloudinary API secret. Server-side only. |
| `CLOUDINARY_FOLDER` | no | Base folder for every upload. Default `aso-computacion`. Letters, digits, `_`, `-`, `/`. |
| `PUBLIC_CORS_ORIGINS` | no | Comma-separated **exact** browser origins allowed to read `/api/public/content`, e.g. `https://aso.example,http://localhost:4321`. No path, no trailing slash, no `*` (such entries are ignored and logged once). Unset grants no browser origin. The landing's build-time fetch runs in Node and needs no CORS, so this only matters if a browser reads the API. |
| `PREVIEW_TOKEN_SECRET` | for previews | Signs and checks the draft-preview tokens accepted by `GET /api/public/preview` (the admin has no screen to generate them any more). At least 32 characters and different from `ADMIN_SECRET`, `FORUM_SESSION_SECRET` and `CRON_SECRET`. Unset or invalid: no token can be accepted. Rotating it invalidates every token. Mark it Sensitive. |
| `CRON_SECRET` | for scheduled content | Bearer secret of the cron that rebuilds the landing when scheduled content comes due (section 6a). At least 32 characters. Vercel sends it automatically as `Authorization: Bearer …` once the variable exists. Unset or invalid: the endpoint refuses everything, so scheduled content only appears with the next edit or the daily rebuild. Mark it Sensitive. |
| `CLOUDFLARE_DEPLOY_HOOK_URL` | no | Cloudflare Pages deploy hook of the landing. POSTed 8 s after the last edit of a burst. `https` only. The token is part of the URL: it is a secret and is never logged. Empty or unset: no rebuilds on edit (the daily cron remains). |
| `SENTRY_DSN` | no | Sentry DSN for the server and edge runtimes. Unset: error tracking is off (no network, no warnings). |
| `NEXT_PUBLIC_SENTRY_DSN` | no | The same DSN, for the browser. Public by design (it ends up in the client bundle). When set, the CSP `connect-src` also allows that DSN's ingest origin. Set it **at build time** (a Vercel build variable), not only at runtime. |
| `SENTRY_TRACES_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | no | Share of requests traced, 0 to 1. Default `0.1`. |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | no | Source-map upload during `next build`. Maps are uploaded only when `SENTRY_AUTH_TOKEN` is set (mark it Sensitive); without it the build touches nothing. |

### Generating the secrets

```bash
openssl rand -base64 48   # ADMIN_SECRET, 64 characters
openssl rand -base64 24   # ADMIN_PASSWORD, 32 characters
```

Use a password manager to store the password and share it with the board. A long random password is the real protection against guessing: the login throttle only slows each client down (see "Login throttle" in [REFERENCIA.md](REFERENCIA.md#login-throttle)), and a passphrase of four or five unrelated words also clears 16 characters if people must type it.

### Rotating the emergency password

Change `ADMIN_PASSWORD` in Vercel and redeploy. What that does:

- **Existing sessions are not affected by the password.** Every session is a row in the database; to cut someone off at once, revoke it in **Sesiones activas** (an admin sees everyone's, including emergency ones) or deactivate the user in **Usuarios**.
- **"Known device" cookies stop matching** (they carry a fingerprint of the password), so those browsers fall back to the per-IP login throttle until their next login. That is harmless; it only affects the throttle.
- Rotating `ADMIN_SECRET` invalidates every session cookie and every device cookie at once: everyone, including you, logs in again.

## 4a. Sign-in with Google, users and roles

People log in with their Google account; only emails on the **Usuarios** list get in, with the role they were given. New people are added by invitation (see "Inviting people" below).

| Role | Can |
|------|-----|
| `EDITOR` | Create, edit, publish, reorder, move to the trash and restore content; see and close their own sessions. |
| `ADMIN` | Everything an editor can, plus: the site texts (**Sitio**), delete for good from the trash, **Usuarios**, other people's sessions, and the **Registro de cambios** (audit log). |

The role is checked on the server in every action (and on every page read), against the database: demoting, deactivating or revoking takes effect on the person's next request. The last active admin can be neither demoted nor deactivated.

### Inviting people

An `ADMIN` adds someone in **Usuarios → Invitar a una persona**: enter their email and a role (`EDITOR` or `ADMIN`). The app shows a link (`<AUTH_URL>/invitacion/<token>`) once; copy it and send it by any channel. There is no email sending yet. The person opens it, signs in with Google, and only then does their user exist.

- The link is **single use**, **expires after 7 days**, and is **bound to that email**: a Google account with a different email, or an unverified one, is refused (the page only says the invitation is not valid, never why).
- The database keeps only a SHA-256 hash of the token, so a leaked database does not leak working links, and the link cannot be shown again: if it is lost, create another invitation (a new one for the same email revokes the older pending one).
- Pending invitations are listed with their expiry and can be revoked. Creating, using and revoking an invitation go to the audit log (`invite.create`, `invite.redeem`, `invite.revoke`) with the role and the invitation id, never the email or the token. Generating a new invitation for an email revokes its older pending one, and that revocation is audited too.
- Creating an invitation needs `AUTH_URL` (the link is built from it) and refuses with a message when it is missing. An email that already has a user cannot be invited; `ADMIN_BOOTSTRAP_EMAILS` keeps working as before.
- Existing users, their roles and the Google login of people already on the list are unchanged. The direct "Agregar usuario" form no longer exists.

### Google Cloud setup (once)

1. In [Google Cloud Console](https://console.cloud.google.com/) create (or pick) a project.
2. **APIs & Services → OAuth consent screen**: user type **Internal** if the accounts belong to one Google Workspace organisation, otherwise **External** (then publish it, or only listed test users can log in). App name `ASO Computación · Administración`, a support email, no extra scopes (the app asks for `openid`, `email` and `profile`).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**, application type **Web application**.
4. **Authorized redirect URIs**: add exactly `https://<your admin domain>/auth/google/callback` (it must match `AUTH_URL` + `/auth/google/callback`, character for character). For local development also `http://localhost:3000/auth/google/callback`. No authorized JavaScript origins are needed.
5. Copy the client ID and the client secret into Vercel as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (secret: Sensitive), set `AUTH_URL` to `https://<your admin domain>` and `ADMIN_BOOTSTRAP_EMAILS` to the one or two emails that should be the first admins. Redeploy.

**The client id and secret decide.** Google login needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `AUTH_URL`. `AUTH_URL` on its own is not a Google setting: invitations, preview links and registration links need it too, so it can be set before Google is.

| Set | Result |
|-----|--------|
| Neither the client id nor the secret (empty or still a `__REPLACE_…__` placeholder), with or without `AUTH_URL` | No Google. The shared-password login is on, as in local development and before the cut-over. |
| All three, `AUTH_URL` a valid `https` origin (plain `http` only for `localhost`) | Google login on. The password login is off unless `BREAK_GLASS_PASSWORD_LOGIN=1`. |
| The client id or the secret set, but not the whole setting (the other one missing, or `AUTH_URL` missing or not a valid `https` origin) | **Configuration error.** Google login is unavailable **and the password login stays off** (a typo must not silently re-open the shared password). `/login` shows "Configuración incompleta: el acceso con Google no está disponible…" and the Vercel logs show `Incomplete Google login configuration: <names of the variables to fix>` once per instance (also sent to Sentry; names only, never values). |

To fix it, set the variables the log names (or clear the client id and secret to go back to the password only) and redeploy. If nobody can log in meanwhile, use the emergency procedure below: `BREAK_GLASS_PASSWORD_LOGIN=1` turns the password form back on even in this state.

If Google says "No pudimos verificar su cuenta de Google. Intente de nuevo en unos minutos." on `/login`, Google (or the connection to it) failed while the login was being checked: it says nothing about the account. It is reported in the logs and Sentry as a Google sign-in failure with `failure: unavailable`, and is not written to the audit log as a refused login. Wait a few minutes and retry; if it persists, check [Google Workspace status](https://www.google.com/appsstatus/dashboard/) and use the emergency procedure.

### Cut-over from the shared password

1. Apply the migration (see "The users, sessions and audit migration" in section 8) **before** deploying this version.
2. Deploy with the Google variables **unset**: login is the shared password, exactly as before, but each login is now a revocable session (listed as "emergencia") and the page shows a warning banner.
3. Set the Google variables and `ADMIN_BOOTSTRAP_EMAILS`, redeploy, and log in with Google. Your first login creates your ADMIN user. Invite the rest of the board from **Usuarios** (see "Inviting people").
4. Once Google works, the password login switches off by itself (it needs `BREAK_GLASS_PASSWORD_LOGIN=1` from then on), and every emergency session still open is rejected at its next request.

### Emergency procedure (break-glass)

Use it only when Google login is unavailable (Google outage, a mistyped redirect URI, a half-set Google configuration, nobody left who can log in).

1. In Vercel set `BREAK_GLASS_PASSWORD_LOGIN=1` and redeploy. `/login` then shows **Acceso de emergencia**.
2. Log in with `ADMIN_PASSWORD`. You act as a synthetic admin ("Acceso de emergencia"); a warning banner shows on every page, and the login is written to the audit log.
3. Fix the cause (for example add or reactivate a user in **Usuarios**), then **log out**, remove `BREAK_GLASS_PASSWORD_LOGIN` and redeploy. Switching it off also invalidates any emergency session still open. Rotate `ADMIN_PASSWORD` if more people than you saw it.

## 4b. Student forum (`/foro`)

Students sign in to the forum with their institutional Google account; there is no sign-up step: the first successful login creates the member. The forum is a separate zone from the admin: its own cookie (`forum_sid`, path `/`: the registration page at `/inscripciones/<slug>` needs it too; it replaced `forum_session` on `/foro`, which the proxy moves to the new cookie on the first forum visit, so nobody signs in again), its own secret, its own tables (`ForumMember`, `ForumSession`, …) and its own guard. A forum cookie never opens an admin page or action, and an admin session is not a forum member.

1. In Vercel set `FORUM_ALLOWED_EMAIL_DOMAIN=unl.edu.ec` (the UNL student domain) and `FORUM_SESSION_SECRET` (`openssl rand -base64 48`, a different value from `ADMIN_SECRET`; mark it Sensitive). The Google client is the admin's (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_URL`), so those must be set as in section 4a.
2. In Google Cloud (**APIs & Services → Credentials →** the OAuth client) add a second **authorized redirect URI**: exactly `https://<your admin domain>/foro/auth/google/callback` (that is `AUTH_URL` + `/foro/auth/google/callback`). For local development also `http://localhost:3000/foro/auth/google/callback`. Keep the admin's `/auth/google/callback` one. The consent screen must let students' accounts in (an **Internal** app only admits the organisation's own accounts; an **External** one must be published).
3. Redeploy. `/foro/auth/google/start` now sends students to Google.

**Fails closed.** Without `FORUM_ALLOWED_EMAIL_DOMAIN` or a valid `FORUM_SESSION_SECRET` (missing, a placeholder, shorter than 32 characters, or equal to `ADMIN_SECRET`) nobody can sign in and `/foro` says the access is unavailable; the admin is not affected. A login is accepted only when the email is verified by Google, its domain is exactly the configured one (sub-domains are not accepted) and Google's `hd` claim names that same domain, so a personal Google account carrying an institutional address is refused. A suspended member is refused and their open sessions stop working at their next request.

**What is stored and shown.** `ForumMember` keeps the lower-cased email and Google's account id (never shown to other students; no public type carries them) and the display name taken from the Google profile (a neutral "Estudiante xxxx" when there is none or it looks like an address). Forum sessions last 7 days and are revocable; only a keyed hash of the client address is kept.

**Posting limits.** A member may post (threads and replies together) 3 times per minute and 30 per hour, counted in the database; the posts are Markdown with fenced code, rendered without HTML.

**Categories.** The ADMIN-only actions in `src/interface/admin/forum/actions.ts` create, rename and delete (only when empty) forum categories. Admins manage them from `/admin/foro/categorias` (not shown to editors), so a fresh forum needs no seed or SQL: create at least one category before announcing the forum, because students cannot open a thread without one.

**The student screens.** `/foro` (the sign-in for a visitor, the categories for a member), `/foro/c/<slug>` (the threads of a category, Abiertos / Resueltos), `/foro/c/<slug>/nuevo`, and `/foro/hilo/<id>`. A visitor sent to any of them lands on the sign-in. The login is the only place a suspended member is told why they cannot enter: the guard answers the same for a visitor and a suspended student, so both see the sign-in, and a refused login says that the moderation may have suspended the account. The forum pages carry `noindex`.

**Moderation.** Admins **and editors** moderate from `/admin/foro/reportes` (the «Foro» area of the rail): students report a thread or a reply (one open report per member per post; once a moderator closes it the same member may report the post again), and the queue lists open reports oldest first, with the closed ones on a second tab. A moderator can hide or show a post, lock or reopen a thread, suspend or reactivate the author, and close the report as resolved or dismissed with a note. A locked thread takes no replies and no edits, not even from its author; a hidden post vanishes for students (and a hidden reply stops being the best answer); suspending a member signs them out of the forum at once (their sessions are revoked in the same transaction) and reactivating does not bring the sessions back. Every one of these actions is written to the audit log ("Registro", filter "Hilo/Respuesta/Cuenta/Reporte del foro") with ids only: never an email, a post, a reason or a note. The admin never sees a student's email in the queue, only their display name.

**Reactions and the best answer.** A student marks a thread or a reply with «me sirvió» (one per member per post; marking again takes it back, and a locked thread still takes them); counts are public, who reacted is never shown. The author of a thread, and only them, marks one of its replies as the best answer or clears the mark: the reply must be a visible reply of that same thread, and a locked thread keeps its answer. Hiding, deleting or editing the best reply clears the mark. These need no new migration (the tables came with the forum migration).

## 4c. Event registration

Each event chooses its registration mode in the admin (none, UNL Google account, open form). What each needs:

- **UNL account**: the forum (section 4b) must be configured, because it reuses the forum's identity and cookie. Without it nobody can sign in, and the event page says so by not offering a registration.
- **Open form**: a Cloudflare Turnstile widget. In the Cloudflare dashboard (**Turnstile → Add widget**) create a widget for the landing's hostname (and `localhost` for development); the **site key** goes in the landing (public), the **secret key** here as `TURNSTILE_SECRET_KEY` (Sensitive). The landing sends the widget's token as `turnstileToken` in the JSON body. For local development Cloudflare publishes test keys (the always-pass secret is `1x0000000000000000000000000000000AA`); outside production an unset secret skips the check. This admin's own page `/inscripciones/<slug>` also needs the **same widget's site key** as `TURNSTILE_SITE_KEY` (a public value, not Sensitive): with the secret set and no usable site key the page cannot show the widget, so it shows "La inscripción no está disponible en este momento" instead of a form and logs `TURNSTILE_SECRET_KEY is set but TURNSTILE_SITE_KEY is missing or invalid` once. The endpoint itself still verifies with the secret alone, because the landing's own form carries its own widget; do not rely on omitting the site key to switch the check off.
- **Email** (section 4d) is part of the open form: it confirms each address before a seat is taken. Without `MAIL_GMAIL_USER`, `MAIL_GMAIL_APP_PASSWORD`, `REGISTRATION_CONFIRM_SECRET` and `AUTH_URL` the form answers 503 and stores nothing. A client of the endpoint other than this admin's page (the landing's own form, if it ever had one) must send `institution` and treat `201` as "check your email".
- `PUBLIC_CORS_ORIGINS` must list the landing's origin, or the browser blocks its `POST` (and the preflight).
- `AUTH_URL` must be set: the public API builds the registration page, endpoint and calendar URLs from it (they are `null` otherwise).

- **Retention.** Registrations are deleted automatically **90 days after their event ends** (the end of its date in Ecuador time, or of its month for a month-only date; undated events are never purged). Nothing to configure beyond the cron of section 6a: the same daily route runs it, and each run that deleted rows leaves one `event.registration_purge` entry in the audit log with the count only. Without `CRON_SECRET` nothing is purged. The same run also deletes the open-form registrations whose email was never confirmed once their 48 h window is over (nobody can confirm them any more); they are counted with the rest. The full rule is in [REFERENCIA.md](REFERENCIA.md#event-registration).

The contract the landing codes against is in [REFERENCIA.md](REFERENCIA.md#event-registration).

## 4d. Email (registration confirmation and reminders)

The open registration form confirms each address before it takes a seat, and every confirmed registrant gets a reminder before the event. Both go out through the association's Gmail, which needs no domain of its own:

1. In the Google account of the association turn on **2-Step Verification**, then create an **app password** (Google Account → Security → App passwords). Copy the 16 letters.
2. Set `MAIL_GMAIL_USER` (that address) and `MAIL_GMAIL_APP_PASSWORD` (the 16 letters) in Vercel, and `REGISTRATION_CONFIRM_SECRET` (`openssl rand -base64 48`). All three are required; with any missing the open form answers 503 "no disponible" instead of taking registrations nobody could confirm.
3. **Reminders.** Besides the confirmation, every confirmed registrant (the open form and the UNL sign-in) gets one reminder one to three days before the event, sent by the daily cron (section 6a). They share the daily budget with the confirmations, nearest events first, so a busy day sends fewer; the rest goes the next day and nobody is reminded twice.
4. **Daily budget.** Gmail allows about 500 messages a day to a free account. Every send, whatever its reason, first takes one unit of a per-day counter (table `MailDailyCounter`, day in Ecuador time) that refuses past `MAIL_DAILY_LIMIT` (default 400), so one day never goes over however many instances run. A send the provider refuses gives its unit back. A confirmation that finds the budget spent is refused with 503 and nothing is left to block a retry; reminders spread over the days before the event instead (section 6a).
5. The code talks to a `MailSender` port; the Gmail adapter is the only piece that knows Gmail. Moving to a transactional service with an own domain later replaces that adapter and these variables, nothing else.

The names only (never values) of what is still missing are what the configuration check reports.

## 5. Seeding the landing content

The landing keeps its real content in `src/data/fallback.json` and its images in `src/assets/`. `npm run seed:landing` loads them into the admin through the same use cases the admin UI calls, so every rule applies: board entries carry only name, role and photo (a file with any other key on a board entry is rejected as a whole), photo minimum widths, and a board member needs a photo to be published.

It is a script you run from your machine, once, with real credentials. The two repositories are siblings:

```bash
SOURCE="--fallback ../aso-computacion-landing/src/data/fallback.json --assets ../aso-computacion-landing"

# 1. Dry run. Needs no variables: it reads the files and prints the plan, assuming an empty database.
npm run seed:landing -- $SOURCE

# 2. Dry run against the real database (read only): what already exists shows as "skip".
DATABASE_URL='<direct connection string>' npm run seed:landing -- $SOURCE

# 3. Write. Needs DATABASE_URL and the three CLOUDINARY_* variables, otherwise it refuses and writes nothing.
DATABASE_URL='<direct connection string>' \
CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=... \
  npm run seed:landing -- $SOURCE --apply
```

- `--assets` is the landing's **root**: an image listed as `/src/assets/team/ana.jpg` is read from `<assets>/src/assets/team/ana.jpg`. Nothing outside that root can be read.
- The script also reads a `.env` in the current directory (without overriding variables already set). Before writing it prints `database: <host>/<name>`, never the credentials. **Check that line** before `--apply`.
- What it creates is exactly what the fallback shows on the site, published: events, FAQ, pillars, socials and the board with their photos (uploaded to Cloudinary), and the site settings when the file has them. `datePrecision: "month"` is kept. A board entry with no photo is created as a draft. A plan with any problem (unreadable image, a photo narrower than its minimum, a value the domain rejects) writes nothing.
- **Event photos are not seeded.** The landing has none; upload them in the admin (`/admin/events`).
- **News is not seeded.** The landing's `news` list is accepted only when empty; a file with news entries is refused, so create news items in the admin (`/admin/news`).
- **Idempotent.** Items are matched on a stable key: event slug, FAQ question, pillar word, social platform + URL, board name, the settings singleton (compared ignoring case and extra spaces). Whatever already exists is skipped and never modified, so running twice creates nothing and admin edits survive. The flip side: if you **rename or delete** a seeded item in the admin (a trashed one counts as deleted) and run the seed again, it comes back, because the key is all the seed knows. Seed once, then edit in the admin.
- If a run fails midway it stops at the first error, deletes the half-created item and its uploaded image, and exits with code 1. Fix the cause and run it again; it only creates what is missing.
- The seed does **not** trigger a landing rebuild (that hook lives in the admin's server actions). Run the deploy hook yourself afterwards, or wait for the daily cron.

## 6. Wiring the landing

The landing's own deployment (Cloudflare Pages, `ADMIN_CONTENT_URL`, the daily rebuild workflow) is documented in the landing repository. From this side you need two things:

1. Create a **Deploy hook** in the Cloudflare Pages project (Settings → Builds → Deploy hooks) and put its URL in `CLOUDFLARE_DEPLOY_HOOK_URL`.
2. Give the landing the public API URL, `https://<your-vercel-domain>/api/public/content`, and add the landing's production origin to `PUBLIC_CORS_ORIGINS` if a browser will read it.

Check the API by hand: `curl -s https://<your-vercel-domain>/api/public/content` returns `"schemaVersion": 1` and, after seeding, 7 board entries with only `name`, `role` and `photo`.

## 6a. Scheduled content and previews

Events and news can carry a publish window (`publishAt` / `unpublishAt`, edited in Ecuador time). The landing is static, so scheduled content only shows up after a rebuild that happens after the boundary. `vercel.json` registers a **Vercel Cron** that does this:

1. Set `CRON_SECRET` (≥ 32 random characters, Sensitive) in Vercel Production and redeploy. Vercel then calls `GET /api/cron/scheduled-rebuild` once a day, at 06:00 Ecuador time (`0 11 * * *` UTC), with `Authorization: Bearer <CRON_SECRET>`.
2. The endpoint asks Cloudflare for a build (`CLOUDFLARE_DEPLOY_HOOK_URL`) **only** when a published event or news item opened or closed since the hook was last accepted; otherwise it does nothing, so an idle site costs no builds. It answers 502 when the hook refuses, which shows as a failed run in Vercel → Cron Jobs.
3. **Plan limit (Vercel Hobby).** The admin runs on the free Hobby plan, which only allows cron jobs that run once a day and rejects a deployment whose `vercel.json` asks for more; that is why the schedule is daily. Scheduled content can therefore appear up to ~24 h late, unless someone triggers a publish or a rebuild by hand (any admin edit rebuilds the landing, or POST the deploy hook yourself). On Pro, set `schedule` back to `*/15 * * * *` and the delay drops to about 15 minutes.
4. Check it by hand: `curl -i -H "Authorization: Bearer $CRON_SECRET" https://<your-vercel-domain>/api/cron/scheduled-rebuild` returns `{"rebuild":{"crossed":N,"outcome":...},"retention":{"deleted":N},"reminders":{...}}`; without the header it returns 401. **Careful: it really runs every step**, so it deletes any registration already past its 90 days and **sends the reminders that are due** (each person at most once, so a second call the same day sends nothing more).
5. **One cron, three jobs.** The same call also deletes the event registrations whose retention period (90 days after the event) is over (section 4c) and sends the **reminders** (section 4d): the confirmed people of every public event one to three days ahead get one email, nearest events first, up to the day's mail budget, and what does not fit goes out the next day. The steps are independent: if one fails the others still run, the run shows red in Vercel → Cron Jobs (500), and the failure is reported to Sentry. Hobby allows one cron per project, which is why there is no second one. The route's `maxDuration` is **60 s** (the most Hobby gives; it was 30) because the reminders share one SMTP connection and send for up to 45 s; if your plan caps it lower, the reminders just stop earlier (the rest goes the next day) but the deployment may be rejected, so check the limit. The body of the answer is `{"rebuild":…,"retention":{"deleted":N},"reminders":{"sent":N,"failed":N,"events":N,"stoppedBy":"done"}}`; `stoppedBy` is `done`, `budget` (the day's mail allowance ran out), `time`, `provider` (three sends failed in a row) or `not_configured` (no Gmail account or `AUTH_URL`: nothing sent).

Previews: set `PREVIEW_TOKEN_SECRET` (≥ 32 characters, different from the other secrets, Sensitive). A token signed with it is sent as the `X-Preview-Token` header to `GET /api/public/preview`. See "Scheduling and preview" in [REFERENCIA.md](REFERENCIA.md) for the contract.

## 7. Error tracking (Sentry)

The code is wired and does nothing until you do this, once, by hand:

1. Create a free account and a project on sentry.io (platform **Next.js**). Copy its **DSN** (Project Settings → Client Keys).
2. In Vercel (Settings → Environment Variables, Production) set `SENTRY_DSN` **and** `NEXT_PUBLIC_SENTRY_DSN` to that DSN, then redeploy.
3. Optional, for readable stack traces: create an organization auth token (Settings → Developer Settings → Organization Tokens) and set `SENTRY_AUTH_TOKEN` (Sensitive), `SENTRY_ORG` and `SENTRY_PROJECT` in Vercel.
4. Check it: cause a harmless error (for example an action with the database unreachable) and look for it in Sentry.

What is reported: unhandled errors in server components, route handlers and server actions (`onRequestError`), the unexpected failures the server actions and API handlers already log with `console.error` (one helper, `reportError`), the public API's 503s, and browser render errors. What is not: validation errors and other user mistakes.

What never leaves the server: `sendDefaultPii` is off, and a `beforeSend` scrubber removes request bodies, cookies and `authorization`/`cookie`/`set-cookie` headers, and reduces every URL in breadcrumbs, spans and messages to its origin (the deploy hook URL carries a secret token), redacts the token of `/invitacion/<token>` paths in request URLs, transaction names and breadcrumbs, and drops the `Referer` header. The trace sample rate defaults to 0.1.

## 8. Operating notes

- A wrong or missing variable shows up in the Vercel function logs, never on screen: `ADMIN_PASSWORD is not set...`, `ADMIN_SECRET is invalid...`. If nobody can log in right after a deploy, read the logs first.
- Failed deletes in Cloudinary never fail an admin action; the leftover `publicId`s are logged and can be removed in the Cloudinary console. Cloudinary assets are destroyed only when an item is deleted for good from the trash, never when it is moved there.
- The dashboard shows the outcome of the last landing rebuild request ("Último despliegue"). A failure there means the content is saved but the site was not asked to rebuild: wait for the daily cron or save another change. Check `CLOUDFLARE_DEPLOY_HOOK_URL` if it keeps failing. Remember to run `prisma migrate deploy` (the `DeployStatus` table) before the first deploy that includes this.
- The login throttle lives in the database (table `LoginAttempt`), so it holds across Vercel instances. The password login and the Google callback spend the same throttle.
- Sessions live in the `Session` table (24 h, revocable). Only a keyed hash of the client address and a shortened user agent are stored. Old rows are not purged automatically; they are small and expired ones are never listed.
- The audit log (`AuditLog`) holds who did what to which record, by name and id: never content bodies, passwords, tokens or emails. A failure to write an entry never fails the action it describes; it is logged and reported to Sentry.

### The mail daily counter migration (`20261108130000_add_mail_daily_counter`)

Additive: one new table, `MailDailyCounter` (`day` as `YYYY-MM-DD` primary key, `sent` count, `CHECK`s on both), nothing else touched. Run it before deploying the code that sends email; the previous code ignores the table.

- Rollback (roll the app back first): `DROP TABLE "MailDailyCounter"; DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261108130000_add_mail_daily_counter';`, with the **direct** connection string. It loses only today's send count.

### The email confirmation migration (`20261108120000_confirm_registration_email`)

Additive: three nullable columns on `EventRegistration` (`institution`, `confirmedAt`, `reminderSentAt`), no table rewrite and no new table. Every registration that exists today was already a reserved seat, so the migration backfills `confirmedAt = createdAt` and each keeps counting exactly as before (their `institution` stays empty). It also adds `CHECK`s: `institution` 1 to 120 characters when present; a `unl` row has no institution and must be confirmed (Google already verified its address); `reminderSentAt` only on a confirmed row. From then on an open-form row is stored with `confirmedAt` empty and takes no seat until its email is confirmed.

- Deploy order: run the migration first, then deploy the new code immediately after. In the gap the previous code still runs: a UNL registration is refused by the new `CHECK` (the person sees the generic failure and can retry once the new code is up) and an open-form one is stored unconfirmed, so it neither counts nor lists, and the purge deletes it 48 h later, although the previous code told that person their seat was reserved and sent no email.
- Right after the new code is live, keep those gap registrations as the seats they were promised: note the deploy instant in UTC and run `UPDATE "EventRegistration" SET "confirmedAt" = "createdAt" WHERE "mode" = 'open' AND "confirmedAt" IS NULL AND "createdAt" < '<deploy instant UTC>';` with the **direct** connection string. Skip it when no published event takes open-form registrations (`SELECT count(*) FROM "Event" WHERE "registrationMode" = 'open' AND "deletedAt" IS NULL;` returns 0).
- Rollback, only if the feature is abandoned (roll the app back first): `ALTER TABLE "EventRegistration" DROP CONSTRAINT "EventRegistration_reminder_check", DROP CONSTRAINT "EventRegistration_unl_data_check", DROP CONSTRAINT "EventRegistration_institution_check", DROP COLUMN "institution", DROP COLUMN "confirmedAt", DROP COLUMN "reminderSentAt"; ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_unl_data_check" CHECK ("mode" <> 'unl' OR ("career" IS NULL AND "semester" IS NULL)); DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261108120000_confirm_registration_email';`, with the **direct** connection string. Registrations still waiting for their email would turn into reserved seats, so delete them first: `DELETE FROM "EventRegistration" WHERE "confirmedAt" IS NULL;`.

### The event registration migration (`20261027100000_add_event_registration`)

Purely additive: it creates the `EventRegistrationMode` enum (`none`, `unl`, `open`), adds `registrationMode` (default `none`), `registrationCapacity` and `registrationDeadline` to `Event` (with `CHECK`s: capacity positive, and no capacity or deadline while the mode is `none`) and creates the `EventRegistration` table (unique `(eventId, email)`, lower-case email, short text and semester `CHECK`s, `ON DELETE CASCADE` from the event). Existing events keep `none`, so nothing changes for them, and the previous admin keeps working against it (it ignores the columns and the table).

- Deploy order: run the migration first, then deploy the new code.
- Rollback, only if registration is abandoned (roll the app back first): `DROP TABLE "EventRegistration"; ALTER TABLE "Event" DROP CONSTRAINT "Event_registration_capacity_check", DROP CONSTRAINT "Event_registration_settings_check", DROP COLUMN "registrationMode", DROP COLUMN "registrationCapacity", DROP COLUMN "registrationDeadline"; DROP TYPE "EventRegistrationMode"; DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261027100000_add_event_registration';`, with the **direct** connection string. **Every registration is lost with it**: export the CSVs first.

### The publication window migration (`20261026180000_add_publication_window`)

Purely additive: it adds nullable `publishAt` / `unpublishAt` to `Event` and `NewsItem` (each with a `CHECK` that the window closes after it opens) and a nullable `lastSuccessAt` to `DeployStatus`. Catalog-only changes, no rewrite, every existing row keeps `NULL`, so everything stays exactly as published today and the previous admin keeps working against it (it ignores the columns).

- Deploy order: run the migration first, then deploy the new code (the reverse fails: the new code reads the columns).
- Rollback, only if scheduling is abandoned (roll the app back first): `ALTER TABLE "Event" DROP CONSTRAINT "Event_publication_window_check", DROP COLUMN "publishAt", DROP COLUMN "unpublishAt"; ALTER TABLE "NewsItem" DROP CONSTRAINT "NewsItem_publication_window_check", DROP COLUMN "publishAt", DROP COLUMN "unpublishAt"; ALTER TABLE "DeployStatus" DROP COLUMN "lastSuccessAt"; DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026180000_add_publication_window';`, with the **direct** connection string. Every window is lost with it, and anything that was scheduled turns visible as soon as it is published.

### The users, sessions and audit migration (`20261026120000_add_users_sessions_audit`)

Purely additive: it creates the `User`, `Session` and `AuditLog` tables and two enums, and touches no existing table or row, so it is safe on the production database with `prisma migrate deploy`, needs no downtime, and the previous admin keeps working against it.

- Deploy order: run the migration first, then deploy the new code (the reverse fails: the new code reads the tables).
- Rollback, only if the feature is abandoned (roll the app back first, the old code ignores these tables): `DROP TABLE "AuditLog", "Session", "User"; DROP TYPE "ActorKind", "UserRole"; DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026120000_add_users_sessions_audit';`, with the **direct** connection string. The audit history is lost with it.
- The new version no longer accepts the old session cookies (they carry no session id): everybody logs in once more after the deploy.

### The admin invites migration (`20261026160000_add_admin_invites`)

Purely additive: it creates the `AdminInvite` table and touches no existing table or row, so it is safe on the production database with `prisma migrate deploy` and the previous admin keeps working against it (it ignores the table).

- Deploy order: run the migration first, then deploy the new code.
- Rollback, only if invites are abandoned (roll the app back first): `DROP TABLE "AdminInvite"; DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026160000_add_admin_invites';`, with the **direct** connection string. Pending invitations are lost with it; users already created from invitations stay.

### The forum migration (`20261026140000_add_forum`)

Purely additive: it creates the seven `Forum*` tables and two enums and touches no existing table or row, so it is safe on the production database with `prisma migrate deploy`, needs no downtime, and the previous admin keeps working against it (it ignores these tables).

- Deploy order: run the migration first, then deploy the new code.
- Rollback, only if the forum is abandoned (roll the app back first): `DROP TABLE "ForumReport", "ForumReaction", "ForumReply", "ForumThread", "ForumCategory", "ForumSession", "ForumMember"; DROP TYPE "ForumReportStatus", "ForumMemberStatus"; DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026140000_add_forum';`, with the **direct** connection string. Every post is lost with it.

### The forum moderation migration (`20261027120000_forum_moderation_rules`)

Additive and safe with `prisma migrate deploy`: it adds no table or column and rewrites no data. It replaces the two "one report per member per post, forever" unique indexes of the forum migration with **partial** unique indexes (`ForumReport_open_thread_key`, `ForumReport_open_reply_key`, only `WHERE "status" = 'OPEN'`; Prisma cannot declare them, so they live in raw SQL), and adds CHECK constraints saying that a moderator id, a lock or hide actor, a suspension actor or a closing note always comes with the time it happened. The previous build keeps working against it.

- Deploy order: run the migration first, then deploy the new code.
- Rollback (roll the app back first): drop the two partial indexes, recreate the two full unique indexes `("reporterId", "threadId")` and `("reporterId", "replyId")` exactly as in `20261026140000_add_forum` (this fails if a member has since reported a post twice: close the duplicates first), drop the six CHECK constraints named in the migration, then `DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261027120000_forum_moderation_rules';`, with the **direct** connection string.

### The soft-delete migration (`20261025130000_add_soft_delete`)

Safe to apply on the production database with `prisma migrate deploy`; it needs no downtime and no backup beyond your usual one.

- It adds a nullable `deletedAt` (no default) to `Event`, `Faq`, `TerminalCommand`, `SocialLink`, `Pillar`, `NewsItem` and `BoardMember`. In Postgres that is a catalog-only change: no table rewrite, and every existing row gets `deletedAt = NULL`, i.e. stays live exactly as before. No data is read, moved or deleted.
- It replaces the unique indexes on `Event.slug`, `NewsItem.slug`, `Faq.command` and `TerminalCommand.command` with partial ones (`WHERE "deletedAt" IS NULL`). Each new index is created **before** the old one is dropped, so the column is never unprotected, and existing data satisfies it because the new rule is weaker than the old one.
- Deploy order: run the migration first (the old code keeps working on the new schema), then deploy the new code. The reverse order fails, because the new code reads `deletedAt`.
- After deploying, `/admin/papelera` should be empty and every list unchanged.

**Rollback.** Only needed if the feature must be abandoned; the old code works on the new schema, so prefer rolling back the app alone. The previous admin does not know the trash: it lists trashed rows as ordinary drafts. They stay unpublished (moving to the trash unpublished them), so they never reach the public API, but they reappear in the admin lists until the new code is back or the trash is emptied. If the schema must go back too, first empty the trash (delete its items for good from `/admin/papelera`): dropping the column would turn every trashed row back into a live draft, and two rows with the same slug or command would stop the old unique index from being created. Check for those first, then run the statements in one transaction:

```sql
SELECT 'Event' AS "table", "slug" AS value FROM "Event" GROUP BY "slug" HAVING count(*) > 1
UNION ALL SELECT 'NewsItem', "slug" FROM "NewsItem" GROUP BY "slug" HAVING count(*) > 1
UNION ALL SELECT 'Faq', "command" FROM "Faq" WHERE "command" IS NOT NULL GROUP BY "command" HAVING count(*) > 1
UNION ALL SELECT 'TerminalCommand', "command" FROM "TerminalCommand" GROUP BY "command" HAVING count(*) > 1;
-- must return no rows

BEGIN;
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE UNIQUE INDEX "NewsItem_slug_key" ON "NewsItem"("slug");
CREATE UNIQUE INDEX "Faq_command_key" ON "Faq"("command");
CREATE UNIQUE INDEX "TerminalCommand_command_key" ON "TerminalCommand"("command");
DROP INDEX "Event_slug_live_key";
DROP INDEX "NewsItem_slug_live_key";
DROP INDEX "Faq_command_live_key";
DROP INDEX "TerminalCommand_command_live_key";
ALTER TABLE "Event" DROP COLUMN "deletedAt";
ALTER TABLE "Faq" DROP COLUMN "deletedAt";
ALTER TABLE "TerminalCommand" DROP COLUMN "deletedAt";
ALTER TABLE "SocialLink" DROP COLUMN "deletedAt";
ALTER TABLE "Pillar" DROP COLUMN "deletedAt";
ALTER TABLE "NewsItem" DROP COLUMN "deletedAt";
ALTER TABLE "BoardMember" DROP COLUMN "deletedAt";
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261025130000_add_soft_delete';
COMMIT;
```

Run this with the **direct** connection string. Assets of items already deleted for good are gone from Cloudinary and cannot be recovered by the rollback.

## 9. First-deploy checklist

- [ ] Neon project created; pooled and direct URLs copied.
- [ ] `DATABASE_URL='<direct>' npx prisma migrate deploy` ran without errors.
- [ ] Cloudinary cloud name, API key and API secret copied.
- [ ] `ADMIN_SECRET` (≥ 32 chars) and `ADMIN_PASSWORD` (≥ 16 chars, the emergency password) generated and saved in the password manager.
- [ ] Google OAuth client created (section 4a), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_URL` and `ADMIN_BOOTSTRAP_EMAILS` set; the redirect URI in Google matches `AUTH_URL/auth/google/callback`.
- [ ] Optional, only to open the forum (section 4b): `FORUM_ALLOWED_EMAIL_DOMAIN=unl.edu.ec` and `FORUM_SESSION_SECRET` (≥ 32 chars, different from `ADMIN_SECRET`) set, and `https://<admin domain>/foro/auth/google/callback` added to the Google client's redirect URIs.
- [ ] Vercel project: Next.js preset, Node 22.x, `npm ci` / `npm run build`.
- [ ] Production variables set: `DATABASE_URL` (pooled), `ADMIN_PASSWORD`, `ADMIN_SECRET`, `CLOUDINARY_*`, `PUBLIC_CORS_ORIGINS`, and `CLOUDFLARE_DEPLOY_HOOK_URL` once the hook exists. Secrets marked Sensitive.
- [ ] Deployed; `GET /api/health` returns 200; `/admin` redirects to `/login`.
- [ ] Logged in (with Google, or with the password while Google is not configured); the Vercel logs show no `ADMIN_*` error. **Usuarios**, **Sesiones activas** and **Registro de cambios** open for an admin, and an editor is sent back to the home page from **Usuarios**.
- [ ] Uploaded one test photo to a draft event, moved the event to the trash and deleted it for good from `/admin/papelera` (checks Cloudinary and the pooled connection end to end).
- [ ] Seed: dry run read, then `--apply`; the printed `database:` host was the Neon one.
- [ ] `/api/public/content` shows the seeded content; the board has 7 entries.
- [ ] Deploy hook created in Cloudflare and set in Vercel; an edit in the admin starts a landing build ~8 s later.
- [ ] Optional, only to take registrations (section 4c): `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY` set for the open form (a half pair closes the event page's form and logs a warning), the landing's origin in `PUBLIC_CORS_ORIGINS`, and `AUTH_URL` set.
- [ ] Optional, for scheduled content (section 6a): `CRON_SECRET` set, and `vercel.json`'s schedule matches the Vercel plan (daily on Hobby, `*/15 * * * *` only on Pro). Optional, for previews: `PREVIEW_TOKEN_SECRET` set.
- [ ] Optional: Sentry project created and `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` set (section 7).
- [ ] Plan's `maxDuration` limit checked against the `30` in `app/admin/layout.tsx`.
