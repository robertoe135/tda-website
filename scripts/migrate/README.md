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
