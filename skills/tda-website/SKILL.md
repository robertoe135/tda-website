---
name: tda-website
description: How to build and maintain the new Tillotson Design Associates (TDA) public website on Payload CMS 3 + Next.js + Postgres. Covers project bootstrap, the relational content model (projects, people, firms, typologies, locations, awards, press, media), migration off the old Squarespace site at tillotsondesign.com with redirects, the mobile-first frontend, and the rules that keep it editable by non-developers. Use this skill whenever someone works on the TDA website, tillotsondesign.com, Payload collections or fields, project pages, team bios, the projects filter or map, Squarespace migration or redirects, or anything in the tda-website repo -- even if they only say "the website", "add a field to projects", "import the old projects" or "the team page".
---

# TDA Website (Payload CMS + Next.js)

The goal is to replace the Squarespace site at tillotsondesign.com with a site where project
information is **structured data, not sentences**. On the old site every project is labeled with
one pipe-delimited string ("One Vanderbilt | New York, NY | Kohn Pedersen Fox"), so nothing is
clickable or filterable. On the new site every architect, person, typology, location, award and
photographer is a record, and pages are generated from the relationships between them.

Keep two audiences in mind at all times:

- **Visitors** (architects, developers, clients, recruits), mostly on phones, looking at photography.
- **Editors** (TDA marketing, not developers) who must be able to add a project or update a bio in
  the admin panel without touching code. If a feature can only be maintained by a developer, it
  is a liability. Prefer a field in the admin over a hardcoded value every time.

## Reference files (read when relevant)

- `references/site-audit.md`: findings on the current Squarespace site, its URL patterns, the
  data-quality issues found, and what must survive migration. Read before any migration or
  redirect work, and before naming typologies.
- `references/competitor-lobs.md`: what L'Observatoire International's site does well and the
  bugs to avoid. Read before building the projects index, team pages or metadata.
- `references/pitfalls.md`: everything that can go wrong, by area. Read the matching section
  before starting work in that area.
- `docs/decisions.md` (repo root): why this stack, alternatives considered, and open questions
  TDA has not answered yet. If a task depends on an open question, stop and ask.

## Stack (do not swap without asking)

- Payload 3 running inside a Next.js App Router project (admin at `/admin`)
- TypeScript everywhere, `pnpm` as package manager
- Postgres via `@payloadcms/db-postgres`
- Uploads on S3-compatible storage (Cloudflare R2 or S3) via `@payloadcms/storage-s3`
- Rich text: Lexical (`@payloadcms/richtext-lexical`)
- Plugins: `@payloadcms/plugin-seo`, `@payloadcms/plugin-redirects`
- Images rendered with `next/image` (AVIF/WebP, responsive `sizes`)

Payload moves quickly. Before writing config, check the installed version in `package.json` and
the current Payload docs for any API you are unsure of (join fields, storage adapter options,
live preview). Do not rely on memory for exact option names.

## Bootstrap (first session only)

1. `pnpx create-payload-app@latest tda-website` and choose the **blank** template with Postgres.
   The `website` template ships blog/page blocks TDA does not need; it is a useful reference for
   wiring live preview, SEO and redirects, but start clean.
2. Confirm `/admin` loads locally and create the first admin user.
3. Add the collections in the order listed below (lookups first, then projects), run
   `pnpm payload generate:types` after each, and keep `tsc --noEmit` clean.
4. Add storage, SEO and redirects plugins.
5. Commit after each collection. Small commits make schema mistakes cheap to undo.

Use Postgres push mode only for local prototyping. As soon as the schema stabilizes, switch to
committed migrations (`pnpm payload migrate:create <name>`, `pnpm payload migrate`) and never
let production rely on push.

## Content model

Collections, with the fields that matter. Every collection that has a public page gets a unique
`slug` field (auto-generated from the name, editable, indexed).

### Lookups

- **typologies**: `name`, `slug`, `order`. Examples: Performing Arts, Museums + Galleries,
  Corporate, Restaurants + Hospitality, Residential, Retail, Libraries + Education, Houses of
  Worship, Exterior + Public Space. Confirm the final list with marketing; do not invent one.
- **locations**: `city`, `region` (state/province), `country`, `lat`, `lng` (two number fields
  rather than a point field, to avoid a PostGIS dependency). Displayed as "New York, NY".
- **firms** (architects and other collaborators): `name`, `slug`, `website`, `projects` (join
  on `projects.architects`). Firm names are canonical here and nowhere else.
- **photographers**: `name`, `website`.

### people

- `name`, `slug`, `title` (Principal, Associate Principal, Senior Associate, Senior Designer,
  Designer, plus admin roles), `group` (Leadership / Design Team / Administration), `order`
- `headshot` (upload), `bio` (rich text), `linkedin`
- `isCurrent` (boolean) and `showOnSite` (boolean, default false)
- `projects` (join on `projects.team`) so each bio lists that person's projects automatically

Never write or invent bio text. If a bio is missing, leave the field empty and let the page
render without it. Bios and headshots come from the people themselves via marketing.

### projects

- `name`, `slug`, `status` (completed / in progress / unbuilt), `year` (completion year or
  expected year), `featured` (boolean)
- `location` (relationship to locations)
- `typologies` (relationship, hasMany): a project can be in several, unlike the old site
- `architects` (relationship to firms, hasMany)
- `otherCollaborators` (array of { `firm` relationship, `role` select: interior designer,
  landscape architect, exhibit designer, artist, other })
- `team` (relationship to people, hasMany), filtered so only `showOnSite` people are selectable
- `client` (text) and `confidential` (boolean). When `confidential` is true, the frontend hides
  client and shows location at city level only. Residential projects are usually confidential.
