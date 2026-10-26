import type { Metadata } from 'next'
import Link from 'next/link'
import { permanentRedirect } from 'next/navigation'

import {
  canonicalFirmFilters,
  FILTER_KEYS,
  filterHref,
  type Filters,
  getPublishedProjects,
  getTypologies,
  matches,
  onTimeline,
  type ProjectCard,
  parseFilters,
  PROJECT_STATUS,
  REGION_OPTIONS,
  setHref,
  STATUS_OPTIONS,
  toggleHref,
} from '@/lib/projects'
import { type CategoryLink, CategoryNav } from '@/components/CategoryNav'
import { ProjectMap } from '@/components/ProjectMap'
import { mapData } from '@/lib/map'

type View = 'grid' | 'list' | 'map'

/** A portfolio address in the given view. */
const withView = (href: string, view: View) => `${href}${href.includes('?') ? '&' : '?'}view=${view}`

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export const metadata: Metadata = {
  title: 'Portfolio — Tillotson Design Associates',
  description: 'Lighting design projects by Tillotson Design Associates.',
  alternates: { canonical: '/projects' },
}

/**
 * The portfolio, three ways: a grid of photographs (as on the old category pages), a list of
 * every project as text, and a map. Projects with no photos yet, announced work in progress
 * above all, are in the list and on the map, not in the grid. Categories are one line of links
 * in the old portfolio menu's order, so each has its own address; Location, Status and Architect
 * are small menus; filters reached from project pages show as removable chips.
 *
 * Without a chosen view, the list shows when the grid would have nothing to show (no photos in
 * the results) or when only work in progress is asked for; otherwise the grid. A view picked
 * from the switch is kept while filtering.
 */
