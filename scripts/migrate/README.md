# Squarespace migration

Scripts that move content off the old tillotsondesign.com. Read the migration section of
`.claude/skills/tda-website/SKILL.md` first. Nothing here corrects a real name: anomalies go to
`review.csv` for marketing, and imports write drafts that a person publishes.

## 1. Inventory (`pnpm migrate:inventory`)

Reads the sitemap and writes:

- `out/url-inventory.csv`: every old URL, its kind (project, credits, typology index, page),
  its category, other categories the same project is listed under, and the matching
  "full project credits" page where the match is unambiguous. Every row needs a redirect.
- `review.csv`: generated anomalies plus the hand-written rows in `review-notes.csv`.
  Columns: source URL, field, as written, suggested, note. Edit `review-notes.csv`, not
  `review.csv`, which is regenerated.
- `cache/` (gitignored): the sitemap snapshot and `image-report.csv`. The report lists raw
  image filenames, some of which name private clients, so it never goes into git.

```
pnpm migrate:inventory                                  # fetch the live sitemap
pnpm migrate:inventory scripts/migrate/cache/sitemap.xml # or use a saved copy
```

The live fetch is one request. Squarespace rate-limits automated traffic and may block cloud
servers; if it does, save the sitemap from a browser and pass the file.

## 2. Fetch (`pnpm migrate:fetch`)

Downloads each URL in `out/url-inventory.csv` (plus `/` and two indexed legacy pages) once,
as Squarespace JSON (`?format=json`), falling back to HTML. Saves to
`cache/www.tillotsondesign.com/pages/` and logs to `fetch-log.csv` beside it. No database needed; images are not downloaded.

```
pnpm migrate:fetch --limit 5   # try a few first
pnpm migrate:fetch             # everything; about 15 minutes at the default 2 s delay
pnpm migrate:fetch --delay 4000
```

The script uses only Node's built-in modules, so on Node 23.6 or newer it also runs without
installing the project: `node scripts/migrate/fetch.ts --limit 5`. Squarespace ignores
`?format=json` on this site, so every page is saved as HTML.

- One request at a time with a 2 s pause. On HTTP 429/503 it waits (honouring
  `Retry-After`, otherwise 30 s, 60 s, ...) and stops after five refusals. Rerun later:
  saved pages are skipped.
- Respects robots.txt. If it disallows `?format=json`, the HTML is fetched instead; if a page
  is disallowed entirely it is skipped and counted. `--ignore-robots` overrides this. It is
  TDA's own site, but agree that with marketing first.
- Run it from a normal connection. Squarespace blocks many cloud servers. Behind a proxy
  (e.g. a Claude Code cloud session), Node's fetch needs `NODE_USE_ENV_PROXY=1`.

## 3. Extract (`pnpm migrate:extract`)

Parses the fetched HTML into `cache/www.tillotsondesign.com/extracted/` (gitignored: it holds
owner/client names and raw image filenames):

- `projects.json`: one record per project, merged across the categories it is listed under:
  name, the old label line, location, label firms, description paragraphs (verbatim), hero
  and gallery images with their alt text, press items, every old address, and the credits page
  (facts, roles, photographers, awards). Credits pages are attached through the project page's
  own "Full Project Stats" link. Credits pages no project links to become credits-only
  projects; `/on-the-boards` entries become in-progress projects.
- `people.json` (team page), `firms.json` (every firm spelling, grouped, with the collaborators
  page spelling as the preferred one), `site.json` (contact details and About text).

Conflicts go to `out/review-extract.csv` and `review.csv`: names or firm spellings that
differ between a project page and its credits page, unknown credit labels, locations that
are not "City, ST", and more. That file never contains owner names or image filenames.
Credit label variants live in `credit-labels.ts`; unknown labels are flagged, not guessed.

## 4. Import (`pnpm migrate:import`)

Writes the extracted data into Payload through the Local API. Needs the database
(`DATABASE_URL`) and `PAYLOAD_SECRET` in `.env`.