- `predecessorFirm` (text, optional), for work completed under Kugler Tillotson Associates
- `summary` (plain text, about 2 sentences, used on cards and meta descriptions)
- `description` (rich text)
- `heroImage` (upload) and `gallery` (array of { `image`, `caption` })
- `awards` (join on `awards.project`), `press` (join on `press.projects`)
- `legacyUrls` (array of text): every old Squarespace path for this project, which drives redirects

Enable drafts and versions on projects and people (`versions: { drafts: true }`) so editors can
stage changes and roll back.

### Supporting collections

- **media** (uploads): `alt` is required, `photographer` (relationship), `credit` override text.
  Define image sizes for card, gallery and hero. Every published image needs alt text and a
  photographer credit; the photographers own these images and credit is part of the license.
- **awards**: `name`, `issuer`, `year`, `project` (relationship)
- **press**: `title`, `outlet`, `date`, `url`, `projects` (relationship, hasMany)
- **users**: `email`, `role` (admin / editor). Editors can edit content; only admins touch users
  and settings.

### Globals

- **siteSettings**: address, phone, general email, press email, careers text, social links.
  Nothing like the staff count goes in copy; compute it from `people` where it is needed.
- **about**: philosophy and background rich text.

## Access control

Public reads return published documents only. Unauthenticated users never see drafts,
`showOnSite: false` people, or the `client` field of confidential projects. Enforce this in
collection/field access functions, not only in the frontend, because the REST and GraphQL APIs
are public by default.

## Frontend

Routes:

- `/` featured projects
- `/projects` grid / list / map, filterable by typology, status, location, architect, person
- `/projects/[slug]`
- `/team` and `/team/[slug]`
- `/collaborators/[slug]` (all projects with a given firm)
- `/about`, `/press`, `/contact`

Rules:

- Fetch with the Payload Local API (`getPayload`) in server components. Do not call the REST API
  from your own server code.
- Filters live in URL search params (`/projects?typology=performing-arts&architect=dsr`) so every
  filtered view is linkable and shareable. **Every tag, chip or metadata label must link to a
  correctly filtered view or a detail page.** A tag that links to the unfiltered projects page is
  a bug.
- Design mobile-first. Photography is most of the page weight, so set real `sizes` on every
  `next/image`, lazy-load gallery images, and test at 375px wide before calling anything done.
- Every page sets its own title, meta description and Open Graph image (project hero, person
  headshot). Never ship a page whose OG image or description is undefined or generic. Keep a
  test that checks this for every route.
- Publishing must show up on the live site without a redeploy. Add `afterChange` and
  `afterDelete` hooks that revalidate every page a document appears on: a project change touches
  its own page, its people, its firms, the projects index and the homepage.
- Keep TDA's existing branding: logo, typefaces and colors come from marketing's brand files.
  Do not invent a logo or substitute fonts without asking.
- Basic accessibility: semantic headings, focus states, keyboard-usable filters and gallery, and
  alt text from the media record.

## Migrating from Squarespace

Squarespace's export does not include gallery pages cleanly, so the import is a scrape plus a
review step.

1. Build a URL inventory of the old site from the sitemap (`/sitemap.xml`). Squarespace
   rate-limits aggressively: throttle requests and cache responses to disk so you only fetch once.
2. Parse each project's label string into fields: the first segment is the name, the second is
   the location, and the rest are firms. Normalize firm names against `firms` and create new firm
   records only after a human confirms them, since near-duplicates ("OMA-Office for Metropolitan
   Architecture" vs "OMA - Office for Metropolitan Architecture") are common.
3. **Flag, don't fix.** The old site has spelling variants and typos ("Four Season" vs "Four
   Seasons", "Nicollett", "Associatess", "Upper East Side" vs "Upper Eastside"). Write them to
   `scripts/migrate/review.csv` (columns: source URL, field, as written, suggested, note) for
   marketing; do not silently correct names of real places and firms. The known list is in
   `references/site-audit.md`, section 5.
   Never migrate image filenames as captions: on the old site they expose private client names.
4. Pull original photographs from TDA's file server rather than Squarespace's compressed CDN
   copies. Match by filename where possible and list unmatched images for review.
5. Store every old path in `legacyUrls`, then generate 301 redirects (old typology paths like
   `/corporate/one-vanderbilt`, standalone pages like `/about-5`, `/team`, `/timeline`). Before
   launch, verify that every URL in the old sitemap returns 301 to a live page or 200.
6. Import as drafts. A person at TDA publishes after reviewing each project.
7. Before any DNS change, export every existing DNS record. Moving web records must not touch
   MX, SPF, DKIM or DMARC, or company email stops. See `references/pitfalls.md`, section 6.

Write migration code as scripts in `scripts/migrate/` using the Local API, make them idempotent
(match on slug, update instead of duplicating), and never run them against production without a
fresh database backup.

## Relationship to the internal TDA app

TDA's internal app (app.tillotsondesign.com, Convex/Next.js) already holds project records.
The public website must never connect to it at runtime and must never share its credentials.
If project data is synced, do it with a one-way script that reads an **allowlist** of public
fields, writes drafts into Payload, and is run manually. Anything not on the allowlist (fees,
hours, contacts, internal notes) never leaves the internal app.

## Before calling a task done

- `pnpm payload generate:types` and `tsc --noEmit` pass
- `pnpm build` passes
- Schema changes have a committed migration
- Pages checked at 375px and desktop widths
- New fields are usable by an editor in the admin (sensible labels, descriptions and admin
  defaults), not only by a developer
