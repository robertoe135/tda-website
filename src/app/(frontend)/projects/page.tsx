import type { Metadata } from 'next'
import Link from 'next/link'

import {
  type Filters,
  getPublishedProjects,
  getTypologies,
  LINK_ONLY_KEYS,
  matches,
  parseFilters,
  REGION_OPTIONS,
  STATUS_OPTIONS,
  toggleHref,
} from '@/lib/projects'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export const metadata: Metadata = {
  title: 'Portfolio — Tillotson Design Associates',
  description: 'Lighting design projects by Tillotson Design Associates.',
  alternates: { canonical: '/projects' },
}

/**
 * The portfolio: TDA's grid of project names (as on the old category pages), with filters.
 * Categories are listed in the order of the old portfolio menu.
 */
export default async function ProjectsPage({ searchParams }: Props) {
  const filters = parseFilters(await searchParams)
  const [projects, typologies] = await Promise.all([getPublishedProjects(), getTypologies()])
  const shown = projects.filter((p) => matches(p, filters))

  // Only offer options that have at least one published project.
  const usedTypologies = new Set(projects.flatMap((p) => p.typologies.map((t) => t.slug)))
  const usedRegions = new Set(projects.map((p) => p.location?.worldRegion).filter(Boolean))
  const usedStatuses = new Set(projects.flatMap((p) => [p.status, p.featured ? 'featured' : undefined]))
  const architects = [
    ...new Map(projects.flatMap((p) => p.architects).map((a) => [a.slug, a])).values(),
  ].sort((a, b) => a.name.localeCompare(b.name))

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

  return (
    <div className="portfolio">
      <h1 className="page-title">Portfolio</h1>

      <details className="filters-toggle" open={active.length > 0}>
        <summary>filter{active.length > 0 ? ` (${active.length})` : ''}</summary>
        <form className="filters" action="/projects" method="get" aria-label="Filter projects">
          <FilterGroup legend="Category">
            {typologies
              .filter((t) => t.slug && usedTypologies.has(t.slug))
              .map((t) => (
                <Checkbox key={t.slug} name="typology" value={t.slug!} label={t.name} filters={filters} />
              ))}
            {STATUS_OPTIONS.filter((o) => usedStatuses.has(o.value)).map((o) => (
              <Checkbox key={o.value} name="status" value={o.value} label={o.label} filters={filters} />
            ))}
          </FilterGroup>

          <FilterGroup legend="Location">
            {REGION_OPTIONS.filter((o) => usedRegions.has(o.value)).map((o) => (
              <Checkbox key={o.value} name="region" value={o.value} label={o.label} filters={filters} />
            ))}
          </FilterGroup>

          <FilterGroup legend="Architect">
            <div className="filters-scroll">
              {architects.map((a) => (
                <Checkbox key={a.slug} name="architect" value={a.slug ?? ''} label={a.name} filters={filters} />
              ))}
            </div>
          </FilterGroup>

          {/* Filters reached from links on project pages (a city, a consultant, an owner) survive Apply. */}
          {LINK_ONLY_KEYS.flatMap((key) =>
            filters[key].map((v) => <input key={`${key}:${v}`} type="hidden" name={key} value={v} />),
          )}

          <div className="filters-actions">
            <button type="submit">apply</button>
            {active.length > 0 && <Link href="/projects">clear</Link>}
          </div>
        </form>
      </details>

      {active.length > 0 && (
        <p className="active-filters">
          {active.map(({ key, value }, i) => (
            <span key={`${key}:${value}`}>
              {i > 0 && <span aria-hidden="true"> | </span>}
              <Link href={toggleHref(filters, key, value)} aria-label={`Remove filter ${labelFor(key, value)}`}>
                {labelFor(key, value)} ×
              </Link>
            </span>
          ))}
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
                {/* Project image goes here once photographs are uploaded. */}
                <h3 className="portfolio-title">{p.name}</h3>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FilterGroup({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {children}
    </fieldset>
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
