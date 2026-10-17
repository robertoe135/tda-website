# Content check (`pnpm content:check`)

A read-only list of what is left to finish before the site reads as complete. Run it on the
computer that has the production `.env.local` (it only reads):

```
pnpm content:check
```

It prints a summary and writes `scripts/content/out/content-review.csv` (not committed: draft
names can include private clients). Open the CSV in Excel; each row has a link into the admin.

| Area | What it lists |
| --- | --- |
| Project | No photos; photos on the draft but not live; no photographer credit; no category; no completion year; no location; no design architect; no write-up |
| Possible duplicate | Two names that may be one project: same words in another order or spelling (Hotel Barrier / Hôtel Barrière), one misspelled word (Nielson / Neilson), or one name inside the other (Rainbow Room / Rainbow Room at Rockefeller Center) |
| Person | On the team page without a headshot, title or bio |
| Homepage | A tile hidden because its project is not published |

A "possible duplicate" is a question, not a verdict: two names can share words and still be two
projects. Nothing is changed, merged or written for you: write-ups and bios come from TDA.
