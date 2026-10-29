# Projects sent from the TDA app

The internal TDA app's **Marketing** tab has a **Send to website** button. It sends what the
project team filled in to the website as a **draft**. Nothing appears on the public site until
someone opens the draft here, checks it and publishes it.

## What arrives

Only these, and nothing else the app holds:

| On the website | From the app |
| --- | --- |
| Name | Marketing's public name, or the project title |
| TDA project number | Project Info. This is how the website finds the project again. |
| Year | The year of the construction completion date |
| Area | Size (SF) |
| Location | Project location, matched to a place under Locations |
| Architects | The design architect, or the architect of record when there is no design architect |
| Credits | Architect of record (when there is also a design architect), landscape architect, electrical engineer |
| Client | The owner, matched to a record under Clients |
| Summary | Short project summary (300 characters at most) |
| Write-up | TDA scope of work, lighting design goals and sustainability work, as paragraphs |
| TDA team | Principal in Charge, Project Manager and designers from the Marketing tab |

Client contact details, confidentiality notes, the photographer contact, construction cost,
fees and internal notes stay in the app. When the app has confidentiality notes, the reply
says so, so someone reads them before publishing.

## What it does

- **New project** (no project here with that TDA project number): a draft is created with
  status **In progress** and **Confidential** ticked, so it stays off the site and hides the
  client until you change them.
- **Project already here**: only fields that are still empty are filled in. Anything already
  written on the website is kept, and the reply lists what was kept. To replace a field with
  the app's version, clear it here and send again.
- **Names are matched to records that already exist.** Firms (by name or other name), people,
  places, clients and credit roles:
  - **Matched**: the same name, ignoring capitals, accents and punctuation. Used.
  - **Suggested: check**: no exact match, so the one closest name here was used (a typo or a
    small spelling difference, such as "Kohn Pedersen Fox Associates PC" for "Kohn Pedersen Fox
    Associates"). A short name for a long one ("KPF") is too different to be suggested: add it
    as an other name of the firm once and it matches from then on. Nothing is renamed. Check
    each one before publishing and fix the field if it is wrong.
  - **Not found**: nothing close. Left empty. Add the record under Firms, People, Locations,
    Clients or Credit roles, then send again or pick it in the field.
  A person with **Show on site** off is left out until they agree to be listed.
- **The From the TDA app tab** on the project shows what was last sent, every name with how it
  was matched, and the notes above. It is staff-only and never on the public site.
- **Two projects with the same name** (two "Private Residence"s) get different web addresses:
  the second gets `-2` at the end, and the reply says so.

The app shows a preview first (what would be created, filled, kept and not found) and only saves
when someone presses **Send as draft**.

## Setting it up

1. Make a long random string (`openssl rand -hex 32`).
2. In Vercel, set it as `APP_SYNC_TOKEN` (Production) and redeploy.
3. In the app's Convex environment, set the same string as `WEBSITE_SYNC_TOKEN`, and
   `WEBSITE_SYNC_URL` to the website's address (e.g. `https://tillotsondesign.com`).

Without `APP_SYNC_TOKEN` the website refuses every request. To stop sending, delete it.
