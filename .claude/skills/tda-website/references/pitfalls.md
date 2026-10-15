# Pitfalls

Everything identified so far that could sink or stall the project, grouped by kind. Each item
says what goes wrong and what to do about it. Check the relevant section before starting work in
that area.

## Contents

1. Organizational
2. Content and legal
3. Payload and data model
4. Frontend and performance
5. Hosting and operations
6. Migration and launch
7. SEO and discoverability

## 1. Organizational

**Single point of failure.** If one person builds and hosts the site, the firm's public face
depends on that person's availability. Squarespace's real value was that nobody had to be the
sysadmin. Mitigate: code in a TDA-owned GitHub organization (not a personal account), a managed
host, a written runbook (`docs/`), and at least a second person who can deploy and restore.

**No owner for content.** A relational site with empty bios and stale projects looks worse than
the current one. Name the person in marketing who owns each collection before launch.

**Team credit policy is undecided.** Who is credited on a project (principals only, everyone who
worked on it, former staff?) is a policy question for leadership. Until it is answered,
`showOnSite` defaults to false and the team field stays empty. Do not guess.

**Scope creep.** Map view, search, news, newsletter and careers are each real work. Launch with
projects, people, collaborators, about and contact; add the rest after.

**Payload's ownership changed.** Figma acquired Payload in 2026 and Payload Cloud paused new
signups. The open-source package is unaffected, but keep the content model portable (plain
collections, no exotic plugins) so a future move is cheap, and do not plan on Payload Cloud.

## 2. Content and legal

**Bios need consent.** Every person must approve their bio and headshot. Plan a photo day and a
bio template; budget weeks, not days, to collect them.

**Client confidentiality.** Residential and some corporate clients cannot be named. The old site
already leaks a client surname through image filenames used as captions. Use the
`confidential` flag and enforce it in access control, not just in templates.

**Photography licensing.** Architectural photographers license images for specific uses. A
redesign, larger image sizes, or social/OG reuse may fall outside the original license. Confirm
licenses and credit every image.

**Brand font licensing.** Desktop font licenses usually do not cover web embedding. Check that
TDA's typefaces have a web license before building the design around them.

**Predecessor-firm work.** Projects completed under Kugler Tillotson Associates must stay clearly
labeled (`predecessorFirm`) to avoid misattribution.

**Inconsistent facts.** The About page says principals have over 100 years of experience; the
Archinect profile says over 80. Staff counts go stale. Compute counts from data and have
marketing confirm narrative figures.

## 3. Payload and data model

**Version drift.** Payload 3 releases often, and `create-payload-app@latest` has in the past
installed an older version than advertised. Check `package.json` after scaffolding, pin exact
versions, and upgrade deliberately.

**Push mode in production.** Postgres push mode is for prototyping. Shipping without migrations
risks data loss on schema changes. Commit migrations from the moment the schema settles.

**Join fields on nested paths.** Reverse lookups (person → projects, firm → projects) rely on
join fields. Joining through a relationship nested inside an array or group may not be supported
or may behave differently; verify against the current docs before modeling `team` or
collaborators as arrays with roles. The skill keeps `team` and `architects` as top-level
relationships for this reason.

**Public API exposure.** Payload's REST and GraphQL endpoints are public by default. Without
access functions, drafts, hidden people and confidential client names are readable by anyone
who queries the API, regardless of what the pages show.

**Free text where data belongs.** The moment someone types "with DS+R" into a description instead
of linking the firm, the filters lie. Keep descriptions for narrative; relationships for facts.

**Canonical names.** Firm and project names must exist once. Use unique indexes on slugs and
review new firm records on import.

## 4. Frontend and performance

**Published but not live.** Next.js caches aggressively. If publishing in the admin doesn't
revalidate the affected pages (project, its people, its firms, its typology filter views, the
homepage), editors will think the CMS is broken. Add `afterChange` and `afterDelete` hooks that
revalidate every page a document appears on.

**Image weight on phones.** The site is mostly photography. Missing `sizes`, oversized originals
or eager-loaded galleries will make mobile slow. Generate defined image sizes on upload and test
at 375px on a throttled connection.

**Dead-end tags** (see competitor analysis). Every label links somewhere filtered.

**Broken or generic metadata** (see competitor analysis). Add a test that every route renders a
non-empty title, description and absolute OG image URL.

**Map view costs.** Map tiles need a provider and often an API key with usage billing. Geocode
once on save and store lat/lng; never geocode per page view. Consider MapLibre with a free or
self-hosted tile source.

**Filter combinations.** Multiple simultaneous filters (typology + architect + status) need
indexed queries; test with the full project count, not a seed of ten.

## 5. Hosting and operations

**Serverless database connections.** On Vercel or similar, each function instance can open its
own Postgres connection. Use a pooled connection string or a provider with built-in pooling.

**Backups.** Back up both Postgres and the media bucket on a schedule, and test a restore once
before launch. Media is the hard part to recreate.

**Admin security.** `/admin` is public. Require strong passwords, limit login attempts, keep the
user list short, and remove accounts when staff leave.

**Secrets.** `PAYLOAD_SECRET`, database URL and storage keys live in the host's environment
settings, never in the repo.

**Storage egress.** Some S3 providers charge for bandwidth; a photo-heavy site can make that
noticeable. Cloudflare R2 has no egress fees.

## 6. Migration and launch

**Squarespace rate limiting.** The current site returns 429s and blocks automated fetchers.
Throttle the scraper, cache every response to disk, and fetch each URL once.

**Squarespace export is incomplete.** Gallery pages and many blocks don't export. Expect to
scrape.

**Compressed images.** Squarespace serves recompressed copies. Use originals from TDA's file
server; match by filename and report unmatched images.

**Auto-correcting names.** The old site has typos in real names (see the audit). Flag them for
review; never fix silently.

**DNS cutover breaks email.** Moving the domain's DNS away from Squarespace can drop MX, SPF,
DKIM and DMARC records and stop company email. Inventory every existing DNS record before
touching anything, and change only the web records (apex and www).

**Overlapping subscriptions.** Keep Squarespace running until redirects are verified, then
cancel. Don't let the domain registration lapse if it is held at Squarespace.

**Launch without redirects.** Every URL in the old sitemap must 301 to a live page. Include
http→https, www vs apex, trailing-slash variants, typology paths (`/corporate/...`) and oddities
(`/about-5`). Verify with a script before DNS changes, not after.

## 7. SEO and discoverability

**Address inconsistency.** Directories list both Suite 703 and Suite 1680 at 40 Worth Street.
Publish one canonical address in JSON-LD and update external profiles.

**Unclaimed profiles.** ArchDaily (34 projects) and Archinect profiles are unclaimed. Claim them
and point them to the new project pages.

**Inbound links.** Manufacturer case studies (Signify, i2Systems, Specialty Lighting) link to
TDA. Keep those destinations alive via redirects.

**Crawler policy.** The current site blocked an automated research fetcher. Decide deliberately
which crawlers (search engines, AI assistants) may index the new site and set `robots.txt` to
match; a firm that wants to be found should not block discovery by accident.
