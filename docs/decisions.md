# Decisions

## 001: Platform for the new tillotsondesign.com

Status: proposed (needs sign-off from leadership and marketing)

### Goal

Keep all existing content and branding, and add structured project metadata, project team
credits, bios for every designer, and cross-linking throughout (project ↔ person ↔ collaborator
↔ typology ↔ location). Mobile is required. Non-developers must be able to maintain it.
JavaScript/TypeScript preferred.

### Options considered

**Stay on Squarespace (rebuild in place).**
Projects become a blog-style collection; typologies become categories; architects, team members,
locations and years become tags with a strict prefix convention (`arch: …`, `team: …`). Tag
URLs give filtered lists, and each bio page uses a Summary Block filtered by that person's tag.
- For: editors already know it; zero hosting or maintenance; no developer dependency.
- Against: Summary Blocks show at most 30 items, so principals' project lists truncate; tags are
  free strings, so a typo silently creates a new "architect"; no labeled fields (year, architect
  render as tags or typed text); one native filter at a time; no map; combined filters require
  third-party plugins and code injection, which recreates the fragility we wanted to avoid.
- Verdict: viable if the 30-item cap, missing map and tag discipline are acceptable. Test it by
  rebuilding 10 projects and 5 people in a duplicate site before ruling it out.

**Webflow.**
Real CMS collections with multi-reference fields; designer-friendly; hosted.
- For: relational content without running infrastructure; marketing can own it.
- Against: not JavaScript; platform lock-in; plan limits on CMS items and references.
- Verdict: the best choice if nobody at TDA can own code long-term.

**Next.js + Sanity.**
- For: excellent editing UI, hosted content, strong relational references.
- Against: content is not self-hosted; usage-based pricing beyond free tier.
- Verdict: good alternative if running a database is unwanted.

**Gatsby + Contentful (what L'Observatoire uses).**
- Against: Gatsby is largely stagnant; Contentful is expensive at this scale.
- Verdict: rejected.

**Next.js + Payload CMS 3 (chosen, pending sign-off).**
- For: TypeScript end to end inside one Next.js app; open source and self-hostable; relationship
  and join fields model the cross-linking directly; drafts, versions, live preview and roles
  for editors; the team already works in Next.js.
- Against: someone at TDA must own deployment, upgrades and backups; Payload was acquired by
  Figma in 2026 and Payload Cloud paused new signups, so hosting is on us.
- Mitigations: TDA-owned repo, managed hosting, runbook, a second person who can deploy, and a
  portable content model.

## Open questions for TDA

1. Who owns the site after launch (content) and who owns the code and hosting (operations)?
2. Who is credited on project pages: principals, everyone who worked on it, former staff?
3. Will every current designer provide an approved bio and headshot? Who writes the template?
4. Final typology list.
5. Which projects are confidential (client hidden, city-level location only)?
6. Do photography licenses cover web use at larger sizes and social sharing?
7. Do TDA's brand typefaces have web licenses? Where are the brand files?
8. Where is the domain registered and who controls DNS? What email records exist?
9. Which external profiles (ArchDaily, Archinect, directories) should be claimed and corrected,
   and which address is canonical (Suite 703)?
10. Launch scope: is the map view, news, press archive or careers listing required on day one?
11. Should AI assistants and search crawlers be allowed to index the site?