```
pnpm migrate:import            # create what is missing; existing records are left alone
pnpm migrate:import --update   # also overwrite imported fields on existing projects and people
```

- Projects and people are created as drafts. People have "Show on site" off and no bio.
  Nothing is public until someone at TDA publishes it.
- Creates the 13 typologies in the order of the old portfolio menu. "On the boards" is a
  project status (In progress), not a typology.
- Architects come from the project page label; consultants and secondary architects become
  Credits (role + firms); the Owner becomes the client. Residential projects are imported as
  confidential, which hides the client publicly, until TDA confirms otherwise.
- Firms, clients, locations, credit roles and photographers are matched on their normalized
  name, so spellings that differ only in punctuation share one record. Where the collaborators
  page has the firm, its spelling is used. Different spellings (Pedersen / Pederson) stay
  separate and are listed in review.csv.
- Two project pages are merged only when they share a credits page and the same name.
- Images are not imported; originals come from TDA's file server.
- Safe to rerun: projects are matched on their own old address, so a second run adds nothing.
- Refuses any database not on this machine unless `--confirm-backup` is passed. Take a
  backup first.

## Known gaps

- The sitemap is not the full list of old URLs: pages the audit found indexed
  (`/nyu-steinhardt`, `/upper-east-side-townhouse`) are missing. Add URLs from Google Search
  Console before generating redirects.
- The inventory's address-based credits matching is superseded by the extract step, which
  follows each project page's own credits link.

## 5. Pages (`pnpm migrate:pages`)

Copies the homepage, About, contact and timeline content, word for word:

- Homepage (draft): rows as laid out on the old site (its 24-column grid gives each row's
  layout), with the two quotes in place. The four videos it played are listed in `review.csv`
  with their old addresses; upload the originals under Videos (`docs/editing-the-homepage.md`).
- About page (draft): one section per heading. With `--photos`, each section also gets the
  photograph the old page showed beside it (downloaded at its original size; needs the internet
  and, for the live site, the Blob token). Sections that already have a photo keep it. Each
  copied photo gets a review row: write a description of what it shows.
- Collaborators: ticks **Show on Collaborators page** on every firm the old page lists (all 63).
  A firm is found by its name or other names. The same firm under another spelling ("KPMB
  Architecture" / "KPMB Architects") is listed under the firm on its projects, with the old
  spelling added to its other names. A name with no firm becomes a new firm, as written. Both
  go to review.csv. Firms with published projects link to them; the rest are listed by name.
- Site settings: address, phone, emails, contact intro and careers text, only where empty.
- Timeline: the year from `/timeline` on projects that have none. Where the timeline and the
  project page disagree, nothing changes and the pair goes to `review.csv`. The new
  `/timeline` page is built from each project's year, so the two can no longer drift apart.

```bash
pnpm migrate:pages --confirm-backup              # text, collaborators, homepage heights
pnpm migrate:pages --photos --confirm-backup     # also the About photographs
```

Publish the homepage and About page in the admin after review. `--update` replaces existing
homepage and About drafts.

## 6. Photographers (`pnpm migrate:photographers`)

Splits comma-separated photo credits the first import stored as one photographer, and
credits each project (as a draft) with the photographers its old credits page lists. Run it
before importing photos (`scripts/media/README.md`).


## 7. Redirects (`pnpm migrate:check-redirects`)

Old addresses keep working, from the data rather than a hand-kept list:

- Project and "full project credits" pages: each project stores its old addresses
  (`legacyUrls`); `src/app/(frontend)/[...legacy]` sends them to the project with a permanent
  redirect, in any letter case, once the project is published. Unpublished projects 404 until
  then, so nobody is sent to a page that does not exist yet.
- Category pages (`/museums`, `/sitepublicrealm`, ...) open the portfolio filtered to that
  category; `/on-the-boards` opens On the Boards.
- Menu pages (`/about-5`, `/team`, `/collaborators`) are in `next.config.ts`; a few one-off
  pages are in `src/lib/legacy.ts`.

`pnpm migrate:check-redirects` lists any old address without a destination; add `--live` to
check only what redirects today. Two are open in `review-notes.csv` (`/loyola-chapel`, `/new-page`).

## 8. Duplicate firms and other names (`pnpm migrate:merge-firms`)

A firm has one main record; its abbreviations and other spellings are **Other names**
(aliases) on that record: SOM for Skidmore, Owings & Merrill, or a misspelling found in the
old site. The site always shows the main name. Old filter links, imports and the admin's
duplicate check all treat an alias as the main firm.

When `review.csv` shows one firm as two records, a person picks the main one, then:

```
pnpm migrate:merge-firms --keep "Foster + Partners" --merge "Fosters + Partners"          # list
pnpm migrate:merge-firms --keep "Foster + Partners" --merge "Fosters + Partners" --write  # merge
```

Projects naming the second record (architect, client or credits) move to the main one, the
second record is deleted, and its name becomes an alias. Both the published version and the
latest draft move; a published project's pending draft stays unpublished. (Before October 2026
only the draft moved, so deleting the record silently took the firm off the live page; see
`migrate:restore-credits`.) Names must match exactly. For a name
that never had its own record (an abbreviation), add it under Other names in the admin.

