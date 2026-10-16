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
as Squarespace JSON (`?format=json`), falling back to HTML. Saves to `cache/pages/` and logs
to `cache/fetch-log.csv`. No database needed; images are not downloaded.

```
pnpm migrate:fetch --limit 5   # try a few first
pnpm migrate:fetch             # everything; about 15 minutes at the default 2 s delay
pnpm migrate:fetch --delay 4000
```

- One request at a time with a 2 s pause. On HTTP 429/503 it waits (honouring
  `Retry-After`, otherwise 30 s, 60 s, ...) and stops after five refusals. Rerun later:
  saved pages are skipped.
- Respects robots.txt. If it disallows `?format=json`, the HTML is fetched instead; if a page
  is disallowed entirely it is skipped and counted. `--ignore-robots` overrides this. It is
  TDA's own site, but agree that with marketing first.
- Run it from a normal connection. Squarespace blocks many cloud servers.

## Known gaps

- The sitemap is not the full list of old URLs: pages the audit found indexed
  (`/nyu-steinhardt`, `/upper-east-side-townhouse`) are missing. Add URLs from Google Search
  Console before generating redirects.
- Credits pages are matched to projects by their addresses. 44 of 138 could not be matched
  with confidence; the page fetch step will read each project page's credits link instead.
