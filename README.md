# ASO Computación — Admin

Content admin for the ASO Computación student association. It manages the content (events and photos, FAQ, board, pillars, socials) that the static landing consumes at build time.

**Deploying:** see [docs/DEPLOY.md](docs/DEPLOY.md) (Vercel, Neon, Cloudinary, environment variables, seeding, first-deploy checklist).

## Stack

- Next.js 15 (App Router) + React 19, TypeScript
- Hexagonal layers: `src/domain`, `src/application`, `src/infrastructure`, `src/interface` (boundaries enforced by `architecture-boundaries.test.ts`)
- Prisma 6 + PostgreSQL
- Cloudinary for images (SDK confined to `src/infrastructure/storage`)
- Vitest 3 for unit and Prisma integration tests
- Deployed on Vercel

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests |
| `npm run seed:landing -- --fallback <file> --assets <dir> [--apply]` | Loads the landing's real content into the database (dry run unless `--apply`); see the seeding section of the deployment guide |
| `npm run test:integration` | Prisma integration tests against the disposable Docker database (`docker-compose.test.yml`) |

Requires Node `>=22.12.0` (see `.nvmrc`).

## Environment variables

Copy `.env.example` to `.env` and replace every `__REPLACE_*__` value.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string for development and production |
| `TEST_DATABASE_URL` | Disposable test database used only by `npm run test:integration`; see `.env.example` for the exact required target |
| `ADMIN_PASSWORD` | Shared administrator password, **at least 16 characters** (enforced). Use a long random value: it is the real defence against guessing, see "Login throttle". If it is missing, still a placeholder or shorter than 16 characters, login fails closed and an error is logged (once per process) |
| `ADMIN_SECRET` | Secret that signs session cookies (at least 32 characters) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret (server-side only) |
| `CLOUDFLARE_DEPLOY_HOOK_URL` | Optional. Cloudflare Pages deploy hook (`https` only; the token is part of the path, treat it as a secret and it is never logged). POSTed after every successful admin mutation so the landing rebuilds. Unset: one `info` line per process and no rebuilds (the daily cron is then the only trigger). See "Landing rebuilds" |
| `PUBLIC_CORS_ORIGINS` | Optional. Comma-separated exact origins allowed to read `/api/public/content` from a browser (e.g. `https://aso-computacion.pages.dev`). Unset means no browser origin is granted; the landing's build-time fetch (Node, no CORS) works either way. See "Public read API" |
| `CLOUDINARY_FOLDER` | Optional base folder for uploads; defaults to `aso-computacion`. Each feature uploads into its own subfolder (e.g. `aso-computacion/events`) |

## Image uploads

Uploads accept JPEG, PNG and WebP up to 5 MB. The minimum width is chosen by each caller (event photos 1200 px; board photos a smaller value). Cloudinary reports the real width after upload; an image narrower than the caller's minimum is destroyed immediately and rejected with `IMAGE_TOO_SMALL`. Images are otherwise retained: replacing a photo never deletes the previous asset.

## Events

`/admin/events` manages events and their photo gallery (list, create, edit, publish toggle, delete).

- An event has a slug (derived from the title, editable), an optional date (future = upcoming on the landing, past = history), an optional type (`taller`, `charla`, `evento`, `comunidad`), optional `hora` / `lugar` / `para`, an https-only link, up to 8 highlights and a `featured` flag. New events are drafts.
- **Month-only dates.** When the day is not confirmed yet, pick "Solo mes" in the form (a month picker instead of the date picker). The event keeps `datePrecision: "month"` and its date is stored as the **first of that month**; with no date the precision is always `day`. The timeline shows it as `feb 2026` and orders it as the 1st of that month, so the current month already counts as past (the landing uses the same rule, with "today" in America/Guayaquil). The column is an add-only migration (`datePrecision` text, default `day`, `CHECK` for `day`/`month`), so existing events stay exact dates.
- Photos need alt text (1–200 characters), are at least 1200 px wide, and an event keeps at most 12 active photos. "Quitar de la galería" deactivates a photo; the Cloudinary asset is kept. Deleting an event (an explicit, confirmed action) removes its photo rows and then destroys their stored files, active or not; when a destroy fails the delete still succeeds and the leftover `publicId`s are logged.
- If the database write fails after an upload, the uploaded asset is destroyed (best effort, logged when that fails) and the original error is reported.

