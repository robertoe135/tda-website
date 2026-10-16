# Decisions

## 001: Platform for the new tillotsondesign.com

Status: proposed (needs sign-off from leadership and marketing)

### Goal

Keep all existing content and branding, and add structured project metadata, project team
credits, bios for every designer, and cross-linking throughout (project ↔ person ↔ collaborator
↔ typology ↔ location). Mobile is required. Non-developers must be able to maintain it.
JavaScript/TypeScript preferred.

### Options considered

**Stay on Squarespace (rebuild in place).**
Projects become a blog-style collection; typologies become categories; architects, team members,
locations and years become tags with a strict prefix convention (`arch: …`, `team: …`). Tag
URLs give filtered lists, and each bio page uses a Summary Block filtered by that person's tag.
- For: editors already know it; zero hosting or maintenance; no developer dependency.
- Against: Summary Blocks show at most 30 items, so principals' project lists truncate; tags are
  free strings, so a typo silently creates a new "architect"; no labeled fields (year, architect
  render as tags or typed text); one native filter at a time; no map; combined filters require
  third-party plugins and code injection, which recreates the fragility we wanted to avoid.
- Verdict: viable if the 30-item cap, missing map and tag discipline are acceptable. Test it by
  rebuilding 10 projects and 5 people in a duplicate site before ruling it out.

**Webflow.**
Real CMS collections with multi-reference fields; designer-friendly; hosted.
- For: relational content without running infrastructure; marketing can own it.
- Against: not JavaScript; platform lock-in; plan limits on CMS items and references.
- Verdict: the best choice if nobody at TDA can own code long-term.

**Next.js + Sanity.**
- For: excellent editing UI, hosted content, strong relational references.
- Against: content is not self-hosted; usage-based pricing beyond free tier.
- Verdict: good alternative if running a database is unwanted.

**Gatsby + Contentful (what L'Observatoire uses).**
- Against: Gatsby is largely stagnant; Contentful is expensive at this scale.
- Verdict: rejected.

**Next.js + Payload CMS 3 (chosen, pending sign-off).**
- For: TypeScript end to end inside one Next.js app; open source and self-hostable; relationship
  and join fields model the cross-linking directly; drafts, versions, live preview and roles
  for editors; the team already works in Next.js.
- Against: someone at TDA must own deployment, upgrades and backups; Payload was acquired by
  Figma in 2026 and Payload Cloud paused new signups, so hosting is on us.
- Mitigations: TDA-owned repo, managed hosting, runbook, a second person who can deploy, and a
  portable content model.

## 002: Hosting, database and image storage

Status: accepted by the project lead (October 2026); needs sign-off from leadership

- **Vercel (Pro), on the Tillotson Design Associates team**: one Next.js app serves the public
  site, the admin (`/admin`) and the API. Pushing to `main` deploys. Editors log in to `/admin`
  with Payload accounts and need no Vercel seat; only people who deploy code do
  ($20/seat/month).
- **Neon Postgres** (Launch plan, usage-based, about $0-15/month at TDA's scale): all content.
  Scales to zero when idle. Back up before any bulk import (a Neon branch is enough).
- **Vercel Blob** for images (about $1/month at ~5 GB stored and ~20 GB served). Chosen over
  Cloudflare R2 and AWS S3 because at this size the cost difference is under $2/month and Blob
  adds no new account, keys or bill for TDA to own. Reconsider R2 (free egress) if project
  pages add video or traffic reaches hundreds of GB a month. Payload's storage adapters are
  interchangeable, so a move is a file copy, not a content change.
- **Images online are web copies.** Uploads are scaled to 3000 px on the long side and stripped
  of metadata; full-resolution masters stay on TDA's file server.
- **Migrations run at build time on production deploys only** (`vercel.json`). Preview
  deployments must not share the production database once schema changes are in flight:
  enable Neon's preview branches in the Vercel integration before the first schema PR.
- **Estimated total**: about $25-55/month, mostly Vercel seats.

Ownership still to settle (see question 1): move both repositories into a TDA-owned GitHub
organization, confirm the Neon database is billed to TDA, and name a second person who can
deploy and restore.

## Open questions for TDA

1. Who owns the site after launch (content) and who owns the code and hosting (operations)?
   Hosting itself is decided (decision 002); the people are not.
2. Who is credited on project pages: principals, everyone who worked on it, former staff?
3. Will every current designer provide an approved bio and headshot? Who writes the template?
4. Final typology list.
5. Which projects are confidential (client hidden, city-level location only)?
6. Do photography licenses cover web use at larger sizes and social sharing?
7. Do TDA's brand typefaces have web licenses? Where are the brand files?
8. Where is the domain registered and who controls DNS? What email records exist?
9. Which external profiles (ArchDaily, Archinect, directories) should be claimed and corrected,
   and which address is canonical (Suite 703)?
10. Launch scope: is the map view, news, press archive or careers listing required on day one?
11. Should AI assistants and search crawlers be allowed to index the site?
