# ASO Computación — Admin

Content admin for the ASO Computación student association. It manages the content (events and photos, FAQ, board, pillars, socials) that the static landing consumes at build time.

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
| `npm run test:integration` | Prisma integration tests against the disposable Docker database (`docker-compose.test.yml`) |

Requires Node `>=22.12.0` (see `.nvmrc`).

## Environment variables

Copy `.env.example` to `.env` and replace every `__REPLACE_*__` value.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string for development and production |
| `TEST_DATABASE_URL` | Disposable test database used only by `npm run test:integration`; see `.env.example` for the exact required target |
| `ADMIN_PASSWORD` | Shared administrator password |
| `ADMIN_SECRET` | Secret that signs session cookies (at least 32 characters) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret (server-side only) |
| `CLOUDINARY_FOLDER` | Optional base folder for uploads; defaults to `aso-computacion`. Each feature uploads into its own subfolder (e.g. `aso-computacion/events`) |

## Image uploads

Uploads accept JPEG, PNG and WebP up to 5 MB. The minimum width is chosen by each caller (event photos 1200 px; board photos a smaller value). Cloudinary reports the real width after upload; an image narrower than the caller's minimum is destroyed immediately and rejected with `IMAGE_TOO_SMALL`. Images are otherwise retained: replacing a photo never deletes the previous asset.

## Events

`/admin/events` manages events and their photo gallery (list, create, edit, publish toggle, delete).

- An event has a slug (derived from the title, editable), an optional date (future = upcoming on the landing, past = history), an optional type (`taller`, `charla`, `evento`, `comunidad`), optional `hora` / `lugar` / `para`, an https-only link, up to 8 highlights and a `featured` flag. New events are drafts.
- Photos need alt text (1–200 characters), are at least 1200 px wide, and an event keeps at most 12 active photos. "Quitar de la galería" deactivates a photo; the Cloudinary asset is kept. Deleting an event (an explicit, confirmed action) removes its photo rows and then destroys their stored files, active or not; when a destroy fails the delete still succeeds and the leftover `publicId`s are logged.
- If the database write fails after an upload, the uploaded asset is destroyed (best effort, logged when that fails) and the original error is reported.

## FAQ

`/admin/faqs` manages the frequently asked questions: a question (1–200 characters) and an answer (1–1000), shown in list order. The list has move up/down, a publish toggle, create, edit and delete. New questions are drafts and go to the end of the list; moving renumbers the list 0..n-1.

## Server actions are guarded individually

The middleware matcher only covers `/` and `/admin/*`, but a server action can be POSTed to any page that bundles it. Every admin server action must therefore call `requireAdminSession()` (`src/interface/auth/require-admin-session.ts`) as its first statement and must have a test proving it rejects without a session and writes nothing (see `src/tests/unit/interface/admin/events/actions-auth.test.ts`). Any new admin API route must also be added to the middleware matcher.
