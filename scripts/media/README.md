# Project photo import

Brings marketing's curated web photographs into the site. Text and facts stay as imported
from Squarespace; the copy files in the Website folder are for reference only and are not read.

Source: `F:\Marketing\Website\Photos`, laid out as

```
<Category>\<N. Project Name>\<Name>_NN.jpg
Corporate\1. Comcast Technology Center\Comcast Center_01.jpg
```

`_NN` sets the slideshow order; the first photo is the project's main image. Only images
directly inside a project folder are read (JPEG, PNG, TIFF, WebP). Copy files and subfolders
are ignored. Licenses for web use were confirmed in October 2026 (`docs/decisions.md`, Q6).

## Before you start

- Run it at the office, or anywhere the F: drive is reachable. On a Mac, mount the share
  (Finder → Go → Connect to Server); the folder appears under `/Volumes/`.
- Never through the internal TDA app or its file-server tunnel.
- For the live site, `.env` needs `DATABASE_URL` (Neon) and `BLOB_READ_WRITE_TOKEN`
  (Vercel → Storage → tda-website-storage → Tokens). Make a Neon branch as a backup first.
- Once only, before the first photo import: `pnpm migrate:split-photographers --write
  --confirm-backup`. The first import stored lines like "Brett Beyer, Iwan Baan" as one
  photographer; this splits them into people, keeping every spelling as written.

## 1. Scan

```
pnpm media:scan "/Volumes/<share>/Marketing/Website/Photos"
```

Reads only. Writes `scripts/media/cache/photos.csv` (kept out of git: file names can name
private clients). One row per photo:

| Column | Meaning |
| --- | --- |
| `include` | `yes` to import. Filled in only when the folder name matches a project exactly. |
| `project` | The website project's slug. A best guess when the match was not exact: check it. |
| `slide` | Order in the slideshow; 1 is the main image. Change the numbers to reorder. |
| `photographer` | Filled in when the old site credits exactly one photographer for the project. |
| `alt` | Description for screen readers. Starts as "<Project>, photograph N"; better ones welcome. |
| `note` | Why a row needs a look: a guessed match, several photographers, a category that differs. |

A project filed under several categories uses the folder with the most photos.

## 2. Check the CSV (marketing)

Open it in Excel, fix what the notes point at, write `yes` where a guess is right, clear
`include` for photos that should not go on the site, and save as CSV in the same place.
Every included photo needs a photographer who exists under Photographers in the admin.

## 3. Import

```
pnpm media:import "/Volumes/<share>/Marketing/Website/Photos"            # check only
pnpm media:import "/Volumes/<share>/Marketing/Website/Photos" --write --confirm-backup
```

- All or nothing: any problem (missing file, unknown photographer, no description) stops it
  before the first upload, with the CSV line of each problem.
- Photos are scaled to 3000 px and stripped of camera data on your computer; originals stay
  on F:.
- Projects that already have photos are skipped unless `--replace` is added.
- Projects are saved as drafts. Publish them in the admin to show the photos.
- Safe to run again after an interruption: photos already uploaded are reused, not duplicated.
