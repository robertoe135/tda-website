# Audit: current tillotsondesign.com (October 2026)

Method: one full fetch of the homepage plus search-engine-indexed copies of individual pages.
Direct crawling of inner pages was blocked (HTTP 429 rate limiting, and robots rules refusing the
automated fetcher), so CSS, mobile layout and analytics were not inspected. Re-verify anything
here against the live site before acting on it.

## Contents

1. Platform
2. Information architecture and URLs
3. How project information is stored
4. Page-by-page findings
5. Data quality issues found
6. Off-site presence
7. What must survive the migration

## 1. Platform

Almost certainly Squarespace. Evidence:

- Page titles follow Squarespace's "Page — Site Name" pattern ("Contact — Tillotson Design
  Associates", "Corporate — Tillotson Design Associates").
- Auto-generated, duplicated-page slugs and titles: About lives at `/about-5` (title "About-5"),
  the team page is titled "Team 1", the timeline at `/timeline` is titled "Gallery 1".
- Project galleries use Squarespace's stock lightbox ("View fullsize").
- Squarespace-style JSON-LD organization blocks (`legalName`, address, email, phone).

Check whether the site is on Squarespace 7.0 or 7.1. It affects how much can be exported and
how old some page structures are.

## 2. Information architecture and URLs

Known URL patterns (from the index; the full list should come from `/sitemap.xml`):

- `/` homepage: featured project list plus Suzan Tillotson quotes
- Typology index pages: `/performing-arts`, `/restaurants`, `/residential`, `/corporate`
  (others likely exist: museums, education, worship, retail, exterior)
- Project pages nested under one typology: `/corporate/one-vanderbilt`
- `/team`, `/about-5`, `/timeline`, `/contact`
- Legacy standalone project pages still indexed over http:
  `/nyu-steinhardt`, `/upper-east-side-townhouse/`, `/performing-arts` (older template)

Structural consequences:

- **One project, one category.** Projects live under a single typology path, so a project that
  is both a restaurant and a public venue must pick one. The restaurants index includes Barclays
  Center and the Knickerbocker Hotel, which suggests typologies are already being stretched.
- **Hand-maintained copies of the same facts.** The homepage list, each typology index, and the
  timeline each repeat project names separately. They have already drifted apart (see section 5).
- **Old pages were never retired.** Pre-redesign pages remain indexed alongside current ones.

## 3. How project information is stored

Every project's metadata is one pipe-delimited string:

    One Vanderbilt | New York, NY | Kohn Pedersen Fox
    The Shed | New York, NY | Diller Scofidio + Renfro | Rockwell Group
    Seattle Central Library | Seattle, WA | Rem Koolhaas | OMA - Office for Metropolitan Architecture | LMN Architects

Segment 1 is the project, segment 2 the location, and the rest are collaborating firms, but
nothing marks which firm did what (architect of record, design architect, interior designer,
landscape, exhibit designer). Firms are not linkable, so TDA's strongest marketing asset, its
list of collaborators (DS+R, OMA, Foster + Partners, KPF, SANAA, Herzog & de Meuron, SHoP,
Snøhetta, Gensler and more), is invisible as a navigable dimension.

Missing everywhere as structured data: completion year (only on the separate timeline page),
status, client, team members, photographer credit, awards, press.

## 4. Page-by-page findings

**Homepage.** Long list of projects with pipe-string labels, plus two Suzan Tillotson quotes:
one about good lighting being intentional and purposeful rather than more fixtures or more
brightness, one about light informing every aspect of architecture. Keep the quotes; they are
brand voice.

**Project page (One Vanderbilt, `/corporate/one-vanderbilt`).** Title, label string, a solid
technical description (dynamic crown lighting, linear grazers and narrow-beam strips on the
spire, terracotta soffit wash at the podium referencing Grand Central, one-foot independently
controlled segments, show programs from a "flame" to July 4th "fireworks"), and a captioned
gallery (crown in blue, crown in white, podium facade, lobby, elevators, terrace, skyline). This
is the quality bar for descriptions: specific, technical, design-intent driven.

**Typology pages.** Image grids with project names only.

**Team (`/team`, titled "Team 1").** Names and titles only, no photos, bios or links.
Leadership: Suzan Tillotson (President and Founder), Megan Trimarchi (Principal),
Scott Baillie-Hinojosa (Principal). Design team: 3 Associate Principals, 2 Senior Associates,
7 Senior Designers, 7 Designers (one doubling as Marketing Coordinator). Administration:
Business Manager, Director of Marketing, Director of Finance. Snapshot only; the people
collection becomes the source of truth.

