> Referencia técnica del panel: reglas, contratos y decisiones. Para empezar, leé el [README](../README.md).

# ASO Computación — Admin

Content admin for the ASO Computación student association. It manages the content (events and photos, news, FAQ, board, pillars, socials) that the static landing consumes at build time.

**Deploying:** see [DEPLOY.md](DEPLOY.md) (Vercel, Neon, Cloudinary, environment variables, seeding, first-deploy checklist).

## Stack

- Next.js 15 (App Router) + React 19, TypeScript
- Hexagonal layers: `src/domain`, `src/application`, `src/infrastructure`, `src/interface` (boundaries enforced by `architecture-boundaries.test.ts`)
- Prisma 6 + PostgreSQL
- Cloudinary for images (SDK confined to `src/infrastructure/storage`)
- Vitest 3 for unit and Prisma integration tests; Playwright (Chromium) for end-to-end
- Deployed on Vercel

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` (genera los tipos de imágenes y rutas de Next, que no se versionan) |
| `npm test` | Unit tests |
| `npm run test:coverage` | Unit tests with the coverage thresholds in `vitest.config.ts` (what CI runs) |
| `npm run seed:landing -- --fallback <file> --assets <dir> [--apply]` | Loads the landing's real content into the database (dry run unless `--apply`); see the seeding section of the deployment guide |
| `npm run test:integration` | Prisma integration tests against the disposable Docker database (`docker-compose.test.yml`) |
| `npm run e2e` | Playwright end-to-end tests: starts the disposable Docker Postgres, migrates it, runs `next build`, then the tests against `next start` on port 3100, and tears everything down. Needs Docker and Chromium once (`npx playwright install chromium`). Uses test-only admin credentials unless `ADMIN_PASSWORD`/`ADMIN_SECRET` are set; `TEST_DATABASE_URL` defaults to the canonical test URL |

Requires Node `>=22.12.0` (see `.nvmrc`).

## Environment variables

Copy `.env.example` to `.env` and replace every `__REPLACE_*__` value.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string for development and production |
| `TEST_DATABASE_URL` | Disposable test database used only by `npm run test:integration`; see `.env.example` for the exact required target |
| `ADMIN_PASSWORD` | Shared **emergency (break-glass)** password, only usable while none of the Google variables is set or with `BREAK_GLASS_PASSWORD_LOGIN=1`, **at least 16 characters** (enforced). Use a long random value: it is the real defence against guessing, see "Login throttle". If it is missing, still a placeholder or shorter than 16 characters, login fails closed and an error is logged (once per process) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_URL` | Google sign-in (authorization code + PKCE + `state` + `nonce`, on the server). All three must be set for it to count as configured; `AUTH_URL` is the public https origin. **Some but not all, or an invalid `AUTH_URL`, is a configuration error**: Google login is unavailable, the password login stays off unless `BREAK_GLASS_PASSWORD_LOGIN=1`, `/login` says "Configuración incompleta" and the variables to fix (names only) are logged and reported once per instance.  the redirect URI is `${AUTH_URL}/auth/google/callback`. See [DEPLOY.md](DEPLOY.md#4a-sign-in-with-google-users-and-roles) |
| `ADMIN_BOOTSTRAP_EMAILS` | Comma-separated emails created as ADMIN on their first successful Google login (only when no user has that email yet) |
| `ALLOWED_EMAIL_DOMAIN` | Optional: only Google accounts of this domain can log in |
| `BREAK_GLASS_PASSWORD_LOGIN` | Exactly `1` keeps the shared-password login after Google is configured, or while its configuration is incomplete; off invalidates open emergency sessions. Implicitly on only when none of the three Google variables is set |
| `ADMIN_SECRET` | Secret that signs session cookies (at least 32 characters) |
| `FORUM_ALLOWED_EMAIL_DOMAIN` | Institutional email domain of the student forum (`unl.edu.ec`). Required: unset or empty disables the forum login (fails closed) |
| `FORUM_SESSION_SECRET` | Secret that signs the forum cookies (at least 32 characters, different from `ADMIN_SECRET`); invalid disables the forum login |
| `FORUM_GOOGLE_CLIENT_ID`, `FORUM_GOOGLE_CLIENT_SECRET` | Optional separate Google client for the forum (both or neither); default is the admin's client |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret (server-side only) |
| `PREVIEW_TOKEN_SECRET` | Optional. Signs the draft-preview tokens (at least 32 characters, different from `ADMIN_SECRET` and `FORUM_SESSION_SECRET`). Unset or invalid: no token can be generated or accepted. See "Scheduling and preview" |
| `CRON_SECRET` | Optional. Bearer secret of the scheduled-rebuild cron (at least 32 characters). Vercel sends it by itself. Unset or invalid: `/api/cron/scheduled-rebuild` answers 401 to everyone. See "Scheduling and preview" |
| `TURNSTILE_SECRET_KEY` | Optional until an event uses the open registration form. Server-side secret of Cloudflare Turnstile. In production a missing, empty or placeholder value **closes the open form** (`503`, fail closed); outside production the check is skipped when unset. See "Event registration" |
| `CLOUDFLARE_DEPLOY_HOOK_URL` | Optional. Cloudflare Pages deploy hook (`https` only; the token is part of the path, treat it as a secret and it is never logged). POSTed after every successful admin mutation so the landing rebuilds. Unset: one `info` line per process and no rebuilds (the daily cron is then the only trigger). See "Landing rebuilds" |
| `PUBLIC_CORS_ORIGINS` | Optional. Comma-separated exact origins allowed to read `/api/public/content` from a browser (e.g. `https://aso-computacion.pages.dev`). Unset means no browser origin is granted; the landing's build-time fetch (Node, no CORS) works either way. See "Public read API" |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Optional. Sentry DSN for the server/edge and the browser. Unset (the default) means error tracking is entirely off. See `docs/DEPLOY.md` "Error tracking" |
| `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Optional, 0 to 1, default `0.1` |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Optional. Source maps are uploaded at build time only when the token is set |
| `CLOUDINARY_FOLDER` | Optional base folder for uploads; defaults to `aso-computacion`. Each feature uploads into its own subfolder (e.g. `aso-computacion/events`) |

## Image uploads

Uploads accept JPEG, PNG and WebP up to 5 MB. The minimum width is chosen by each caller (event photos 1200 px; board photos a smaller value). Cloudinary reports the real width after upload; an image narrower than the caller's minimum is destroyed immediately and rejected with `IMAGE_TOO_SMALL`. Images are otherwise retained: replacing a photo never deletes the previous asset, and moving an item to the trash keeps its images too: stored files are destroyed only when an item is deleted for good from the trash (see [Trash](#trash-soft-delete)).

## Admin UI behavior

- **Route states.** `app/admin/error.tsx` (Spanish message, "Reintentar" calls `reset()`, only the error digest is logged and shown, never the message or stack) and `app/admin/not-found.tsx`. `app/not-found.tsx` covers URLs outside `/admin`. There is deliberately no `loading.tsx` (nor any `<Suspense>`) under `app/admin`: with Next 15.5 / React 19.2 a revealed Suspense boundary there drops the refresh after a server action with `revalidatePath`, leaving lists stale (the row stays after trash/publish) until an unrelated re-render. `src/tests/unit/app/admin-route-boundaries.test.ts` enforces it; revisit after upgrading Next/React.
- **Thumbnails.** Admin lists and previews never load the Cloudinary original for a small image. `thumbnailUrl(url, width, height?)` (`lib/cloudinary-thumbnail.ts`) inserts `w_<2×width>[,h_<2×height>],c_fill|c_limit,f_auto,q_auto` into an image delivery URL (`c_fill` with a height, `c_limit` without). It goes after any transformation already in the URL and before the version segment; without a version segment it goes right after `/upload/`. Non-Cloudinary URLs (and invalid widths) come back unchanged. Images stay plain `<img>` with `loading="lazy"`, `decoding="async"` and explicit `width`/`height`.
- **Toasts.** `ToastProvider` (`app/admin/_components/toast.tsx`) wraps the admin content; `useToast().notify(message)` shows a short success message in an `aria-live="polite"` region, auto-dismissed after 5 s (`notify(message, action?)` can add one button, used by the «Deshacer» of a removal) (paused while hovered or focused, closable, at most 3 at once: `src/interface/admin/toasts.ts`). `useRunAction().run(action, onSuccess, successMessage)` raises it after a successful action: publish/unpublish, move to the trash, reorder (the toast is the screen-reader announcement of the new position) and a photo's description. Uploading photos reports how many went through. Forms keep their inline "Cambios guardados." and every error stays inline where it happened.
- **Optimistic publish toggle.** `PublishedToggle` flips at once (`useOptimistic`) while the server action runs. If the action fails the switch goes back to the confirmed state and the inline error explains why. The switch keeps `role="switch"` and `aria-checked` equal to what is shown, with `aria-busy` while pending.
- **Status filter.** The events and news lists have a Todos / Publicados / Borradores filter, each option with its count, driven by `?estado=publicados|borradores` (anything else, or a repeated param, is Todos: `parseStatusFilter`). The filtering is server-side: the page maps the param to a `ListCriteria` (`{ status: "published" | "draft" }`, `statusCriteria`) that `ListEventsUseCase` / `ListNewsItemsUseCase` hand to `EventRepository.list(criteria)` / `NewsRepository.list(criteria)` (a `where isPublished` in Prisma), and the counts come from `countByStatus()` (one `groupBy`), so they do not change with the filter. The lists are paged (see **Search and pages** below), so no row is ever hidden by a limit. The ordered lists (FAQ, pillars, socials, board, commands) have no filter on purpose: their rows move one place at a time inside the whole list, and a filtered view would show positions and move buttons that no longer match it.
- **Search and pages.** Events, news, FAQ and commands lists take `?q=` (trimmed, whitespace collapsed, control characters dropped, at most 80 characters; a repeated param means no search) and `?pagina=` (a plain positive integer, else page 1; a page past the last shows the last). `PAGE_SIZE` is 20 rows (`src/interface/admin/list-params.ts`). The search and the status filter are applied by the repository (`ListCriteria`), the page by its `offset`/`limit`, and the total comes back with the page so the pager and counts are exact. `listHref` leaves defaults out, so every view has one shareable URL. While a list is searched the ordered lists show no place number (`··`) and no move buttons, because a place in the whole list is unknown for a subset.
- **Bulk actions.** On every content list, each row has a checkbox and a bar offers «Seleccionar todo en esta página», «Publicar», «Pasar a borrador» and «Mover a la papelera». Each asks for a confirmation that says how many items and what happens. The two server actions `bulkSetPublished(kind, ids, published)` and `bulkTrash(kind, ids)` (`src/interface/admin/bulk/actions.ts`) accept up to 50 ids of one of the seven content kinds, start with the same session guard as every single-item action and repeat the single-item use cases one after the other, so each rule (publication window, slug, trash cascade) still applies per item and each item that changes writes its own audit entry. A refused item does not stop the rest: the result lists every id with its Spanish reason, successful ones leave the selection, failed ones stay selected with the reason so they can be retried. One landing rebuild is requested for the whole batch, and only if the public site could have changed. The selection only holds ids of the current page.

## Events

`/admin/events` manages events and their photo gallery (list, create, edit, publish toggle, move to the trash).

- An event has a slug (derived from the title, editable), an optional date (future = upcoming on the landing, past = history), an optional type (`taller`, `charla`, `evento`, `comunidad`), optional `hora` / `lugar` / `para`, an https-only link, up to 8 highlights and a `featured` flag. New events are drafts.
- **Month-only dates.** When the day is not confirmed yet, pick "Solo mes" in the form (a month picker instead of the date picker). The event keeps `datePrecision: "month"` and its date is stored as the **first of that month**; with no date the precision is always `day`. The timeline shows it as `feb 2026` and orders it as the 1st of that month, so the current month already counts as past (the landing uses the same rule, with "today" in America/Guayaquil). The column is an add-only migration (`datePrecision` text, default `day`, `CHECK` for `day`/`month`), so existing events stay exact dates.
- Photos need alt text (1–200 characters), are at least 1200 px wide, and an event keeps at most 12 active photos. "Quitar de la galería" deactivates a photo; the Cloudinary asset is kept. Moving an event to the trash keeps its photo rows (active or not) attached, and they come back with it on restore. Only deleting it for good from the trash removes the photo rows and then destroys their stored files, active or not; when a destroy fails the delete still succeeds and the leftover `publicId`s are logged.
- **Registration.** The form's "Inscripción" section chooses, per event, how people sign up: none, with a UNL Google account, or with an open form, plus optional seats and a deadline (Ecuador time). See "Event registration".
- If the database write fails after an upload, the uploaded asset is destroyed (best effort, logged when that fails) and the original error is reported.

## News

`/admin/news` ("Novedades") manages the landing's news: a list (newest publication date first, drafts included), create, edit, publish toggle and move to the trash.

- A news item has a slug (derived from the title, editable, same rules as events; it is the landing's `/novedades/<slug>` URL and a repeated title gets `-2`, `-3`, ...), a title (1–120 characters), a summary (1–280), a body (1–10000), a publication date and an optional cover. New items are drafts.
- **Body.** A Markdown subset (paragraphs, `**bold**`, `*italic*`, `[links](https://...)` and `- lists`), stored exactly as written; the admin never converts it. The landing renders it without raw HTML and only follows `https:` links. A line break in the form is stored as `\n`.
- **Publication date.** A calendar day (`YYYY-MM-DD`), today in Ecuador (UTC-5) when left blank on create and unchanged when left blank on edit. Items are ordered by it, newest first, then by creation time.
- **Cover.** Uploaded through the shared upload flow (folder `news`, JPEG/PNG/WebP up to 5 MB, at least 1200 px wide) and needs alt text (1–200 characters). The five cover columns are set or all null (a `CHECK` in the migration). Creating continues on the edit page, where the cover is added, replaced or removed.
- Replacing or removing the cover, and deleting the item, destroy the previous stored image after the database write succeeded (best effort; the leftover `publicId` is logged and the operation still succeeds). If the database write fails after an upload, the new asset is destroyed and the original error is reported.
- The table is an add-only migration (`NewsItem`), so existing data is untouched.

## FAQ

`/admin/faqs` manages the frequently asked questions: a question (1–200 characters) and an answer (1–1000), shown in list order. The list has move up/down, a publish toggle, create, edit and move to the trash. New questions are drafts and go to the end of the list; moving renumbers the list 0..n-1.

## Pillars

`/admin/pillars` ("Pilares") manages the landing's pillar cards, shown in list order: a word (1–20 characters), a title (1–60), a text (1–300) and an optional image. Same list tools as the FAQ (move up/down, publish toggle, edit, move to the trash). New pillars are drafts, go to the end of the list and start without an image; creating continues on the edit page, where the image is added, replaced or removed.

- The image is uploaded through the shared upload flow (folder `pillars`, JPEG/PNG/WebP up to 5 MB, at least 1200 px wide) and needs alt text (1–200 characters). Image and alt are stored together: all five image columns are set or all null (a `CHECK` in the migration).
- Replacing or removing the image, and deleting the pillar, destroy the previous stored image after the database write succeeded (best effort; the leftover `publicId` is logged and the operation still succeeds). If the database write fails after an upload, the new asset is destroyed and the original error is reported.

## Board

`/admin/board` ("Directiva") manages the board shown on the landing, in list order. A member has **only** a name (1–60 characters, the public display name), a role (1–60) and a photo with its alt text (1–200). Same list tools as the FAQ: move up/down, publish toggle, edit, move to the trash. New members are drafts, go to the end of the list and start without a photo; adding one continues on the edit page, where the photo is added, replaced or removed.

- **Privacy (S4).** The board entity, its form, its result and its table have no contact fields at all: no phone, email, age, personal Instagram or study cycle. The form parser is strict, so such a field in a submitted form is an error and nothing is stored; tests pin the exact set of keys in the domain, the admin result and the Prisma model (DMMF).
- **A member without a photo cannot be published**, enforced in the domain and again by a `CHECK` in the migration. Removing the photo of a published member also unpublishes it.
- The photo is uploaded through the shared upload flow (folder `board`, JPEG/PNG/WebP up to 5 MB) and its five columns are set or null together (a `CHECK`). The minimum width is **577 px**, not the 1200 px of events and pillars: the landing's real board photos (`src/assets/team/`) are 1200, 577, 1200, 720, 1086, 722 and 1200 px wide, so 577 is the largest minimum that admits all of them (it also rejects the 576 px story screenshots of the events archive).
- Replacing or removing the photo, and deleting the member, destroy the previous stored photo after the database write succeeded (best effort; the leftover `publicId` is logged and the operation still succeeds), so a removed member's photo does not linger. If the database write fails after an upload, the new asset is destroyed and the original error is reported.

## Social links

`/admin/socials` ("Redes") manages the landing's social links, shown in list order. A link has a platform (`instagram`, `tiktok`, `linkedin`, `twitch`, `youtube`, `github`, `facebook`, `x`, `discord`, `whatsapp`; chosen from a list), a label (1–40 characters), a handle (1–60), an https-only URL, and an optional note (up to 40) and short blurb (up to 80); a blank note or blurb is stored as empty. Same list tools as the FAQ: move up/down, publish toggle, create, edit, move to the trash. New links are drafts and go to the end of the list.

## Site settings

`/admin/settings` ("Sitio") edits the landing's site texts: a tagline (1–120 characters), a description (1–300) and the "about" text (1–600). They are a singleton: one row whose id is always `site` (enforced by a `CHECK` in the migration), created on the first save and replaced on every later one. Until the first save there is no row and the form starts empty: the read returns `null`, not invented defaults, because the landing keeps its own copy of these texts as the fallback. The hero, manifesto and join copy stay in the landing code for now.

## Trash (soft delete)

Every content type (events, news, FAQ, free commands, social links, pillars, board) is deleted in two steps. The destructive action on a row is now **«Mover a la papelera»**; the row is only removed, with its stored images, by **«Eliminar definitivamente»** on `/admin/papelera`. Event photos (`EventPhoto`) keep their own `isActive` flag and have no trash of their own.

- **Data model.** Seven tables (`Event`, `Faq`, `TerminalCommand`, `SocialLink`, `Pillar`, `NewsItem`, `BoardMember`) have a nullable `deletedAt` (`NULL` = live). Trashing sets it **and unpublishes the row**, so a restore can never put something back on the public site by surprise. A trashed event cascades nothing: its photos stay attached and return with it.
- **Uniqueness applies to live rows only.** `Event.slug`, `NewsItem.slug`, `Faq.command` and `TerminalCommand.command` are enforced by partial unique indexes (`... WHERE "deletedAt" IS NULL`, named `*_live_key`), written in raw SQL in the `add_soft_delete` migration because Prisma cannot express them (`schema.prisma` carries a comment on each column and `prisma migrate diff` reports no drift). Two trashed rows may share a slug, and a trashed row never blocks a new one. The Cloudinary `publicId` columns keep their plain unique indexes: a trashed row still owns its asset.
- **Every read ignores trashed rows.** The repositories filter `deletedAt IS NULL` in `getById`, `list`, `countByStatus` (the status filter counts), `slugExists`, `update`, `saveOrder` (reordering renumbers live rows only), the command-name registry (`findOwner`) and the photo upload lock, and `GET /api/public/content` is built from those same `list()` calls, so a trashed item never reaches the landing. The trash operations (`trash`, `getTrashed`, `listTrashed`, `restore`, `purge`) are the only methods that see trashed rows; they are written once in `TrashablePrismaRepository`.
- **Restore** (`RestoreContentUseCase` and its per-type subclasses) brings the item back **as a draft**; ordered lists (FAQ, commands, socials, pillars, board) append it at the end (`max(sortOrder) + 1`), so positions never collide. If a live item has taken its slug or command in the meantime, the restore is refused with a Spanish message («No se puede restaurar: … Cambie o elimine ese … y vuelva a intentarlo.») and nothing changes; the partial unique index backs this check against races.
- **Delete for good** (`PurgeContentUseCase`, `PurgeEventUseCase`) only accepts an item that is already in the trash; a live one is refused. The row is removed first and its Cloudinary assets are destroyed afterwards, best effort (a failed destroy is logged with its `publicId`, never an error).
- **No automatic expiry.** Nothing leaves the trash unless an admin deletes it for good.
- **Deploy hook.** Trashing a *published* item asks the landing to rebuild (the public content changed); trashing a draft, restoring (always a draft) and deleting for good do not.
- **UI.** The delete button of each row reads «Mover a la papelera»; its toast («Movido a la papelera») has a **Deshacer** button that restores the item. `/admin/papelera` ("Papelera" in the nav) lists the trash by type, newest deletion first, with «Restaurar» and «Eliminar definitivamente» (the latter asks for confirmation and says it cannot be undone and which files go with it). The two server actions, `restoreTrashed(kind, id)` and `purgeTrashed(kind, id)`, are guarded like every other action (`restoreTrashed` by `requireSession`, `purgeTrashed` by `requireRole("ADMIN")`) and refuse an unknown `kind`.
- **Not covered.** Event photos are not trashed (they use `isActive`), and the seed's rollback of a half-created pillar or member trashes and then deletes it for good, so a failed seed leaves nothing behind.

## Public read API

`GET /api/public/content` is what the landing fetches at build time: one JSON snapshot of the **published, non-trashed** content in display order (events and news also only inside their publish window, see "Scheduling and preview"). It needs no session (it is outside the middleware matcher on purpose; `route-protection.test.ts` fails if any other route is reachable without a session) and it only reads.

```jsonc
{
  "version": 1,                       // older name of schemaVersion, same value
  "schemaVersion": 1,                 // version of this contract, see below
  "generatedAt": "2026-10-22T16:00:00.000Z",
  "events":   [{ "slug", "title", "description", "date", "datePrecision", "type", "commitMessage", "hora", "lugar", "para", "featured", "linkUrl", "linkLabel", "highlights", "photos": [{ "url", "width", "height", "alt" }], "registration": {…} | null, "calendarUrl": string | null, "structuredData": {…} | null }],
  "faqs":     [{ "question", "answer" }],
  "pillars":  [{ "word", "title", "text", "image": { "url", "width", "height", "alt" } | null }],
  "socials":  [{ "platform", "label", "handle", "url", "note", "blurb" }],
  "board":    [{ "name", "role", "photo": { "url", "width", "height", "alt" } }],
  "settings": { "tagline", "description", "about" } | null,  // null until first saved: the landing keeps its fallback
  "news":     [{ "slug", "title", "summary", "body", "publishedAt", "cover": { "url", "width", "height", "alt" } | null }]
}
```

- `schemaVersion` (constant `PUBLIC_CONTENT_SCHEMA_VERSION`, `src/interface/public/public-content.mapper.ts`) is an integer that starts at 1 and is bumped **only on a breaking change** (a field removed, renamed or retyped). Adding fields never bumps it, so a consumer can refuse a version it does not know. `version` is the older name of the same value and is kept so existing consumers keep working.
- `datePrecision` is `"day"` or `"month"`. `date` is always a full `YYYY-MM-DD`; a month-only event emits the first of its month (`2026-02-01`) with `"month"`. `YYYY-MM` is never emitted (the landing rejects it). Additive to `version` 1.
- `registration`, `calendarUrl` and `structuredData` on each event are additive to `version` 1 (S8; a landing built against an admin without them treats them as `null`): every previous event key keeps its value (`public-content-registration.mapper.test.ts` pins it). Their shapes are in "Event registration".
- `news` is additive to `version` 1 (a landing built against an admin without it treats it as `[]`): only published items, newest `publishedAt` first. `publishedAt` is a `YYYY-MM-DD` calendar date, `body` is the Markdown subset described in "News" (the landing must never render raw HTML from it), and `cover` is `null` when the item has none.
- Image URLs are the Cloudinary `secure_url` as stored (`https://res.cloudinary.com/<cloud>/image/upload/v<n>/aso-computacion/events/<id>.<ext>`), which is the shape the landing accepts; `cloudinary-media-storage.test.ts` pins that contract.
- Events come newest date first (undated last) with only their active photos in gallery order; news comes newest `publishedAt` first; every other list is in the order set in the admin. Order is the array order, so there is no `sortOrder`.
- Nothing internal leaves: no ids (the event `slug` is the landing's stable id), storage `publicId`s, timestamps or publish flags. The board exposes **only name, role and photo** (S4). News exposes only its slug, texts, date and cover. The mapper builds each object key by key and `public-content.mapper.test.ts` pins every key set.
- `Cache-Control: public, max-age=0, s-maxage=5, must-revalidate`: the edge may collapse a burst of reads for 5 s but never serves a stale copy, because the landing rebuilds right after an edit and must see it.
- `ETag`: a strong validator (quoted SHA-256 of the serialized body). `generatedAt` changes on every read, so it is **left out of the hash**: the ETag changes exactly when the content does. A request with a matching `If-None-Match` (weak comparison, list or `*`) gets `304 Not Modified` with no body and the same `ETag`, `Cache-Control`, `Vary` and CORS headers.
- The 5 s `s-maxage` must stay **below** the deploy-hook debounce (`DEPLOY_HOOK_DEBOUNCE_MS`, 8 s): otherwise a build fired by the hook could read a copy from before the edit. Both constants carry a comment about it and a test pins it.
- CORS: `PUBLIC_CORS_ORIGINS` is an allowlist of exact origins (`https://host[:port]`; plain `http` only for `localhost`/`127.0.0.1`). The request's origin is echoed only when listed, never `*`, always with `Vary: Origin`; an entry with a path, wildcard or trailing slash is ignored and logged once. `OPTIONS` answers the preflight. No credentials are ever allowed.
- Rate limit: 60 requests per minute per client, 429 beyond that. **Best effort only**: the counters live in the memory of one serverless instance, so they are not shared between instances and reset when one is recycled. It stops a single client hammering a single warm instance and nothing more. The real protection is the CDN cache (`s-maxage`): repeated reads are answered at the edge and never reach Postgres. The map of clients is bounded (swept once per window, at most 10 000 tracked, oldest evicted first).
- Errors: any failure answers a generic `503 {"error":"Service unavailable"}` with `Cache-Control: no-store`; the cause is only logged on the server.
- Image URLs (`photos[].url`, `pillars[].image.url`, `board[].photo`, `news[].cover.url`) are Cloudinary delivery URLs, so they contain the cloud name and the asset's `publicId` in the path. Both are public by design (they are needed to display the image) and neither lets anyone upload, change or delete anything; it is the API key and secret that must stay private. Do not treat these URLs as unguessable: an unpublished image whose URL leaked stays reachable until its asset is destroyed.

## Scheduling and preview

Events and news (the content with an editorial timeline) have an optional **publish window**; the other published entities (FAQ, pillars, socials, board, commands) are unchanged and have none.

**Window.** `publishAt` and `unpublishAt` are nullable instants (UTC, `TIMESTAMP(3)`; a `CHECK` requires `unpublishAt > publishAt` when both are set). `isPublished` stays the master switch: a draft is never public, whatever its window. For a published item:

| Moment `now` | State | On the public API |
|--------------|-------|-------------------|
| `now < publishAt` | Programado (scheduled) | hidden |
| `publishAt <= now < unpublishAt` (a missing end is open) | live | shown |
| `now >= unpublishAt` | Vencido (expired) | hidden |

`publishAt` is **inclusive** (visible from that exact millisecond) and `unpublishAt` is **exclusive** (hidden from that exact millisecond). The window is judged on every request to `/api/public/content` (`src/domain/publication-window.ts`); an item with no window is served exactly as before, and the response shape is unchanged (no window field is exposed). Not to be confused with `news.publishedAt`, the calendar date the landing shows.

**Forms.** The event and news forms have "Publicar el" and "Retirar el" (`datetime-local`). They are Ecuador time (America/Guayaquil, UTC-5 all year, no daylight saving), converted without using the server's own zone. Blank clears an end; a form that does not send the field leaves it alone. The lists show "Programado" (with the opening time) or "Vencido" (with the closing time) next to a published item that is not on the site right now.

**Preview.** An Editor or Admin generates a code on `/admin/vista-previa` (validity 1 hour, 24 hours or 7 days; the choice is audited as `preview.token_create`, the token is not). It is a stateless HS256 token signed with `PREVIEW_TOKEN_SECRET`, so it cannot be revoked before it expires: rotate the secret to invalidate every token at once. It is shown once and kept nowhere.

`GET /api/public/preview` (a separate path, so no cache ever mixes the two) returns the same document as `/api/public/content` plus `"preview": true`, and includes drafts and scheduled items of every entity (an expired item stays out). It needs the header `X-Preview-Token: <token>`:

- No token, an expired or forged one, or no `PREVIEW_TOKEN_SECRET`: `401 {"error":"Invalid or expired preview token"}`, `Cache-Control: no-store`, and no content is read.
- A valid token: `200`, `Cache-Control: private, no-store`, no `ETag`, no CORS (it is meant for a server-side preview build of the landing, not for a browser).
- The token is read from the header only (never the URL or a cookie), never logged, and the Sentry scrubber drops the header. It shares the public rate limit (a guessing client gets `429`).

**Cron.** A static landing only shows scheduled content once it is rebuilt after the boundary, so `vercel.json` calls `GET /api/cron/scheduled-rebuild` every 15 minutes. It reads `DeployStatus.lastSuccessAt` (when the deploy hook last accepted a call, from an edit or from the cron itself; a failed attempt does not overwrite it) and POSTs the deploy hook only if a **published, non-trashed** event or news item opened or closed in `(lastSuccessAt, now]`. Nothing changed: no build (`{"crossed":0,"outcome":"not-needed"}`). It requires `Authorization: Bearer <CRON_SECRET>` (Vercel adds it) and answers 401 otherwise, including while `CRON_SECRET` is unset or shorter than 32 characters (it fails closed). Answers: 200 `triggered` / `not-needed` / `disabled` (no `CLOUDFLARE_DEPLOY_HOOK_URL`), 502 `failed` (the hook refused, so the cron shows red in Vercel), 500 on an unexpected error. Scheduled content therefore appears at most about 15 minutes after its time, plus the landing's build time.

**Contract for the landing (not built yet).** For the normal build nothing changes: keep reading `/api/public/content`. For a preview build, fetch `GET <admin>/api/public/preview` **server-side** with the header `X-Preview-Token` (token in a build secret, never in the page or URL), expect `preview: true` and the same shape and `schemaVersion`, never cache or deploy that build publicly, and treat `401` as "token invalid or expired: stop the build". The landing must not receive or compute windows itself.

## Event registration

Each event chooses how people sign up, in the "Inscripción" section of its form (`registrationMode`):

| Mode | Who | Data stored | Where |
|------|-----|-------------|-------|
| `none` (default) | nobody | none | no registration; capacity and deadline are cleared |
| `unl` | a signed-in **forum member** (verified `@unl.edu.ec` Google account, the same identity as the forum) | the member's name and email, as the forum holds them | `/foro/eventos/<slug>` on this admin |
| `open` | anyone, through a form the landing hosts | name, email (**not verified**), career, semester (1 to 12) | `POST /api/public/events/<slug>/registrations` |

Optional **seats** (`registrationCapacity`, 1 to 5000, blank is unlimited) and **deadline** (`registrationDeadline`, Ecuador time, blank means "until the event day is over"). Both are enforced for both modes by one decision, `registrationRefusal` (`src/domain/event-registration.ts`), in this order: the event is not public now (draft, scheduled, expired, trashed, unknown) → `not_found`; the person is using the other mode → `mode_mismatch`; the deadline passed (`now >= deadline`) or the event day (exact dates only) is over in Ecuador → `closed`; this email is already registered → `duplicate`; the seats are used → `full`. The Prisma adapter takes `SELECT … FOR UPDATE` on the event row and runs that same decision inside the transaction that inserts, so two people racing for the last seat, or one email sent twice at once, cannot both get in (`event-registration-prisma.repository.integration.test.ts`; taking the lock out makes those tests fail). Lowering the seats below the number already registered just closes registration; nobody is removed.

**One registration per person and event**: `UNIQUE (eventId, email)` with the email lower-cased (`CHECK`). A repeat attempt changes nothing: the first registration stays as it was.

**UNL mode.** `registerForEvent(slug)` (`src/interface/forum/event-registration.ts`) starts with `requireForumMember()`: only a `forum_session` passes, never an admin one, and a suspended member's session is already refused. It takes **no data from the caller**; the name and email come from the member row, and the email domain is checked again against `FORUM_ALLOWED_EMAIL_DOMAIN` (unset refuses everyone). The page `/foro/eventos/<slug>` shows the event, the state (open, full, closed, already registered) and, for a visitor, a link to the forum's Google login. Known limit: the forum login always returns to `/foro`, so after signing in the student reopens the event link (the forum lane owns that redirect).

**Open form.** The endpoint is public by design (`route-protection.test.ts` lists it). In order, cheapest first: rate limit (5 attempts per client per 10 minutes, `429` + `Retry-After`; best effort per instance like the read limiter), request shape (`Content-Type: application/json`, at most 4 KB read as a stream, a JSON object; `415` / `413` / `400`), **Turnstile** (`turnstileToken` verified server-side with `TURNSTILE_SECRET_KEY`; `400 {"error":"captcha"}` for a missing or rejected token; `503 {"error":"unavailable"}` when Cloudflare cannot be reached, the secret is wrong, or in production there is no secret: **fail closed**), then strict validation and the atomic decision. Fields (extra keys are ignored): `name` 1–120, `email` valid and at most 254, `career` 1–120, `semester` integer 1–12; no control characters. Answers never echo what was sent and are `Cache-Control: no-store`:

| Status | Body | Meaning |
|--------|------|---------|
| 201 | `{"ok":true}` | registered |
| 400 | `{"error":"validation","field":"semester"}` / `{"error":"captcha"}` / `{"error":"bad_request"}` | invalid field, Turnstile failed, malformed JSON |
| 404 | `{"error":"not_found"}` | no such public event, or it does not use the open form |
| 409 | `{"error":"duplicate"}` / `{"error":"full"}` / `{"error":"closed"}` | already registered, no seats, deadline or event day passed |
| 413 / 415 / 429 / 503 | `{"error":"too_large"}` / `unsupported_media_type` / `rate_limited` / `unavailable` | |

CORS is the read API's allowlist (`PUBLIC_CORS_ORIGINS`, exact origins, no credentials); the preflight answers `POST, OPTIONS` and `Content-Type` only to a listed origin. A duplicate answer does reveal that an address is already registered for that event (the price of an unverified email); nothing else about a person is ever returned.

**Calendar file.** `GET /api/public/events/<slug>/calendar.ics` is public (no session, no personal data), rate limited and CORS-allowlisted like the content API, `Cache-Control: public, max-age=0, s-maxage=60, must-revalidate`, `Content-Disposition: attachment`. It exists only for an event that is public now and has an exact day (`404` otherwise). Times come from the first readable `HH:MM`, `HHhMM` or `Hh` in the free-text `hora` (the next one, if later, is the end); with none it is an all-day event. Times are written in UTC (Ecuador has no daylight saving, so no `VTIMEZONE`), text is escaped and lines are folded at 75 octets per RFC 5545. A start without an end has no `DTEND`. `UID` is `<slug>@aso-computacion` (no internal id).

**Public API, per event** (additive; `null` when it does not apply):

```jsonc
"registration": {
  "mode": "unl" | "open",
  "capacity": 40 | null,
  "deadline": "2026-11-27T23:00:00.000Z" | null,   // exclusive, UTC
  "url": "https://<admin>/foro/eventos/<slug>" | null,                        // unl only
  "endpoint": "https://<admin>/api/public/events/<slug>/registrations" | null // open only
} | null,
"calendarUrl": "https://<admin>/api/public/events/<slug>/calendar.ics" | null,
"structuredData": {                                // values for a schema.org Event, Ecuador time
  "startDate": "2026-11-28T09:00:00-05:00",        // or "2026-11-28" when the time is unknown
  "endDate": "2026-11-28T11:00:00-05:00" | null,
  "location": "Laboratorio 2" | null,              // the event's `lugar`
  "registrationUrl": "https://<admin>/foro/eventos/<slug>" | null   // the landing uses its own page for `open`
} | null
```

URLs are built from `AUTH_URL` and are `null` while it is not set. `structuredData` and `calendarUrl` are `null` for a month-only or undated event. The seats left are **not** published (they change with every registration and the landing is static): `capacity` is the total, and the endpoint answers `full` / `closed` when it is too late. For the JSON-LD the landing adds `@type: "Event"`, `name`, `description`, `image`, `eventAttendanceMode` and, when registration exists, `offers: { "@type": "Offer", url: registrationUrl ?? <its own page>, price: "0", priceCurrency: "USD", availability }`.

**Admin.** `/admin/events/<id>/registrations` lists the people (linked from the event editor): **ADMIN and EDITOR** can view; only an **ADMIN** can export (`GET /admin/events/<id>/registrations/export`, a UTF-8 CSV with a byte order mark, every cell quoted, spreadsheet formulas neutralised with a leading `'`; `401` / `403` / `404` as statuses) or delete a registration (`deleteEventRegistration`, `requireRole("ADMIN")`, a row in `action-policy.ts`). Both are audited (`event.registrations_export`, `event.registration_delete`) with the event id and, for the export, a count: **never a name or an email** in a summary. Deleting is permanent and frees the seat.

**Personal data and retention.** Registrations are personal data, kept only for the people who signed up for that event: nothing is shared, there is no analytics on them, and the CSV is the only way out. They are deleted with their event (`ON DELETE CASCADE`, i.e. when it is deleted for good from the trash) or one by one by an ADMIN. **There is no automatic deletion yet**; the proposed policy is to delete them 90 days after the event (see the open questions in the T10 report).

## Landing rebuilds

Every successful admin mutation (events and their photos, news, FAQ, pillars, socials, board, settings) calls `requestSiteRebuild()` after the write, which POSTs `CLOUDFLARE_DEPLOY_HOOK_URL`. It is best effort: it only schedules, never awaits the network and never throws, so it cannot fail or slow the mutation. A failed mutation never fires it (`deploy-hook-actions.test.ts` checks all 39 actions: fired once after the write, not fired on failure or without a session).

- **Coalescing.** A trailing debounce: each call restarts an 8 s quiet window and the hook is POSTed once, 8 s after the last edit, but never later than 15 s after the first edit of the burst (max wait), so a long editing session cannot keep the invocation open past `maxDuration`. Reordering photos or editing several fields is one build, not one per click. The window is longer than the 5 s edge cache of the public route, so the build reads fresh data. The POST has a 5 s timeout; failures and non-2xx answers are logged as warnings (without the URL).
- **Why in process, and the Vercel caveat.** No extra table or queue for a handful of editors. But state is per instance, and a serverless instance may be frozen between requests. So the action registers the wait with `after()` (Next 15), which keeps the invocation alive until the window has elapsed and the hook was called; `app/admin/layout.tsx` sets `maxDuration = 30` so an upload plus the longest wait (15 s) and the hook call (5 s timeout) fits. If an instance is still recycled mid-window, or two instances each debounce their own edit (two builds), the cost is a lost or duplicated rebuild, never a wrong page: the daily rebuild cron is the safety net. On a long-lived server (Render, `next start`) the timer simply runs.
- **Last deploy status.** Each attempt overwrites the single row of `DeployStatus` (id `landing`, enforced by a `CHECK`): when it ran, whether it succeeded, and the HTTP status or a coarse error kind (`timeout`, `network`). The hook URL is a secret and is never stored. The dashboard shows it as "Último despliegue: hace 3 min · OK" or "Último despliegue: Falló (HTTP 500) · hace 2 h" with a hint. **OK means Cloudflare accepted the request, not that the build finished.** Writing the status never fails the content action: a failure is logged (without the error text) and reported to Sentry. The age is computed when the page renders, so reload to refresh it. Nothing is shown if the read fails; "Aún no se solicitó ningún despliegue." appears until the first attempt.
- **Scheduled content** has its own trigger: the cron in "Scheduling and preview" rebuilds only when an item crossed its window since the last accepted call.
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

## The forum is a separate zone

Students are **not** `User` rows. `ForumMember` / `ForumSession` and the other `Forum*` tables are independent of `User` / `Session`, and the forum has its own cookie, secret, claims and guard so that neither kind of session can ever pass the other's check:

- Cookie `forum_session`, `path=/foro`, signed HS256 with `FORUM_SESSION_SECRET` (≥ 32 characters, refused when equal to `ADMIN_SECRET`). Claims `sid`, `mid`, `typ: "forum-session"`, `aud: "aso-computacion-forum"`, `sub = mid`; none of the admin's `kind` / `uid` / `role`. The admin session module, `hasValidClaims`, `requireSession` / `requireRole` and the middleware matcher are untouched; the admin cookie (path `/`) reaches `/foro` but the forum guard reads only its own cookie.
- Guards: `requireForumMember()` (server actions, throws) and `requireForumPageMember()` (pages and reads, redirects to `/foro`) in `src/interface/forum/`. They fail closed (missing secret, bad cookie, revoked or expired session, suspended member, database error). Every student-facing action module starts each action with `requireForumMember()` (`forum-posting.ts`); the admin-side category actions are ordinary admin actions with `requireRole("ADMIN")` and a row in `action-policy.ts`.
- Event registration with a UNL account lives here too: `/foro/eventos/<slug>` and the `registerForEvent` action (`src/interface/forum/event-registration.ts`, guard first, no data taken from the caller). See "Event registration".
- Login: `/foro/auth/google/start` and `/foro/auth/google/callback` (own state cookie `forum_oauth_state`, path `/foro/auth/google`). `FORUM_ALLOWED_EMAIL_DOMAIN` is required (unset = login disabled); the email domain and `hd` must match and the email must be verified. A new valid identity becomes a member on the spot.
- No public DTO (`src/application/dto/forum-result.dto.ts`) carries an email, a Google id or a member id: other students are a display name, and "mine" is a boolean computed for the viewer.
- Posting is throttled per member in the database (`src/application/forum/posting-throttle.ts`); a reply is written under the thread's row lock so a lock racing a reply cannot lose.
- Post text uses the Markdown subset (`src/interface/admin/markdown-subset.ts`), with fenced code blocks only when asked for (`{ codeBlocks: true }`); the news grammar the landing renders is unchanged.

## Server actions are guarded individually

The middleware matcher only covers `/` and `/admin/*`, but a server action can be POSTed to any page that bundles it. Every admin server action must therefore call `requireSession()` (any signed-in user) or `requireRole("ADMIN")` (`src/interface/auth/require-session.ts`) as its first statement, must have a row in `src/tests/support/action-policy.ts` (its role and the audit entry it writes), and must have a test proving it rejects without a session and writes nothing (see `src/tests/unit/interface/admin/events/actions-auth.test.ts`, which also registers the role matrix and audit cases). `action-policy-coverage.test.ts` fails when an actions module or an action has no row, so a new action cannot ship without a decision about who may call it. Pages and the reads that feed them use `requirePageSession()` instead (it redirects rather than throws). Any new admin API route must also be added to the middleware matcher.

## Cómo colaborar

Este panel es parte de un proyecto de la comunidad de ASO Computación y la directiva lo mantiene junto con quien quiera aportar.

- **Contenido** (eventos, fotos, FAQ, directiva, pilares, redes): se edita en el panel desplegado, sin tocar código.
- **Código**: Pull Request contra `main`. `main` está protegida, así que todo cambio entra por PR con una aprobación y la CI tiene que pasar en verde (lint, typecheck, tests, integración y build). Conviene correr lo mismo localmente antes de pedir revisión.
- **Errores e ideas**: abrí un issue con las plantillas del repositorio.

La guía completa, con el flujo de ramas, las reglas de seguridad y privacidad que todo PR respeta y las buenas prácticas para la directiva, está en [CONTRIBUTING.md](../CONTRIBUTING.md). Las vulnerabilidades se reportan en privado según [SECURITY.md](../SECURITY.md).

## License

[MIT](../LICENSE)

## Users, sessions, roles and audit

- **Tables** (`20261026120000_add_users_sessions_audit`): `User` (lower-cased unique email, role `ADMIN`/`EDITOR`, `active`, `lastLoginAt`), `Session` (one row per login: `kind` `user` or `break_glass`, `expiresAt`, `revokedAt`, `lastSeenAt`, short user agent, keyed hash of the client address, never the address) and `AuditLog` (append-only: time, actor id/kind `user`/`break_glass`/`system`, `action`, `entityType`, `entityId`, a short `summary`).
- **Session cookie** (`admin_session`): a signed token carrying `sid`, `kind`, `uid` and a `role` hint. It only names the session; `requireSession()` loads the `Session` row on every action and page read (not revoked, not expired, user active; break-glass also needs the emergency login to be enabled) and takes the role from the user's row. `requireRole("ADMIN")` adds the role check. Cookies are `httpOnly`, `sameSite=lax`, `secure` in production; a login creates a new session and revokes the one the browser presented.
- **Who can do what**: content (events, news, FAQ, commands, board, pillars, socials), the trash and restoring are for any signed-in user; site settings, deleting for good, users and the audit log are `ADMIN` only; sessions: own for anyone, all for an admin. Pages hide what a role cannot use, but the actions enforce it.
- **Google outage vs. refusal.** When the token endpoint is unreachable or answers 5xx, or Google's signing keys cannot be fetched (network error, timeout, non-200, unusable key set), the callback redirects to `/login?error=verification` ("No pudimos verificar tu cuenta de Google. Probá de nuevo en unos minutos."), reports `failure: unavailable` and writes no `login.failure` entry. A bad or reused code, a bad signature, wrong claims or an account that is not on the list keep their own messages ("No se pudo completar el acceso…", "Esta cuenta no tiene acceso."). The operator's action is to wait and retry, and to use the emergency procedure in [DEPLOY.md](DEPLOY.md#emergency-procedure-break-glass) if it persists.
- **Invites** (`20261026160000_add_admin_invites`, table `AdminInvite`): the only way to add a user from the UI. An `ADMIN` creates one for an email and a role; the token (32 random bytes, base64url) appears once in the link `<AUTH_URL>/invitacion/<token>` and only its SHA-256 hash is stored. `/invitacion/<token>` is public, `noindex`, shows the invited email and role while the invite is pending and a neutral "no disponible" otherwise, and links to `/auth/google/start?invite=<token>`. A malformed `invite` value is refused with `/login?error=invite` before any cookie is set; a well-formed one is sealed into the OAuth flow cookie, and the callback redeems it (`RedeemAdminInviteUseCase`) instead of the normal login: the Google email must be verified, inside `ALLOWED_EMAIL_DOMAIN` when set, and equal the invited email. Redemption creates the user and marks the invite used in one transaction, so two concurrent redemptions cannot both win. Every refusal (mismatch, used, revoked, expired, unknown, email already registered) looks the same to the person (`/login?error=invite`) and writes only `login.failure` "Invitación rechazada". Invites last 7 days; creating one for an email revokes that email's older pending invite.
- **Audit entries** are written by the interface layer after each successful mutation (`event.create`, `news.trash`, `faq.purge`, `settings.update`, `user.role_change`, `invite.create`, `invite.redeem`, `invite.revoke`, `session.revoke`, `login.success`, `login.failure`, ...) through one `AuditRecorder` port. A failed write is logged and reported, never surfaced to the person. A `?pagina=` past the last page shows the last page. `/admin/registro` lists them newest first, 25 per page, filtered by entity type and actor.