### Decided names (`pnpm migrate:firm-names`)

TDA's decisions live in `firm-names.csv`: one row per firm, the main name, then its other
names separated by `;`. `pnpm migrate:firm-names --write` applies them all: records using any
of the names are merged, the result carries the main name (its web address stays), and every
other name becomes an alias. Run it again any time; rows already applied change nothing.
Decided in October 2026: SOM; Foster + Partners; Kohn Pedersen Fox; Adjaye Associates;
OMA - Office for Metropolitan Architecture.

### Lost credits (`pnpm migrate:restore-credits`)

Puts back firm credits the old credits pages had and the new site lost: lines under labels
the import did not know (now in `credit-labels.ts`), architects a credits page names but the
label line leaves out (now kept as credits under their own role), and firms dropped from live
pages by the old merge. Run `pnpm migrate:extract` first.

```
pnpm migrate:restore-credits                           # list, change nothing
pnpm migrate:restore-credits --write                   # local database
pnpm migrate:restore-credits --write --confirm-backup  # production, after a fresh backup
```

It only adds, to both the live version and the latest draft, and never a firm a person took
off the project. Architects are added only when the site has a firm by exactly that name. The
end of the list is for a person: lines naming several firms at once, names with no firm on
the site, and names that look like a firm already credited under another spelling (often two
records of one firm: merge them with `migrate:merge-firms`). Running it again adds nothing.

## In-progress copies of finished projects (`pnpm migrate:drop-in-progress`)

The old "on the boards" page left some projects on the site twice: once in progress and once
completed (Loyola University Chapel, Princeton Art Museum). TDA's rule: when a completed copy
exists, the in-progress one goes.

```bash
pnpm migrate:drop-in-progress            # list the pairs
pnpm migrate:drop-in-progress --write    # delete them (--confirm-backup if not local)
```

Before deleting, its old web addresses, press, awards and homepage places move to the completed
project, so old links keep working. A pair needs the in-progress name (three words or more) to sit
inside exactly one completed project's name; anything less certain is listed and left alone.

## The team (`pnpm migrate:people`)

Brings the old team page across: 23 people with their names, titles, groups, page order and
headshots.

```bash
pnpm migrate:people                                            # list what would change
pnpm migrate:people --write --publish --confirm-backup         # create, add headshots, publish
```

- Names and titles are copied exactly. For someone already in the admin, an editor's title,
  group and order are kept (a different title on the old page goes to review.csv).
- Everyone on the old page is public there, so "Show on site" is turned on for them.
- Headshots are downloaded at the size TDA uploaded them. Transparent PNGs stay PNG. They're
  renamed and stripped of camera data like every upload. A file named for someone else's
  initials, or marked temporary, goes to review.csv.
- The old site has no bios, and none are written. Each person supplies their own.
- Safe to run again: a second run changes nothing.