**About (`/about-5`).** WBE-certified, women-owned; philosophy (research-driven, light that
evokes emotion, sustainability, light pollution, quality of life); background (founded 2004 after
Ms. Tillotson completed the Seattle Central Library lighting with OMA). Hardcodes "staff of
twenty-three" and "over 100 years" of principal experience, which go stale silently.

**Timeline (`/timeline`, titled "Gallery 1").** Projects by year, e.g. 2024: Longwood Gardens
West Conservatory, Oxman Studio; 2023: Perelman Performing Arts Center, NYPL Stephen A.
Schwarzman Building; 2021: One Vanderbilt. This is the only place years exist; it should become
a generated view of `projects.year`.

**Contact.** 40 Worth Street, Suite 703, New York, NY 10013; 212-675-7760; one info@ address
for both general and press inquiries; careers via a submission form.

## 5. Data quality issues found

Write all of these to the migration review file. Do not auto-correct.

| Where | As written | Likely intended / issue |
|---|---|---|
| Homepage | Four Season Restaurant | Four Seasons Restaurant (spelled correctly elsewhere) |
| Homepage | MoMa Public Spaces | MoMA |
| Homepage | Nicollett Mall | Nicollet Mall |
| Homepage | Comcast Innovation & Technology Center | Other pages: "Comcast Innovation and Technology Tower" |
| Homepage | Gateway Arch Museum | Other pages: "Gateway Arch Museum and Visitor's Center" |
| Labels | "OMA-Office for Metropolitan Architecture" and "OMA - Office for Metropolitan Architecture" | One firm, two spellings |
| Labels | "Rem Koolhaas" listed as a firm beside OMA | Person vs firm; decide how to credit |
| Labels | "Kazuyo Sejima + Ryue Nishizawa - SANAA" | Canonical firm name for SANAA |
| Legacy townhouse page | captions "Loeb Front Door 3.06.jpg" etc. | Raw filenames as captions; also names a private client |
| Legacy townhouse page | "Kugler Tillotson Associatess" | Typo; predecessor-firm credit |
| Residential index | "Upper East Side Residence" and "Upper Eastside Townhouse" | Possibly two projects, possibly a duplicate; confirm |
| Restaurants index | Barclays Center, Knickerbocker Hotel | Need multiple typologies |

The legacy townhouse captions expose a client surname on a residential project. Treat that as a
confidentiality issue: do not migrate filenames as captions.

## 6. Off-site presence

- **ArchDaily** lists 34 TDA projects on an unclaimed professional profile.
- **Archinect** firm profile is unclaimed and says principals bring "over 80 years" of
  expertise, while the TDA About page says over 100.
- **Directories disagree on the address**: some list Suite 703, at least one lead-generation
  directory still lists Suite 1680 at 40 Worth Street. Inconsistent name/address/phone data
  hurts local search. Fix the canonical version on the new site (JSON-LD) and update profiles.
- **Manufacturer case studies** (Signify / Color Kinetics, i2Systems, Specialty Lighting) credit
  TDA on One Vanderbilt. These are good inbound links; keep the URLs they point to alive.
- **Awards**: 2016 IALD Radiance Award (the program's top honor) for Lincoln Square Synagogue.
  Not attached to the project in any structured way on the current site.

## 7. What must survive the migration

- Every project, including legacy and predecessor-firm work, as a draft for review
- All project descriptions and captions (captions cleaned)
- Suzan's quotes, philosophy and background text
- Every indexed URL, redirected with a 301
- Contact details, careers path, WBE certification
- Original-resolution photography from TDA's file server, with photographer credits

## Sources

- https://tillotsondesign.com/ (homepage, fetched)
- https://www.tillotsondesign.com/corporate/one-vanderbilt
- https://www.tillotsondesign.com/team
- https://www.tillotsondesign.com/about-5
- https://www.tillotsondesign.com/timeline
- https://www.tillotsondesign.com/contact
- https://www.tillotsondesign.com/restaurants
- https://www.tillotsondesign.com/residential
- https://www.tillotsondesign.com/corporate
- http://www.tillotsondesign.com/performing-arts
- http://www.tillotsondesign.com/upper-east-side-townhouse/
- http://www.tillotsondesign.com/nyu-steinhardt
- https://www.archdaily.com/professional/tillotson-design-associates
- https://www.archinect.com/firms/cover/106450/tillotson-design-associates
- https://cisleads.com/company/details/25425
- https://www.architectmagazine.com/technology/lighting/33rd-annual-iald-international-lighting-design-awards-recognizes-17-projects_o/
- https://www.signify.com/en-us/blog/archive/showcase/architectural-lighting-at-one-vanderbilt-avenue
