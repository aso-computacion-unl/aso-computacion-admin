# Deploying the admin

The admin runs on **Vercel**, stores data in **Neon** (Postgres) and images in **Cloudinary**. It feeds the static landing (Cloudflare Pages) through `GET /api/public/content` and a deploy hook. Nothing here is automated: each service is set up once by hand.

Order of work: [Neon](#1-neon-postgres) → [Cloudinary](#2-cloudinary) → [Vercel](#3-vercel) → [seed](#5-seeding-the-landing-content) → [wire the landing](#6-wiring-the-landing). The [checklist](#8-first-deploy-checklist) at the end puts it in one list.

## 1. Neon (Postgres)

1. Create a project and a database (any region; pick the Vercel region closest to it in step 3).
2. From **Connect**, copy two connection strings:
   - **Pooled** (host contains `-pooler`): what the running app uses. Append `&pgbouncer=true` (Prisma needs it behind PgBouncer), e.g. `postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/DB?sslmode=require&pgbouncer=true`.
   - **Direct** (no `-pooler`): used only for migrations and the seed.
3. Apply the migrations once from your machine, with the **direct** string. `prisma/schema.prisma` has a single `url = env("DATABASE_URL")` (no `directUrl`), so the direct string is passed as `DATABASE_URL` for that one command:

   ```bash
   DATABASE_URL='<direct connection string>' npx prisma migrate deploy
   ```

   `migrate deploy` applies the committed migrations in `prisma/migrations/` and nothing else; it never resets or generates anything. Run it again after every deploy that adds a migration. It is deliberately **not** part of the Vercel build command: a build would run it through the pooler, where Prisma's migration lock can fail.

The app's SQL (`FOR UPDATE` row locks, `INSERT ... ON CONFLICT` for the login throttle) uses plain transactions and holds no session state, so it fits PgBouncer's transaction mode on paper. It has only been run against a local Postgres, never against Neon: check the first login and the first photo upload after deploying.

## 2. Cloudinary

1. Create a free account. The **cloud name** is on the dashboard.
2. **Settings → API Keys**: create or reuse a key. You need the **API key** and the **API secret**.
3. Nothing else to configure: uploads are signed server-side by the SDK, so no upload preset is needed.

Everything lands under one base folder, `CLOUDINARY_FOLDER` (default `aso-computacion`), with one subfolder per feature: `events`, `pillars`, `board`. Use a different folder per environment if one account serves several (`aso-computacion-staging`).

The image URLs the public API returns contain the cloud name and each asset's `publicId`; both are public by design (see "Public read API" in [REFERENCIA.md](REFERENCIA.md#public-read-api)). The API **secret** is the only private value.

## 3. Vercel

1. **Add New → Project**, import this repository. Framework preset: **Next.js**. Root directory: the repository root.
2. **Node.js version: 22.x** (Settings → General). `package.json` requires `>=22.12.0` and `.nvmrc` says `22`.
3. Build settings, all defaults:

   | Setting | Value |
   |---------|-------|
   | Install command | `npm ci` (its `postinstall` runs `prisma generate`; dev dependencies must be installed, Prisma's CLI is one) |
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
| `ADMIN_PASSWORD` | yes | The one shared password of the whole board. **At least 16 characters**, enforced: shorter, missing or still a placeholder disables login and logs an error. |
| `ADMIN_SECRET` | yes | Signs the session cookie and the "known device" cookie. At least 32 characters. |
| `CLOUDINARY_CLOUD_NAME` | yes | Cloudinary cloud name (step 2). |
| `CLOUDINARY_API_KEY` | yes | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | yes | Cloudinary API secret. Server-side only. |
| `CLOUDINARY_FOLDER` | no | Base folder for every upload. Default `aso-computacion`. Letters, digits, `_`, `-`, `/`. |
| `PUBLIC_CORS_ORIGINS` | no | Comma-separated **exact** browser origins allowed to read `/api/public/content`, e.g. `https://aso.example,http://localhost:4321`. No path, no trailing slash, no `*` (such entries are ignored and logged once). Unset grants no browser origin. The landing's build-time fetch runs in Node and needs no CORS, so this only matters if a browser reads the API. |
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

### Rotating the password (when the board changes)

Change `ADMIN_PASSWORD` in Vercel and redeploy. What that does:

- **Existing sessions stay valid until they expire (24 hours).** A session cookie is signed with `ADMIN_SECRET` only; it does not know the password. A former member who is still logged in keeps access until then.
- **"Known device" cookies stop matching** (they carry a fingerprint of the password), so those browsers fall back to the per-IP login throttle until their next login. That is harmless; it only affects the throttle.
- To cut access **immediately**, rotate `ADMIN_SECRET` as well. That invalidates every session and every device cookie: everyone, including you, logs in again.

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
- **Idempotent.** Items are matched on a stable key: event slug, FAQ question, pillar word, social platform + URL, board name, the settings singleton (compared ignoring case and extra spaces). Whatever already exists is skipped and never modified, so running twice creates nothing and admin edits survive. The flip side: if you **rename or delete** a seeded item in the admin (a trashed one counts as deleted) and run the seed again, it comes back, because the key is all the seed knows. Seed once, then edit in the admin.
- If a run fails midway it stops at the first error, deletes the half-created item and its uploaded image, and exits with code 1. Fix the cause and run it again; it only creates what is missing.
- The seed does **not** trigger a landing rebuild (that hook lives in the admin's server actions). Run the deploy hook yourself afterwards, or wait for the daily cron.

## 6. Wiring the landing

The landing's own deployment (Cloudflare Pages, `ADMIN_CONTENT_URL`, the daily rebuild workflow) is documented in the landing repository. From this side you need two things:

1. Create a **Deploy hook** in the Cloudflare Pages project (Settings → Builds → Deploy hooks) and put its URL in `CLOUDFLARE_DEPLOY_HOOK_URL`.
2. Give the landing the public API URL, `https://<your-vercel-domain>/api/public/content`, and add the landing's production origin to `PUBLIC_CORS_ORIGINS` if a browser will read it.

Check the API by hand: `curl -s https://<your-vercel-domain>/api/public/content` returns `"schemaVersion": 1` and, after seeding, 7 board entries with only `name`, `role` and `photo`.

## 7. Error tracking (Sentry)

The code is wired and does nothing until you do this, once, by hand:

1. Create a free account and a project on sentry.io (platform **Next.js**). Copy its **DSN** (Project Settings → Client Keys).
2. In Vercel (Settings → Environment Variables, Production) set `SENTRY_DSN` **and** `NEXT_PUBLIC_SENTRY_DSN` to that DSN, then redeploy.
3. Optional, for readable stack traces: create an organization auth token (Settings → Developer Settings → Organization Tokens) and set `SENTRY_AUTH_TOKEN` (Sensitive), `SENTRY_ORG` and `SENTRY_PROJECT` in Vercel.
4. Check it: cause a harmless error (for example an action with the database unreachable) and look for it in Sentry.

What is reported: unhandled errors in server components, route handlers and server actions (`onRequestError`), the unexpected failures the server actions and API handlers already log with `console.error` (one helper, `reportError`), the public API's 503s, and browser render errors. What is not: validation errors and other user mistakes.

What never leaves the server: `sendDefaultPii` is off, and a `beforeSend` scrubber removes request bodies, cookies and `authorization`/`cookie`/`set-cookie` headers, and reduces every URL in breadcrumbs, spans and messages to its origin (the deploy hook URL carries a secret token). The trace sample rate defaults to 0.1.

## 8. Operating notes

- A wrong or missing variable shows up in the Vercel function logs, never on screen: `ADMIN_PASSWORD is not set...`, `ADMIN_SECRET is invalid...`. If nobody can log in right after a deploy, read the logs first.
- Failed deletes in Cloudinary never fail an admin action; the leftover `publicId`s are logged and can be removed in the Cloudinary console. Cloudinary assets are destroyed only when an item is deleted for good from the trash, never when it is moved there.
- The dashboard shows the outcome of the last landing rebuild request ("Último despliegue"). A failure there means the content is saved but the site was not asked to rebuild: wait for the daily cron or save another change. Check `CLOUDFLARE_DEPLOY_HOOK_URL` if it keeps failing. Remember to run `prisma migrate deploy` (the `DeployStatus` table) before the first deploy that includes this.
- The login throttle lives in the database (table `LoginAttempt`), so it holds across Vercel instances.

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
- [ ] `ADMIN_SECRET` (≥ 32 chars) and `ADMIN_PASSWORD` (≥ 16 chars) generated and saved in the password manager.
- [ ] Vercel project: Next.js preset, Node 22.x, `npm ci` / `npm run build`.
- [ ] Production variables set: `DATABASE_URL` (pooled, `pgbouncer=true`), `ADMIN_PASSWORD`, `ADMIN_SECRET`, `CLOUDINARY_*`, `PUBLIC_CORS_ORIGINS`, and `CLOUDFLARE_DEPLOY_HOOK_URL` once the hook exists. Secrets marked Sensitive.
- [ ] Deployed; `GET /api/health` returns 200; `/admin` redirects to `/login`.
- [ ] Logged in with the real password; the Vercel logs show no `ADMIN_*` error.
- [ ] Uploaded one test photo to a draft event, moved the event to the trash and deleted it for good from `/admin/papelera` (checks Cloudinary and the pooled connection end to end).
- [ ] Seed: dry run read, then `--apply`; the printed `database:` host was the Neon one.
- [ ] `/api/public/content` shows the seeded content; the board has 7 entries.
- [ ] Deploy hook created in Cloudflare and set in Vercel; an edit in the admin starts a landing build ~8 s later.
- [ ] Optional: Sentry project created and `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` set (section 7).
- [ ] Plan's `maxDuration` limit checked against the `30` in `app/admin/layout.tsx`.
