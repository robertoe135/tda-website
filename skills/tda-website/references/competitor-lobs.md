# Competitor analysis: L'Observatoire International (lobsintl.com)

The site that prompted the redesign. Fetched October 2026. The goal is to take its information
model, not its visual design, and to avoid its mistakes.

## Stack

- Gatsby 5.14.1 (from the `generator` meta tag)
- Contentful headless CMS (all images served from `images.ctfassets.net`)
- Designed and built by the agency Pacific (footer credit)

Gatsby's development has largely stalled since its acquisition by Netlify. Do not treat the
framework as something to copy; the content model is what matters.

## Navigation

Projects, About, Team, News, Press, Clients, Contact, Search. The Projects link opens a default
filtered view (featured + completed) rather than everything. Footer lists four offices
(New York, Paris, Seoul, London), separate emails for general info, press and new business,
a newsletter signup, careers link and social profiles.

TDA equivalents to consider: Press and Awards (TDA has both, currently unstructured), Clients /
Collaborators (TDA's collaborator list is stronger than most), separate press and new-business
contacts, careers listed as real openings.

## Projects index

- Filters: status (Featured, Completed, In Progress), about 15 typologies (Artist
  Collaborations, Exterior + Landscapes, Hospitality, Maritime, Masterplans, Mixed Use, Museums +
  Cultural Institutions, Offices + Workplace, Performing Arts Centers, Residential, Retail +
  Galleries, Sport Facilities, Tower, Transportation, Universities + Libraries), region (Asia +
  Pacific, Europe, Middle East, North America, South America, Worldwide), and "Network"
  (collaborators)
- Three views: grid, list, map
- Filter state is in the URL (`/projects/?featured=true&status=Completed`)

## Team

- Team page leads with the founder (photo, bio, awards, "Learn More"), then members grouped by
  office, each linking to an individual page, then current job openings with apply links
- Individual page (`/team/<slug>/`): portrait, title, bio, then an automatically generated list
  of that person's projects, each with year, typology tags and location

Bio pattern worth copying (structure, not text): where they're from, education, prior
career, when they joined, notable projects and collaborators, then a sentence on how they
approach design. Short, specific, human.

## Projects

Each project carries year, one or more typologies, location and photographer credit
("Photo by ..."). Projects and people reference each other, so both sides stay in sync from one
record.

## Mistakes to avoid

1. **Dead-end tags.** On person pages, every typology and location tag links to the unfiltered
   `/projects/` page instead of a filtered view. The site looks clickable but isn't.
2. **Broken social previews.** The homepage and projects page publish `og:image` as
   "https:undefined", so links shared on LinkedIn or Slack show no image.
3. **Generic metadata.** Every page reuses the same meta description, even individual people.
4. **Agency fingerprints in metadata.** `twitter:creator` is the agency's handle, not the firm's.
5. **Meta keywords tag.** Ignored by search engines; noise.

All five are template-level bugs that only someone viewing the source would notice, which is
the point: metadata needs tests, not eyeballing.

## Sources

- https://lobsintl.com/
- https://lobsintl.com/projects/?featured=true&status=Completed
- https://lobsintl.com/team/
- https://lobsintl.com/team/jenny-ivansson/