export default async function ProjectsPage({ searchParams }: Props) {
  const params = await searchParams
  const filters = parseFilters(params)
  // A firm filter using another name of a firm goes to the main firm's address.
  const canonical = await canonicalFirmFilters(filters)
  if (canonical) permanentRedirect(canonical)
  const [projects, typologies] = await Promise.all([getPublishedProjects(), getTypologies()])
  const shown = projects.filter((p) => matches(p, filters))

  // The grid is photographs: projects without any are in the list (and on the map).
  const withPhotos = shown.filter((p) => p.image)
  const withoutPhotos = shown.length - withPhotos.length

  // Grid, list or map. The map is offered once any location has coordinates (set in the admin).
  const hasMap = mapData(projects).cities.length > 0
  const chosen: View | undefined =
    params.view === 'grid' || params.view === 'list' ? params.view : hasMap && params.view === 'map' ? 'map' : undefined
  const onlyInProgress = filters.status.length === 1 && filters.status[0] === 'in-progress'
  const view: View = chosen ?? (onlyInProgress || withPhotos.length === 0 ? 'list' : 'grid')
  // Links keep a view the visitor chose; otherwise each page picks its own as above.
  const v = (href: string) => (chosen ? withView(href, chosen) : href)
  const gridHref = setHref(filters, {})
  const views: { view: View; label: string }[] = [
    { view: 'grid', label: 'Grid' },
    { view: 'list', label: 'List' },
    ...(hasMap ? [{ view: 'map' as const, label: 'Map' }] : []),
  ]
  // Only offer options that have at least one published project.
  const usedTypologies = new Set(projects.flatMap((p) => p.typologies.map((t) => t.slug)))
  // Each menu offers only what gives results with the other filters (no dead ends), plus
  // anything already chosen.
  const without = (key: keyof Filters) =>
    projects.filter((p) => matches(p, { ...filters, [key]: [] }))
  const usedRegions = new Set([
    ...without('region')
      .map((p) => p.location?.worldRegion)
      .filter(Boolean),
    ...filters.region,
  ])
  // The Status menu: each project status that gives results with the other filters, plus any
  // already chosen.
  const menuStatuses = new Set<string>([
    ...without('status').flatMap((p) => (p.status ? [p.status] : [])),
    ...filters.status,
  ])
  const allArchitects = new Map(projects.flatMap((p) => p.architects).map((a) => [a.slug, a]))
  const architects = [
    ...new Map(
      without('architect')
        .flatMap((p) => p.architects)
        .map((a) => [a.slug, a]),
    ).values(),
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
    (key === 'photographer'
      ? projects.flatMap((p) => p.photographers).find((ph) => ph.slug === value)?.name.replace(/^/, 'Photos by ')
      : undefined) ??
    value.replace(/-/g, ' ')

  // The category line: All, then each category in the old menu's order. Status is a menu.
  const categories: CategoryLink[] = [
    { label: 'All', href: v(setHref(filters, { typology: [] })), current: filters.typology.length === 0 },
    ...typologies
      .filter((t) => t.slug && usedTypologies.has(t.slug))
      .map((t) => ({
        label: t.name,
        href: v(setHref(filters, { typology: [t.slug!] })),
        current: filters.typology.includes(t.slug!),
      })),
  ]
  // Chips for what the line doesn't show: places, statuses, architects, and filters reached from project pages.
  const chips = active.filter(({ key }) => key !== 'typology')

  return (
    <div className="portfolio">
      <h1 className="visually-hidden">Portfolio</h1>

      <div className="portfolio-filters">
        <CategoryNav items={categories} />
        <div className="filter-menus">
          <nav aria-label="View" className="segmented view-switch">
            {views.map((o) => (
              <Link key={o.view} href={withView(gridHref, o.view)} aria-current={view === o.view ? 'page' : undefined}>
                {o.label}
              </Link>
            ))}
          </nav>
          <FilterMenu label="Location" filters={filters} name="region" view={chosen}>
            {REGION_OPTIONS.filter((o) => usedRegions.has(o.value)).map((o) => (
              <Checkbox
                key={o.value}
                name="region"
                value={o.value}
                label={o.label}
                filters={filters}
              />
            ))}
          </FilterMenu>
          <FilterMenu label="Status" filters={filters} name="status" view={chosen}>
            {Object.entries(PROJECT_STATUS)
              .filter(([value]) => menuStatuses.has(value))
              .map(([value, label]) => (
                <Checkbox key={value} name="status" value={value} label={label} filters={filters} />
              ))}
          </FilterMenu>
          <FilterMenu label="Architect" filters={filters} name="architect" view={chosen} scroll>
            {architects.map((a) => (
              <Checkbox
                key={a.slug}
                name="architect"
                value={a.slug ?? ''}
                label={a.name}
                filters={filters}
              />
            ))}
          </FilterMenu>
        </div>
      </div>

      {chips.length > 0 && (
        <p className="active-filters">
          {chips.map(({ key, value }) => (
            <Link
              key={`${key}:${value}`}
              href={v(toggleHref(filters, key, value))}
              className="chip"
              aria-label={`Remove filter ${labelFor(key, value)}`}
            >
              {labelFor(key, value)} <span aria-hidden="true">×</span>
            </Link>
          ))}
          <Link
            href={v(setHref(filters, Object.fromEntries(chips.map(({ key }) => [key, []]))))}
            className="chip-clear"
          >
            Clear
          </Link>
        </p>
      )}

      {shown.length === 0 ? (
        <p className="empty">
          No projects match. <Link href="/projects">See all projects</Link>.
        </p>
      ) : view === 'map' ? (
        <ProjectMap
          data={mapData(shown)}
          filterHref={Object.fromEntries(
            shown.flatMap((p) =>
              p.location?.slug
                ? [[p.location.slug, setHref(filters, { location: [p.location.slug] })]]
                : [],
            ),
          )}
        />
      ) : view === 'list' ? (
        <ProjectList projects={shown} />
      ) : (
        <>
          {withPhotos.length > 0 && (
            <ul className="portfolio-grid">
              {withPhotos.map((p) => (
                <li key={p.id} className="portfolio-item">
                  <Link href={`/projects/${p.slug}`}>
                    <div className="portfolio-image">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.image!.src}
                        srcSet={p.image!.srcSet}
                        sizes="(min-width: 1080px) 33vw, (min-width: 720px) 50vw, 100vw"
                        style={p.image!.position ? { objectPosition: p.image!.position } : undefined}
                        alt=""
                        loading="lazy"
                      />
                    </div>
                    <h3 className="portfolio-title">{p.name}</h3>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {withoutPhotos > 0 && (
            <p className="portfolio-more">
              {withPhotos.length === 0
                ? `${withoutPhotos === 1 ? 'This project has' : `These ${withoutPhotos} projects have`} no photos yet: see `
                : `${withoutPhotos === 1 ? 'One more project, without photos yet, is' : `${withoutPhotos} more projects, without photos yet, are`} in `}
              the <Link href={withView(gridHref, 'list')}>list</Link>.
            </p>
          )}
        </>
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
  view,
  children,
}: {
  label: string
  name: keyof Filters
  filters: Filters
  scroll?: boolean
  view?: View
  children: React.ReactNode
}) {
  const chosen = filters[name].length
  return (
    <details className="filter-menu">
      <summary>
        {label}
        {chosen > 0 && <span className="filter-count"> ({chosen})</span>}
      </summary>
      <form
        action="/projects"
        method="get"
        className="filter-panel"
        aria-label={`Filter by ${label.toLowerCase()}`}
      >
        <fieldset>
          <legend className="visually-hidden">{label}</legend>
          <div className={scroll ? 'filters-scroll' : undefined}>{children}</div>
        </fieldset>
        {view && <input type="hidden" name="view" value={view} />}
        {FILTER_KEYS.filter((k) => k !== name).flatMap((k) =>
          filters[k].map((v) => <input key={`${k}:${v}`} type="hidden" name={k} value={v} />),
        )}
        <div className="filters-actions">
          <button type="submit">Apply</button>
          {chosen > 0 && <Link href={view ? withView(setHref(filters, { [name]: [] }), view) : setHref(filters, { [name]: [] })}>Clear</Link>}
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
      <input
        type="checkbox"
        id={id}
        name={name}
        value={value}
        defaultChecked={filters[name].includes(value)}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  )
}

/**
 * Every project as text: name, place, architect, category, status and year, each linking to its
 * page or filtered view. On a phone, the place (and the status, unless completed) goes under the
 * name and the other columns are left out (they are on the project page).
 */
function ProjectList({ projects }: { projects: ProjectCard[] }) {
  return (
    <table className="project-list">
      <caption className="visually-hidden">Projects</caption>
      <thead>
        <tr>
          <th scope="col">Project</th>
          <th scope="col" className="col-location">
            Location
          </th>
          <th scope="col" className="col-architect">
            Architect
          </th>
          <th scope="col" className="col-category">
            Category
          </th>
          <th scope="col" className="col-status">
            Status
          </th>
          <th scope="col" className="col-year">
            Year
          </th>
        </tr>
      </thead>
      <tbody>
        {projects.map((p) => (
          <tr key={p.id}>
            <th scope="row">
              <Link href={`/projects/${p.slug}`}>{p.name}</Link>
              {/* Phones: place and, unless completed, status under the name (their columns are hidden). */}
              {(p.location?.slug || (p.status && p.status !== 'completed')) && (
                <span className="list-place">
                  {p.location?.slug && (
                    <Link href={withView(filterHref('location', p.location.slug), 'list')}>{p.location.displayName}</Link>
                  )}
                  {p.location?.slug && p.status && p.status !== 'completed' && ' · '}
                  {p.status && p.status !== 'completed' && (
                    <Link href={withView(filterHref('status', p.status), 'list')}>{PROJECT_STATUS[p.status]}</Link>
                  )}
                </span>
              )}
            </th>
            <td className="col-location">
              {p.location?.slug && <Link href={withView(filterHref('location', p.location.slug), 'list')}>{p.location.displayName}</Link>}
            </td>
            <td className="col-architect">
              {p.architects.map((a, i) => (
                <span key={a.slug ?? i}>
                  {i > 0 && ', '}
                  {a.slug ? <Link href={withView(filterHref('architect', a.slug), 'list')}>{a.name}</Link> : a.name}
                </span>
              ))}
            </td>
            <td className="col-category">
              {p.typologies[0]?.slug && <Link href={withView(filterHref('typology', p.typologies[0].slug), 'list')}>{p.typologies[0].name}</Link>}
            </td>
            <td className="col-status">
              {p.status && (
                <Link href={withView(filterHref('status', p.status), 'list')}>{PROJECT_STATUS[p.status]}</Link>
              )}
            </td>
            <td className="col-year">
              <ListYear project={p} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * The year alone, linking to it on the Timeline. Work in progress not on the Timeline yet links
 * to In Progress instead; its year is the expected completion.
 */
function ListYear({ project: p }: { project: ProjectCard }) {
  if (!p.year) return null
  if (onTimeline(p)) return <Link href={`/timeline#year-${p.year}`}>{p.year}</Link>
  if (p.status === 'in-progress')
    return (
      <Link href={withView(filterHref('status', 'in-progress'), 'list')} title="Expected completion">
        {p.year}
      </Link>
    )
  return <>{p.year}</>
}
