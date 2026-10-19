# Year of Light

The studio's year in review, in the spirit of Spotify Wrapped: one card per screen, read by
scrolling, at `/year-of-light/<year>` (`/year-of-light` opens the latest year). Each card has its
own downlight, a little cooler than the one before, from warm 2700 K on the first card to 6500 K
daylight on the last. The Timeline links each year that has one.

## What the page counts by itself

These come from **published** projects and their awards when the page is read, so they always
match the portfolio. Nobody types them, and a correction to a project (its year, status, location,
an award) shows on the story at once.

| Card | Counted from |
|---|---|
| Projects completed | Published projects with status Completed and that year |
| Where | The locations of those projects, as stored, each linking to its portfolio filter |
| Awards | Awards dated that year whose project is published, each linking to its project |
| Collaborators | The firm(s) on the most awarded projects of the year: architects and credited firms, never clients. Shown only when a firm is on two or more awarded projects; up to three tied firms are shown together |

A project still in draft, and its awards, are left out until it is published.

## What marketing adds (Admin → Year of Light)

1. **Create** a record and set the **Year**. One record per year.
2. Optional: an **Opening line** for the first card, a **Line on the “Where” card**, a
   **Thank-you line** for the last card.
3. **In the studio**: the studio's own numbers (e.g. `48` / `mock-ups built`). Only numbers
   someone has counted. With none, the card is skipped.
4. **Light of the year**: pick a published project. Its main photo is used unless you upload
   another, and the photo credit comes from the photo or the project. An optional quote, and who
   said it.
5. **Collaborators to feature**: leave empty for the automatic pick, or choose up to three firms.
   Who is named in public is a relationship decision; choose firms here if the automatic pick is
   not the one the studio wants to show.
6. **Leave out**: any card to skip this year. A card with nothing to show is skipped anyway.
7. Check the **Live preview** (drafts autosave), then **Publish**. Nothing is public until then.

## Notes

- Data problems show up here as they are: the page never renames or merges places or firms. If a
  location looks wrong (for example an event stored as a city), fix it under Locations.
- Developers: the cards are built in `src/lib/year-of-light.ts`, drawn by
  `src/components/YearOfLight.tsx`, styled in `src/app/(frontend)/year-of-light/year-of-light.css`.
  Tests: `tests/int/year-of-light.int.spec.ts`.
