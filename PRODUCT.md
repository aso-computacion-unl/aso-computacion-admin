# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **The ASO Computación board** (students of the Computer Science program at Universidad Nacional de Loja). Each member signs in with their own Google account and has a role: Editor (day-to-day content, moderation) or Admin (site texts, users, permanent deletion, the change log). They work on phones and laptops equally: right after an event from a phone, and calmly from a laptop when preparing content.
- **Students** (secondary, never see the admin). They sign in to the forum (`/foro`) with their institutional `@unl.edu.ec` Google account, and register for events from `/foro/eventos/<slug>`, with that account or with an open form.

## Product Purpose

Content admin for the ASO Computación landing page, plus the two student-facing services that live next to it: a forum and event registration. The board creates and publishes events with photo galleries and optional registration (seats, deadline), news (title, summary, text, optional cover, publication date), FAQ, free terminal commands, board members (name, role, photo), pillars, social links and sponsors; it can schedule events and news, preview drafts before publishing, and moderate the forum. Every published change asks the static landing to rebuild. Success means a board member can publish a real event with its photos in minutes without asking a developer.

## Operating Context

- Main job: after an event, publish it with several photos (title, date, type, short description, alt text per photo). Other content changes rarely.
- Used on phones and laptops equally; both must be comfortable, not just functional.
- Changes reach the public landing through a rebuild, not instantly: the rebuild is requested a few seconds after the last edit and the site updates when that build finishes.
- Several people edit at once, so who changed what is recorded (change log) and sessions can be revoked.

## Capabilities and Constraints

- Next.js 16 admin, deployed on Vercel. Content lives in Postgres (Neon) and photos in Cloudinary. The landing it feeds is a separate static site on Cloudflare Pages (see `docs/ARQUITECTURA.md`).
- Sign-in with Google, one user per person with a role (Admin or Editor); people join through a single-use invitation link. The shared `ADMIN_PASSWORD` remains only as an emergency (break-glass) login, off once Google is configured unless explicitly enabled, and rotated when the board changes.
- The forum and the registrations use a separate student identity (`@unl.edu.ec` Google accounts), never an admin session. Registrations are personal data: only an Admin can export or delete them, and they are deleted 90 days after the event.
- Upload rules: JPEG/PNG/WebP, at most 5 MB, event photos at least 1200 px wide (board photos 577 px, sponsor logos 200 px), up to 12 active photos per event, alt text required.
- Deleting is two steps: items go to a trash and are removed for good (with their files) only by an Admin.
- UI copy is in Spanish, neutral tone; code and docs are in English (the README, CONTRIBUTING and SECURITY are in Spanish for the board).
- Board privacy: a member record holds only name, role, and photo. There are no fields for phones, ages, emails, or a personal Instagram.
- UI stack (user choice): Tailwind v4 with the landing's tokens, plus shadcn/ui primitives. Light and dark theme.

## Brand Commitments

- Same brand as the landing (`aso-computacion-landing/PRODUCT.md`, `src/styles/global.css`): navy `#053066`, sky `#2bb2e4`, mist `#d9d9d9`, signal red `#b7353e`; Audiowide for the wordmark only, Mona Sans for display and body, Geist Mono for labels (`app/globals.css`). The landing's "repository history" (git) voice is welcome; the user did not object to developer language.
- The user said it must NOT feel like a generic admin panel (a gray SaaS template with nothing of the ASO), and must NOT be slow or need many steps (uploading 10 photos cannot take 10 forms).
- The forum follows the Issues direction (user choice): a rail of filters, a list of threads, a conversation lane per thread.

## Evidence on Hand

- `npm run seed:landing` loads the landing's real content (events, FAQ, pillars, socials, board, site texts) into the admin; `npm run seed:demo` fills a local database with demo content for every module, the forum and the landing. The screenshots in the README use demo data.
- Real event photos are not in the repository. Event names and dates beyond the landing's fallback content are unknown; never invent them.

## Product Principles

1. Fast to publish: the event plus its photos is the main path, with the fewest possible steps.
2. Recognizably ASO: the brand lives in precise details, never at the cost of the task.
3. Safe by default: drafts are unpublished until the board publishes them; no personal data beyond name, role and photo for the board, and a student's email is never shown to other students.
4. Works the same on phone and laptop.