## FAQ

`/admin/faqs` manages the frequently asked questions: a question (1–200 characters) and an answer (1–1000), shown in list order. The list has move up/down, a publish toggle, create, edit and delete. New questions are drafts and go to the end of the list; moving renumbers the list 0..n-1.

## Pillars

`/admin/pillars` ("Pilares") manages the landing's pillar cards, shown in list order: a word (1–20 characters), a title (1–60), a text (1–300) and an optional image. Same list tools as the FAQ (move up/down, publish toggle, edit, delete). New pillars are drafts, go to the end of the list and start without an image; creating continues on the edit page, where the image is added, replaced or removed.

- The image is uploaded through the shared upload flow (folder `pillars`, JPEG/PNG/WebP up to 5 MB, at least 1200 px wide) and needs alt text (1–200 characters). Image and alt are stored together: all five image columns are set or all null (a `CHECK` in the migration).
- Replacing or removing the image, and deleting the pillar, destroy the previous stored image after the database write succeeded (best effort; the leftover `publicId` is logged and the operation still succeeds). If the database write fails after an upload, the new asset is destroyed and the original error is reported.

## Board

`/admin/board` ("Directiva") manages the board shown on the landing, in list order. A member has **only** a name (1–60 characters, the public display name), a role (1–60) and a photo with its alt text (1–200). Same list tools as the FAQ: move up/down, publish toggle, edit, delete. New members are drafts, go to the end of the list and start without a photo; adding one continues on the edit page, where the photo is added, replaced or removed.

- **Privacy (S4).** The board entity, its form, its result and its table have no contact fields at all: no phone, email, age, personal Instagram or study cycle. The form parser is strict, so such a field in a submitted form is an error and nothing is stored; tests pin the exact set of keys in the domain, the admin result and the Prisma model (DMMF).
- **A member without a photo cannot be published**, enforced in the domain and again by a `CHECK` in the migration. Removing the photo of a published member also unpublishes it.
- The photo is uploaded through the shared upload flow (folder `board`, JPEG/PNG/WebP up to 5 MB) and its five columns are set or null together (a `CHECK`). The minimum width is **577 px**, not the 1200 px of events and pillars: the landing's real board photos (`src/assets/team/`) are 1200, 577, 1200, 720, 1086, 722 and 1200 px wide, so 577 is the largest minimum that admits all of them (it also rejects the 576 px story screenshots of the events archive).
- Replacing or removing the photo, and deleting the member, destroy the previous stored photo after the database write succeeded (best effort; the leftover `publicId` is logged and the operation still succeeds), so a removed member's photo does not linger. If the database write fails after an upload, the new asset is destroyed and the original error is reported.

## Social links

`/admin/socials` ("Redes") manages the landing's social links, shown in list order. A link has a platform (`instagram`, `tiktok`, `linkedin`, `twitch`, `youtube`, `github`, `facebook`, `x`, `discord`, `whatsapp`; chosen from a list), a label (1–40 characters), a handle (1–60), an https-only URL, and an optional note (up to 40) and short blurb (up to 80); a blank note or blurb is stored as empty. Same list tools as the FAQ: move up/down, publish toggle, create, edit, delete. New links are drafts and go to the end of the list.

## Site settings

`/admin/settings` ("Sitio") edits the landing's site texts: a tagline (1–120 characters), a description (1–300) and the "about" text (1–600). They are a singleton: one row whose id is always `site` (enforced by a `CHECK` in the migration), created on the first save and replaced on every later one. Until the first save there is no row and the form starts empty: the read returns `null`, not invented defaults, because the landing keeps its own copy of these texts as the fallback. The hero, manifesto and join copy stay in the landing code for now.

## Public read API

`GET /api/public/content` is what the landing fetches at build time: one JSON snapshot of the **published** content in display order. It needs no session (it is outside the middleware matcher on purpose; `route-protection.test.ts` fails if any other route is reachable without a session) and it only reads.

