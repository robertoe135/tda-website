import { filterHref, type ProjectCard } from './projects'

export type RelatedProject = { project: ProjectCard; reason: { label: string; href: string } }

/** A repeatable shuffle: the same seed always gives the same order. */
function shuffled<T>(list: T[], seed: number): T[] {
  let s = seed || 1
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Projects to show at the bottom of a project page: taken in turn from the same architect, the
 * same category (typology) and the same completion year, so the set mixes all three. Each
 * group is shuffled with the project's id as the seed: every project gets its own mix, and a
 * page shows the same set each time it is built, so caching and search engines see one page.
 * Projects with photographs come first. Each pick carries why it was picked, as a link to the
 * matching filtered view (or that year on the Timeline).
 */
export function relatedProjects(
  project: ProjectCard,
  all: ProjectCard[],
  count = 4,
): RelatedProject[] {
  const others = all.filter((p) => p.id !== project.id)
  const withPhotosFirst = (list: ProjectCard[], salt: number) => {
    const order = shuffled(list, project.id * 31 + salt)
    return [...order.filter((p) => p.image), ...order.filter((p) => !p.image)]
  }

  const groups: { pick: (p: ProjectCard) => RelatedProject['reason'] | undefined }[] = [
    {
      pick: (p) => {
        const a = project.architects.find(
          (x) => x.slug && p.architects.some((y) => y.slug === x.slug),
        )
        return a ? { label: a.name, href: filterHref('architect', a.slug!) } : undefined
      },
    },
    {
      pick: (p) => {
        const t = project.typologies.find((x) => p.typologies.some((y) => y.slug === x.slug))
        return t?.slug ? { label: t.name, href: filterHref('typology', t.slug) } : undefined
      },
    },
    {
      pick: (p) =>
        project.year && p.year === project.year && p.status !== 'in-progress'
          ? { label: String(project.year), href: `/timeline#year-${project.year}` }
          : undefined,
    },
  ]
  const queues = groups.map((g, i) =>
    withPhotosFirst(others, i + 1).flatMap((p) => {
      const reason = g.pick(p)
      return reason ? [{ project: p, reason }] : []
    }),
  )

  const chosen: RelatedProject[] = []
  const taken = new Set<number>()
  // Start the rotation at a different group per project, so the first tile varies too.
  for (
    let g = project.id % groups.length;
    chosen.length < count && queues.some((q) => q.length);
    g = (g + 1) % groups.length
  ) {
    const queue = queues[g]
    while (queue.length && taken.has(queue[0].project.id)) queue.shift()
    const next = queue.shift()
    if (next) {
      chosen.push(next)
      taken.add(next.project.id)
    }
  }
  return chosen
}

/** The "Other projects" block: projects by the same architect, else in the same category. */
export type OtherProjects = {
  by: 'architect' | 'typology' | 'year'
  /** The architect, category or year, linking to its filtered portfolio (a year: the Timeline). */
  name: string
  href: string
  /** How many projects that filtered view lists, this one included. */
  total: number
  projects: ProjectCard[]
}

/**
 * Projects for the bottom of a project page: by the first listed architect who has others, else
 * in the first category that has others, else completed in the same year. Newest first (the
 * order `all` arrives in), with photographs before projects without. Undefined when none of the
 * three has another project.
 */
export function otherProjects(
  project: ProjectCard,
  all: ProjectCard[],
  count = 2,
): OtherProjects | undefined {
  const others = all.filter((p) => p.id !== project.id)
  const pick = (list: ProjectCard[]) =>
    [...list.filter((p) => p.image), ...list.filter((p) => !p.image)].slice(0, count)
  for (const a of project.architects) {
    if (!a.slug) continue
    const list = others.filter((p) => p.architects.some((x) => x.slug === a.slug))
    if (list.length)
      return {
        by: 'architect',
        name: a.name,
        href: filterHref('architect', a.slug),
        total: list.length + 1,
        projects: pick(list),
      }
  }
  for (const t of project.typologies) {
    if (!t.slug) continue
    const list = others.filter((p) => p.typologies.some((x) => x.slug === t.slug))
    if (list.length)
      return {
        by: 'typology',
        name: t.name,
        href: filterHref('typology', t.slug),
        total: list.length + 1,
        projects: pick(list),
      }
  }
  if (project.year) {
    const list = others.filter((p) => p.year === project.year && p.status === 'completed')
    if (list.length)
      return {
        by: 'year',
        name: String(project.year),
        href: `/timeline#year-${project.year}`,
        total: list.length + (project.status === 'completed' ? 1 : 0),
        projects: pick(list),
      }
  }
  return undefined
}
