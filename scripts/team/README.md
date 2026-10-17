# TDA team credits import

Marketing fills in a spreadsheet of who worked on which project; this script puts it into the
admin as drafts.

## The worksheet

```
pnpm team:worksheet
```

Writes `scripts/team/out/team-worksheet.csv`: every project on the site (live ones first, A to
Z), each with a row for Principal in Charge, Project Manager and two Designers, its address,
name and year already filled in. Projects that already have a team show it. Also writes
`team-names.csv`, everyone in the admin with their title: copy names from it, so spellings match.

Open the worksheet in Excel or Google Sheets and type names in the `person` column. Add rows for
more designers; leave rows you don't need empty, since they're skipped. A project left entirely
blank keeps the team it has. Save it as CSV. The `website name`, `year` and `live` columns are
there to read and aren't imported.

Run `pnpm migrate:people --write --publish` first, so everyone on the old team page has "Show on
site" on. Otherwise the import stops on each of them.

`template.csv` is the same format, empty, for a one-off list.

| Column | What goes in it |
| --- | --- |
| `project` | The project's address on the new site (`/projects/brown-university-creative-arts-center`), its slug, or its old Squarespace address. |
| `person` | The name exactly as it should appear on the site. |
| `role` | `Principal in Charge`, `Project Manager` or `Designer` (`PIC` and `PM` also work). |
| `former staff` | `yes` if they no longer work at TDA. Leave empty for current staff. |
| `note` | Anything for whoever reviews the file. Not imported. |

One row per person per role. A project with two designers has two designer rows.

## What happens

- For each project in the file, its TDA team becomes exactly those rows. Projects not in the
  file keep their team.
- Projects are saved as **drafts**. The live site changes only when someone publishes them.
- Current staff link to their team page. Former staff are named without a link.
- Someone with "Show on site" off in the admin stops the import. Turn it on only with their OK.
- A name close to an existing person's (a likely typo) stops the import. Nothing guesses
  which spelling is right.
- If any row has a problem, nothing is written and every problem is listed with its line.

## Running it

```
pnpm team:import scripts/team/out/team-worksheet.csv       # check only, writes nothing
pnpm team:import team.csv --write                          # save drafts
pnpm team:import team.csv --write --create-people          # also add people not yet in the admin
```

Against the production database, take a backup in Neon first and add `--confirm-backup`.

Later, the same CSV can come from a manual, one-way export of the internal TDA app's project
roles. This script never connects to that app.

## Original headshots (`pnpm team:headshots`)

The old site's headshots are small web copies. To replace them with the original photographs:

```bash
pnpm team:headshots "/Users/you/Desktop/Team photos"                         # list the matches
pnpm team:headshots "/Users/you/Desktop/Team photos" --write --publish --confirm-backup
```

- Looks through the folder and its subfolders for JPEG, PNG, TIFF or WebP photos. HEIC, PSD and
  RAW files are counted and skipped: export JPEGs.
- A photo belongs to a person when its file name, or a folder it sits in, holds their first name
  and surname, in either order and any spelling of accents: `Jane Smith.jpg`, `Smith_Jane.jpg`,
  `Jane Smith/IMG_0042.jpg`. Either part of a double surname is enough.
- A first name or initials work too (`TDA_Shan0157-C.jpg`, `ST 1 V2 No BG.png`, `SBH.png`), but
  only when no one else has them; those rows say "first name: check" or "initials: check".
  Labels such as No BG, FS, LS, Temporary, copy, DSC and numbers are ignored.
- Nicknames and shared first names (Gaby, Jen, two Marias) are left for you. Open
  `scripts/team/out/headshots.csv`, type the file name in the `file` column of each person, save
  it, and run with `--map`: the list decides, even when the current photo is as large. A file
  listed for two people, a name not in the admin or a file not in the folder is reported and
  skipped. The list is never overwritten; the check goes to `headshots-checked.csv`.

  ```bash
  pnpm team:headshots "<folder>" --map scripts/team/out/headshots.csv
  pnpm team:headshots "<folder>" --map scripts/team/out/headshots.csv --write --publish --confirm-backup
  ```
- Several photos for one person: the largest is used. A person whose current headshot is as
  large keeps it, so running it twice changes nothing.
- Photos are scaled to 3000 px and stripped of camera data before upload. The old headshot
  stays in Images. Without `--publish` the new photo is saved as a draft.
- Every match, and every photo that matched no one, is in `scripts/team/out/headshots.csv`.
