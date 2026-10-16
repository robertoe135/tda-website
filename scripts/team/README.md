# TDA team credits import

Marketing fills in a spreadsheet of who worked on which project; this script puts it into the
admin as drafts. Start from `template.csv` (open it in Excel or Google Sheets, save as CSV).

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
pnpm team:import team.csv                                  # check only, writes nothing
pnpm team:import team.csv --write                          # save drafts
pnpm team:import team.csv --write --create-people          # also add people not yet in the admin
```

Against the production database, take a backup in Neon first and add `--confirm-backup`.

Later, the same CSV can come from a manual, one-way export of the internal TDA app's project
roles. This script never connects to that app.
