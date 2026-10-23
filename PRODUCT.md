# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The whole ASO Computación board (7 student members of the Computer Science program at Universidad Nacional de Loja). They all share one admin password and update the public landing's content themselves. They work on phones and laptops equally: right after an event from a phone, and calmly from a laptop when preparing content.

## Product Purpose

Content admin for the ASO Computación landing page. The board creates and publishes events with photo galleries, news (title, summary, text, optional cover, publication date), FAQ, board members (name, role, photo), pillars, and social links. Every change rebuilds the static landing. Success means a board member can publish a real event with its photos in minutes without asking a developer.

## Operating Context

- Main job: after an event, publish it with several photos (title, date, type, short description, alt text per photo). Other content changes rarely.
- Used on phones and laptops equally; both must be comfortable, not just functional.
- Changes reach the public landing through a rebuild, not instantly.

## Capabilities and Constraints

- Next.js 15 admin, deployed on Vercel. Content lives in Postgres (Neon) and photos in Cloudinary.
- One shared password (`ADMIN_PASSWORD`), rotated when the board changes.
- Upload rules: JPEG/PNG/WebP, at most 5 MB, event photos at least 1200 px wide, up to 12 active photos per event, alt text required.
- UI copy is in Spanish, neutral tone; code and docs are in English.
- Board privacy: a member record holds only name, role, and photo. There are no fields for phones, ages, emails, or a personal Instagram.
- UI stack (user choice): Tailwind v4 with the landing's tokens, plus shadcn/ui primitives.

## Brand Commitments

- Same brand as the landing (`aso-computacion-landing/PRODUCT.md`, `src/styles/global.css`): navy `#053066`, sky `#2bb2e4`, mist `#d9d9d9`, signal red `#b7353e`; Audiowide display, Mona Sans body, Geist Mono labels. The landing's "repository history" (git) voice is welcome; the user did not object to developer language.
- The user said it must NOT feel like a generic admin panel (a gray SaaS template with nothing of the ASO), and must NOT be slow or need many steps (uploading 10 photos cannot take 10 forms).

## Evidence on Hand

- Real event photos (20 files, two of them duplicates) in `~/Downloads/fotos-67Hh`, outside the repo. Event names and dates are still unknown; never invent them.

## Product Principles

1. Fast to publish: the event plus its photos is the main path, with the fewest possible steps.
2. Recognizably ASO: the brand lives in precise details, never at the cost of the task.
3. Safe by default: drafts are unpublished until the board publishes them; no personal data beyond name, role and photo.
4. Works the same on phone and laptop.
