import type { Metadata } from 'next'
import Link from 'next/link'
import { permanentRedirect } from 'next/navigation'

import {
  canonicalFirmFilters,
  FILTER_KEYS,
  type Filters,
  getPublishedProjects,
  getTypologies,
  matches,
  parseFilters,
  REGION_OPTIONS,
  setHref,
  STATUS_OPTIONS,
  toggleHref,
} from '@/lib/projects'
import { type CategoryLink, CategoryNav } from '@/components/CategoryNav'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export const metadata: Metadata = {
  title: 'Portfolio — Tillotson Design Associates',
  description: 'Lighting design projects by Tillotson Design Associates.',
  alternates: { canonical: '/projects' },
}

/**
 * The portfolio: TDA's grid of projects (as on the old category pages). Categories are one line
 * of links in the old portfolio menu's order, so each has its own address; Location and
 * Architect are two small menus; filters reached from project pages show as removable chips.
 */
export default async function ProjectsPage({ searchParams }: Props) {
  const filters = parseFilters(await searchParams)
  // A firm filter using another name of a firm goes to the main firm's address.
  const canonical = await canonicalFirmFilters(filters)
  if (canonical) permanentRedirect(canonical)
  const [projects, typologies] = await Promise.all([getPublishedProjects(), getTypologies()])
  const shown = projects.filter((p) => matches(p, filters))

  // Only offer options that have at least one published project.
  const usedTypologies = new Set(projects.flatMap((p) => p.typologies.map((t) => t.slug)))
  // Each menu offers only what gives results with the other filters (no dead ends), plus
  // anything already chosen.
  const without = (key: keyof Filters) => projects.filter((p) => matches(p, { ...filters, [key]: [] }))
  const usedRegions = new Set([...without('region').map((p) => p.location?.worldRegion).filter(Boolean), ...filters.region])
  const usedStatuses = new Set(projects.flatMap((p) => [p.status, p.featured ? 'featured' : undefined]))
  const allArchitects = new Map(projects.flatMap((p) => p.architects).map((a) => [a.slug, a]))
  const architects = [
    ...new Map(without('architect').flatMap((p) => p.architects).map((a) => [a.slug, a])).values(),
    ...filters.architect.map((slug) => allArchitects.get(slug)).filter((a) => a !== undefined),
  ]
    .filter((a, i, list) => list.findIndex((b) => b.slug === a.slug) === i)
    .sort((a, b) => a.name.localeCompare(b.name))

  const active = Object.entries(filters).flatMap(([key, values]) =>
    values.map((value) => ({ key: key as keyof Filters, value })),
  )
  const labelFor = (key: keyof Filters, value: string) =>
    STATUS_OPTIONS.find((o) => key === 'status' && o.value === value)?.label ??
    REGION_OPTIONS.find((o) => key === 'region' && o.value === value)?.label ??
    typologies.find((t) => key === 'typology' && t.slug === value)?.name ??
    architects.find((a) => key === 'architect' && a.slug === value)?.name ??
    projects.find((p) => key === 'location' && p.location?.slug === value)?.location?.displayName ??
    value.replace(/-/g, ' ')

  // The category line: All, each category in the old menu's order, then On the Boards.
  const noCategory = filters.typology.length === 0 && filters.status.length === 0
  const categories: CategoryLink[] = [
    { label: 'All', href: setHref(filters, { typology: [], status: [] }), current: noCategory },
    ...typologies
      .filter((t) => t.slug && usedTypologies.has(t.slug))
      .map((t) => ({
        label: t.name,
        href: setHref(filters, { typology: [t.slug!], status: [] }),
        current: filters.typology.includes(t.slug!) && filters.status.length === 0,
      })),
    ...(usedStatuses.has('in-progress')
      ? [
          {
            label: 'On the Boards',
            href: setHref(filters, { typology: [], status: ['in-progress'] }),
            current: filters.status.length === 1 && filters.status[0] === 'in-progress' && !filters.typology.length,
          },
        ]
      : []),
  ]
  // Chips for what the line doesn't show: places, architects, and filters reached from project pages.
  const chips = active.filter(({ key }) => key !== 'typology' && !(key === 'status' && filters.status.join() === 'in-progress'))

  return (
    <div className="portfolio">
      <h1 className="page-title">Portfolio</h1>

      <div className="portfolio-filters">
        <CategoryNav items={categories} />
        <div className="filter-menus">
          <FilterMenu label="Location" filters={filters} name="region">
            {REGION_OPTIONS.filter((o) => usedRegions.has(o.value)).map((o) => (
              <Checkbox key={o.value} name="region" value={o.value} label={o.label} filters={filters} />
            ))}
          </FilterMenu>
          <FilterMenu label="Architect" filters={filters} name="architect" scroll>
            {architects.map((a) => (
              <Checkbox key={a.slug} name="architect" value={a.slug ?? ''} label={a.name} filters={filters} />
            ))}
          </FilterMenu>
        </div>
      </div>

      {chips.length > 0 && (
        <p className="active-filters">
          {chips.map(({ key, value }) => (
            <Link key={`${key}:${value}`} href={toggleHref(filters, key, value)} className="chip" aria-label={`Remove filter ${labelFor(key, value)}`}>
              {labelFor(key, value)} <span aria-hidden="true">×</span>
            </Link>
          ))}
          <Link href={setHref(filters, Object.fromEntries(chips.map(({ key }) => [key, []])))} className="chip-clear">
            Clear
          </Link>
        </p>
      )}

      {shown.length === 0 ? (
        <p className="empty">
          No projects match. <Link href="/projects">See all projects</Link>.
        </p>
      ) : (
        <ul className="portfolio-grid">
          {shown.map((p) => (
            <li key={p.id} className="portfolio-item">
              <Link href={`/projects/${p.slug}`}>
                <div className="portfolio-image">
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image.src} alt="" loading="lazy" />
                  )}
                </div>
                <h3 className="portfolio-title">{p.name}</h3>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * A small menu of checkboxes (Location, Architect). It works without JavaScript: Apply sends
 * the form, which keeps every other filter as hidden fields.
 */
function FilterMenu({
  label,
  name,
  filters,
  scroll,
  children,
}: {
  label: string
  name: keyof Filters
  filters: Filters
  scroll?: boolean
  children: React.ReactNode
}) {
  const chosen = filters[name].length
  return (
    <details className="filter-menu">
      <summary>
        {label}
        {chosen > 0 && <span className="filter-count"> ({chosen})</span>}
      </summary>
      <form action="/projects" method="get" className="filter-panel" aria-label={`Filter by ${label.toLowerCase()}`}>
        <fieldset>
          <legend className="visually-hidden">{label}</legend>
          <div className={scroll ? 'filters-scroll' : undefined}>{children}</div>
        </fieldset>
        {FILTER_KEYS.filter((k) => k !== name).flatMap((k) =>
          filters[k].map((v) => <input key={`${k}:${v}`} type="hidden" name={k} value={v} />),
        )}
        <div className="filters-actions">
          <button type="submit">Apply</button>
          {chosen > 0 && <Link href={setHref(filters, { [name]: [] })}>Clear</Link>}
        </div>
      </form>
    </details>
  )
}

function Checkbox({
  name,
  value,
  label,
  filters,
}: {
  name: keyof Filters
  value: string
  label: string
  filters: Filters
}) {
  const id = `${name}-${value}`
  return (
    <div className="checkbox">
      <input type="checkbox" id={id} name={name} value={value} defaultChecked={filters[name].includes(value)} />
      <label htmlFor={id}>{label}</label>
    </div>
  )
}
