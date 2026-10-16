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
- Once only, before the first photo import: `pnpm migrate:photographers --write
  --confirm-backup`. It splits credits the first import stored as one photographer ("Brett
  Beyer, Iwan Baan") and credits each project with the photographers its old credits page
  lists. TDA credits photography per project, so most photos need no credit of their own.

## 0. Inventory: what is on the drive (`pnpm media:inventory`)

Before uploading anything, see what the website folder holds:

```
pnpm media:inventory "/Volumes/T7/Website"
pnpm media:inventory "/Volumes/T7/Website" --match    # also match folders to website projects
```

Reads only, and only what the import would use: `Photos/<portfolio category>/<project>/`.
Archive, Website Text and other top-level folders are never read; folders marked NO RIGHTS or
Removed, non-portfolio categories (Lifestyle Photos, Firm Profile) and PSDs are left out and
counted. A **Projects to add** folder (at the top or inside Photos) is listed per project:
photos, videos, documents and subfolders, and with `--match` whether each is already on the
website. Prints:

- counts and sizes: photos, images to export first (HEIC, PSD, RAW), videos, documents;
- the folders three levels deep, with how many photos, videos and documents each holds;
- roughly how much would go into Blob if every photo went on the site;
- what needs attention: images to export, videos to convert or shorten (over 15 MB), small
  photos that would look soft, the same photo filed twice.

Folder names under any Residential or Private folder are hidden in the printed summary, so it
can be pasted into a chat or email. Every file, with real names, goes to
`scripts/media/cache/inventory.csv` (kept out of git). `--match` needs `DATABASE_URL`
(local or production; it only reads).

## 1. Scan

```
pnpm media:scan "/Volumes/T7/Website"     # or the Photos folder itself
```

Reads only. Writes `scripts/media/cache/photos.csv` (kept out of git: file names can name
private clients). One row per photo:

| Column | Meaning |
| --- | --- |
| `include` | `yes` to import. Filled in only when the folder name matches a project exactly. |
| `project` | The website project's slug. A best guess when the match was not exact: check it. |
| `slide` | Order in the slideshow; 1 is the main image. Change the numbers to reorder. |
| `photographer` | Leave empty: the project's Photography credit covers its photos. Fill in only for a photo by someone else. |
| `alt` | Description for screen readers. Starts as "<Project>, photograph N"; better ones welcome. |
| `note` | Why a row needs a look: a guessed match, a project without a photographer, a category that differs. |

A project filed under several categories uses the folder with the most photos.

## 2. Check the CSV (marketing)

Open it in Excel, fix what the notes point at, write `yes` where a guess is right, clear
`include` for photos that should not go on the site, and save as CSV in the same place.
A project with no photographer stops the import: add one to the project (Images →
Photographers) or to its photos.

## 3. Import

```
pnpm media:import "/Volumes/<share>/Marketing/Website/Photos"            # check only
pnpm media:import "/Volumes/<share>/Marketing/Website/Photos" --write --confirm-backup
```

- All or nothing: any problem (missing file, no credit, no description) stops it
  before the first upload, with the CSV line of each problem.
- Photos are scaled to 3000 px and stripped of camera data on your computer; originals stay
  on F:.
- Projects that already have photos are skipped unless `--replace` is added.
- `--skip-uncredited` leaves out projects with no photographer, lists them, and imports the
  rest. Run it again once their credits are in: what's already uploaded is skipped.
- Projects are saved as drafts. Publish them in the admin to show the photos.
- Safe to run again after an interruption: photos already uploaded are reused, not duplicated.

## 4. Projects to Add (`pnpm projects:add`)

Marketing prepares new projects in `Website/Projects to Add`. Each one is a folder with a Word
document and an `Images` folder:

```
Projects to Add/Bonhams (ready)/Bonhams.docx      name, Location, Project Completed, Area,
                                                  Architecture Company, Interior Design Company,
                                                  Owner, Photography, Press, Text
Projects to Add/Bonhams (ready)/Images/…jpg       the slideshow, in file-name order
Projects to Add/0 - Archive/Holt Renfrew (ready)/ photos for a project already on the site
```

```bash
pnpm projects:add "/Volumes/T7/Website"            # check: what would be created or added
pnpm projects:add "/Volumes/T7/Website" --write    # create drafts and upload photos
```

- **A folder with a Word document** becomes a new project, saved as a draft. Its fields and text
  are copied exactly as written. Firms are matched on their name and other names (aliases).
  A firm or photographer the site doesn't have yet is created as written and listed in
  review.csv. "(ready)" is not required, but a folder without it gets a review row.
- **A folder of folders** (`0 - Archive`) holds photos for projects already on the site. A
  project gets them only if it has no photos yet. Its documents are not read, because the site's
  text wins. Its photographer must already be set on the project.
- **Nothing is overwritten.** A project that already exists keeps its fields. A project that
  already has photos is skipped, so running the command again is safe.
- **Close names are held, not guessed.** If "FIT" looks like "Fashion Institute of Technology",
  the command stops on that folder and prints the option to rerun with:
  `--as "FIT (ready)=fashion-institute-of-technology"` (it is that project), or
  `--new "113 Spring (ready)"` (it really is a new one).
- **Left for marketing in review.csv:** categories (always: the document has none), press
  without a link, a web address with no title, "courtesy …" credits, and unknown labels.
- **A folder with photos and no Word document** (Cornell CIS Building) becomes a draft named
  after the folder, with its photos. Set its real name, facts, text and photographer before
  publishing.
- **A finished project that is already on the site** (270 Park): `--as "270 Park=270-park-ave"
  --update "270 Park"` reads its document into it. The status and year follow the document, the
  document's text replaces the site's (the old text stays under Versions), and other fields are
  filled only where the site has none. Add `--publish "270 Park"` to publish it in the same run.
  A new project is never published by the command, because it needs its categories first.
- **Not read:** PDFs, videos (add them under Videos), PSDs, and Timeline folders.

Photo descriptions start as "<Project>, photograph N", the same as the photo import. Write
better ones in the admin before publishing.

## 5. Publish what the imports saved (`pnpm media:publish`)

The imports save drafts, so nothing is public until it is published. Spot-check a few projects
in the admin, then publish the rest at once:

```bash
pnpm media:publish                              # list what would be published
pnpm media:publish --write --confirm-backup     # publish it
```

- Only projects that `media:import` or `projects:add` saved on this computer are published.
  They're kept in `scripts/media/cache/touched.json` as each one is saved. Other drafts in the
  admin are left alone.
- Each project's latest draft goes live exactly as the admin shows it.
- **Held:** a project without categories (typologies) or without a status. New projects from
  Projects to Add always need their categories chosen first. They stay on the list, so run the
  command again once they are ready.