```jsonc
{
  "version": 1,                       // shape version of this document
  "generatedAt": "2026-10-22T16:00:00.000Z",
  "events":   [{ "slug", "title", "description", "date", "datePrecision", "type", "commitMessage", "hora", "lugar", "para", "featured", "linkUrl", "linkLabel", "highlights", "photos": [{ "url", "width", "height", "alt" }] }],
  "faqs":     [{ "question", "answer" }],
  "pillars":  [{ "word", "title", "text", "image": { "url", "width", "height", "alt" } | null }],
  "socials":  [{ "platform", "label", "handle", "url", "note", "blurb" }],
  "board":    [{ "name", "role", "photo": { "url", "width", "height", "alt" } }],
  "settings": { "tagline", "description", "about" } | null   // null until first saved: the landing keeps its fallback
}
```

- `datePrecision` is `"day"` or `"month"`. `date` is always a full `YYYY-MM-DD`; a month-only event emits the first of its month (`2026-02-01`) with `"month"`. `YYYY-MM` is never emitted (the landing rejects it). Additive to `version` 1.
- Image URLs are the Cloudinary `secure_url` as stored (`https://res.cloudinary.com/<cloud>/image/upload/v<n>/aso-computacion/events/<id>.<ext>`), which is the shape the landing accepts; `cloudinary-media-storage.test.ts` pins that contract.
- Events come newest date first (undated last) with only their active photos in gallery order; every other list is in the order set in the admin. Order is the array order, so there is no `sortOrder`.
- Nothing internal leaves: no ids (the event `slug` is the landing's stable id), storage `publicId`s, timestamps or publish flags. The board exposes **only name, role and photo** (S4). The mapper builds each object key by key and `public-content.mapper.test.ts` pins every key set.
- `Cache-Control: public, max-age=0, s-maxage=5, must-revalidate`: the edge may collapse a burst of reads for 5 s but never serves a stale copy, because the landing rebuilds right after an edit and must see it.
- CORS: `PUBLIC_CORS_ORIGINS` is an allowlist of exact origins (`https://host[:port]`; plain `http` only for `localhost`/`127.0.0.1`). The request's origin is echoed only when listed, never `*`, always with `Vary: Origin`; an entry with a path, wildcard or trailing slash is ignored and logged once. `OPTIONS` answers the preflight. No credentials are ever allowed.
- Rate limit: 60 requests per minute per client (in memory, per instance), 429 beyond that. The map of clients is bounded (swept once per window, at most 10 000 tracked, oldest evicted first).
- Errors: any failure answers a generic `503 {"error":"Service unavailable"}` with `Cache-Control: no-store`; the cause is only logged on the server.
- Image URLs (`photos[].url`, `pillars[].image.url`, `board[].photo`) are Cloudinary delivery URLs, so they contain the cloud name and the asset's `publicId` in the path. Both are public by design (they are needed to display the image) and neither lets anyone upload, change or delete anything; it is the API key and secret that must stay private. Do not treat these URLs as unguessable: an unpublished image whose URL leaked stays reachable until its asset is destroyed.

## Landing rebuilds

Every successful admin mutation (events and their photos, FAQ, pillars, socials, board, settings) calls `requestSiteRebuild()` after the write, which POSTs `CLOUDFLARE_DEPLOY_HOOK_URL`. It is best effort: it only schedules, never awaits the network and never throws, so it cannot fail or slow the mutation. A failed mutation never fires it (`deploy-hook-actions.test.ts` checks all 33 actions: fired once after the write, not fired on failure or without a session).

- **Coalescing.** A trailing debounce: each call restarts an 8 s quiet window and the hook is POSTed once, 8 s after the last edit, but never later than 15 s after the first edit of the burst (max wait), so a long editing session cannot keep the invocation open past `maxDuration`. Reordering photos or editing several fields is one build, not one per click. The window is longer than the 5 s edge cache of the public route, so the build reads fresh data. The POST has a 5 s timeout; failures and non-2xx answers are logged as warnings (without the URL).
- **Why in process, and the Vercel caveat.** No extra table or queue for a handful of editors. But state is per instance, and a serverless instance may be frozen between requests. So the action registers the wait with `after()` (Next 15), which keeps the invocation alive until the window has elapsed and the hook was called; `app/admin/layout.tsx` sets `maxDuration = 30` so an upload plus the longest wait (15 s) and the hook call (5 s timeout) fits. If an instance is still recycled mid-window, or two instances each debounce their own edit (two builds), the cost is a lost or duplicated rebuild, never a wrong page: the daily rebuild cron is the safety net. On a long-lived server (Render, `next start`) the timer simply runs.
- An edit of an unpublished draft also asks for a rebuild: the action cannot tell cheaply that nothing public changed, and the debounce makes it harmless.

## Login throttle

The login is throttled per client, in Postgres (table `LoginAttempt`), so the limit holds across Vercel instances; an in-memory map is per instance and N instances multiplied the allowed guesses by N.

- **Exponential backoff, not a lockout.** The first 5 attempts from an IP are free; after that the next attempt must wait 30 s, then 60 s, 120 s, 240 s, and 5 min at most. Attempts made while waiting are refused without counting, so hammering never extends the wait. After 1 hour without attempts the counter restarts, and the stale rows are purged.
- **Why not the old "5 failures, 15 minutes locked".** On a shared network (a campus NAT puts everyone behind one IP), anyone could lock the administrator out for as long as they liked. With a capped backoff the worst case is a wait of 5 minutes, and a different network (mobile data) is never affected. The correct password is *not* a way around the wait: a throttled IP is refused even with the right password, otherwise the throttle would answer guesses for free.
- **Known-device cookie.** A capped backoff alone still lets someone on the administrator's own network keep the IP at the cap forever (one attempt per 5 minutes is theirs to take). So a successful login also sets `admin_device`: a signed (same `ADMIN_SECRET`), `httpOnly`, `secure`, `sameSite=strict` cookie, valid for 180 days and renewed on every login, carrying a random device id. A login attempt with a valid `admin_device` is throttled in its own bucket (`device:<id>`) and ignores the IP bucket, so the attacker's attempts no longer reach the administrator. The device bucket has the same backoff, so a stolen cookie is not an unlimited guessing oracle, and a good login clears only the bucket it spent. A forged, expired or missing cookie falls back to the IP bucket. The cookie can never act as a session: it has another name and purpose claim and no `sub: "admin"`. The cookie is also bound to the current `ADMIN_PASSWORD` through a `pv` claim (a truncated HMAC of the password keyed with `ADMIN_SECRET`; it reveals nothing about the password), so rotating `ADMIN_PASSWORD` when the board changes makes every device cookie stop matching and those browsers fall back to the IP bucket until their next login. Rotating `ADMIN_SECRET` invalidates every device cookie (and every session). The first login from a new browser, or after clearing cookies, is still on the IP bucket.
- **IPv6 by /64.** An IPv6 client owns a whole /64, so the key is the /64 prefix (`2001:db8:1:2::/64`), not the address: rotating through the host part buys nothing. IPv4 and IPv4-mapped IPv6 addresses (`::ffff:a.b.c.d`) are keyed as they come.
- **Trade-off, no global ceiling.** A cap across all IPs would let any attacker lock the administrator out from everywhere, a worse failure than a neighbour on the same NAT. A botnet that rotates IPs is held back by the strength of `ADMIN_PASSWORD` (hence the 16-character minimum), not by this throttle.
- **Bounded exponent.** The doubling stops at 2^10, so a key held at the cap for days cannot overflow the SQL arithmetic; the wait itself is capped at 5 minutes anyway.
- **Atomic.** Each attempt is spent *before* the password is compared, in a single `INSERT ... ON CONFLICT DO UPDATE ... WHERE` statement, so 30 parallel guesses spend at most the 5 free attempts. A successful login deletes the row of the bucket it spent (the IP's, or the device's).
- **Fails closed.** If the throttle store cannot be reached, login is refused ("temporarily unavailable") instead of running unprotected; the error is logged. If `ADMIN_PASSWORD` is unusable (unset, placeholder or under 16 characters), login is refused the same way and an `ADMIN_PASSWORD is not set, is still a placeholder or is shorter than 16 characters` error is logged once per process (not per attempt).
- **The client IP** is `x-real-ip`, then the first `x-forwarded-for` entry (Vercel overwrites both). Without either header (local development, a bare `next start`) every request shares one `unknown` bucket: it is throttled like any other key, so it is safe, but everyone behind it slows each other down. A warning says so once per process.

## Server actions are guarded individually

The middleware matcher only covers `/` and `/admin/*`, but a server action can be POSTed to any page that bundles it. Every admin server action must therefore call `requireAdminSession()` (`src/interface/auth/require-admin-session.ts`) as its first statement and must have a test proving it rejects without a session and writes nothing (see `src/tests/unit/interface/admin/events/actions-auth.test.ts`). Any new admin API route must also be added to the middleware matcher.
