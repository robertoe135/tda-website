'use client'

import { RefreshRouteOnSave } from '@payloadcms/live-preview-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type CSSProperties, useEffect, useRef, useState } from 'react'

import { useScrollSpy } from '@/hooks/useScrollSpy'
import type { Card } from '@/lib/year-of-light'

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
/** "four", or 14 as "14": numbers spelled out up to ten, as in running text. */
const inWords = (n: number) => WORDS[n] ?? String(n)

/**
 * Year of Light, the year in review: one card per screen, read by scrolling. Each card has its
 * own downlight, a little cooler than the one before, from warm 2700 K to 6500 K daylight on the
 * last card. A card's light comes on, and its big number counts up, as it scrolls into view.
 * Without JavaScript, or with reduced motion, everything is simply there, lit.
 */
export function YearOfLight({ cards, preview }: { cards: Card[]; preview?: boolean }) {
  const router = useRouter()
  const root = useRef<HTMLDivElement>(null)
  const { current, pin } = useScrollSpy(
    () => cards.map((_, i) => document.getElementById(`card-${i + 1}`)).filter((s): s is HTMLElement => Boolean(s)),
    [cards.length],
    () => 0.5,
  )

  // Lights start off only where they can be watched coming on: with motion allowed, each card
  // is marked lit (data-on) the first time it scrolls into view. Without this everything is lit.
  useEffect(() => {
    const el = root.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const sections = [...el.querySelectorAll<HTMLElement>('.yol-card')].filter((s) => !s.hasAttribute('data-on'))
    const watch = new IntersectionObserver(
      (entries) => {
        for (const e of entries.filter((e) => e.isIntersecting)) {
          ;(e.target as HTMLElement).setAttribute('data-on', '')
          watch.unobserve(e.target)
        }
      },
      { threshold: 0.35 },
    )
    el.setAttribute('data-animate', '')
    sections.forEach((s) => watch.observe(s))
    return () => watch.disconnect()
  }, [cards.length])

  const card = cards[current] ?? cards[0]
  return (
    <div ref={root} className="yol">
      {preview && <RefreshRouteOnSave refresh={() => router.refresh()} serverURL={typeof window === 'undefined' ? '' : window.location.origin} />}
      <nav className="yol-progress" aria-label="Cards" style={{ '--k': card.color } as CSSProperties} data-day={card.kind === 'closing' || undefined}>
        <ol>
          {cards.map((c, i) => (
            <li key={i}>
              <a href={`#card-${i + 1}`} aria-current={i === current ? 'step' : undefined} data-past={i < current || undefined} onClick={() => pin(i)}>
                <span className="visually-hidden">{LABEL[c.kind]}</span>
              </a>
            </li>
          ))}
        </ol>
        <p className="yol-kelvin" aria-hidden="true">
          {card.kelvin} K
        </p>
      </nav>
      {cards.map((c, i) => (
        <section
          key={i}
          id={`card-${i + 1}`}
          data-i={i}
          className={`yol-card yol-${c.kind}`}
          style={{ '--k': c.color } as CSSProperties}
          aria-label={c.kind === 'cover' ? undefined : LABEL[c.kind]}
        >
          {c.kind !== 'closing' && <div className="yol-downlight" aria-hidden="true" />}
          <div className="yol-body">
            <Body card={c} />
          </div>
        </section>
      ))}
    </div>
  )
}

const LABEL: Record<Card['kind'], string> = {
  cover: 'Year of Light',
  completed: 'Projects completed',
  where: 'Where',
  awards: 'Awards',
  collaborators: 'Collaborators',
  studio: 'In the studio',
  light: 'Light of the year',
  closing: 'Thank you',
}

/** A big number that counts up the first time it scrolls into view. The real number is always in the page. */
function Count({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  useEffect(() => {
    const el = ref.current
    if (!el || value < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const watch = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        watch.disconnect()
        const t0 = performance.now()
        frame = requestAnimationFrame(function step(t) {
          const p = Math.min(1, (t - t0) / 1100)
          setShown(Math.round(value * (1 - Math.pow(1 - p, 3))))
          if (p < 1) frame = requestAnimationFrame(step)
        })
      },
      { threshold: 0.5 },
    )
    watch.observe(el)
    return () => {
      watch.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value])
  return (
    <span className="yol-n" ref={ref}>
      <span aria-hidden="true">{shown}</span>
      <span className="visually-hidden">{value}</span>
    </span>
  )
}

function Body({ card: c }: { card: Card }) {
  switch (c.kind) {
    case 'cover':
      return (
        <>
          <p className="yol-label yol-tint">Tillotson Design Associates</p>
          <h1 className="yol-title">
            Year of Light <span className="yol-n yol-year yol-tint">{c.year}</span>
          </h1>
          {c.intro && <p className="yol-lede">{c.intro}</p>}
          <a href="#card-2" className="yol-next">
            Scroll, and watch the light change
          </a>
        </>
      )
    case 'completed':
      return (
        <>
          <p className="yol-label">Switched on in {c.year}</p>
          <p className="yol-big">
            <Link href={c.href} className="yol-tint">
              <Count value={c.count} />
            </Link>
          </p>
          <h2 className="yol-h">{c.count === 1 ? 'project' : 'projects'} completed</h2>
          <ol className="yol-list yol-numbered">
            {c.projects.map((p) => (
              <li key={p.href}>
                <Link href={p.href}>{p.label}</Link>
              </li>
            ))}
          </ol>
        </>
      )
    case 'where':
      return (
        <>
          <p className="yol-label">Where the lights came on</p>
          <div className="yol-pins" aria-hidden="true">
            {c.places.map((p) => (
              <span key={p.href} style={{ '--s': Math.sqrt(p.count) } as CSSProperties} />
            ))}
          </div>
          {c.places.length === 1 ? (
            <h2 className="yol-h yol-h-big">
              {c.count === 1 ? 'In' : c.count === 2 ? 'Both in' : `All ${inWords(c.count)} in`}{' '}
              <Link href={c.places[0].href}>{c.places[0].label}</Link>.
            </h2>
          ) : (
            <>
              <h2 className="yol-h yol-h-big">{inWords(c.places.length).replace(/^./, (l) => l.toUpperCase())} places.</h2>
              <ul className="yol-list">
                {c.places.map((p) => (
                  <li key={p.href}>
                    <Link href={p.href}>{p.label}</Link>
                    <span className="yol-tint">{p.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {c.note && <p className="yol-lede">{c.note}</p>}
        </>
      )
    case 'awards':
      return (
        <>
          <p className="yol-label">Recognition</p>
          <p className="yol-big yol-tint">
            <Count value={c.count} />
          </p>
          <h2 className="yol-h">
            {c.count === 1 ? 'award' : 'awards'} for <span className="yol-tint">{c.projectCount}</span> {c.projectCount === 1 ? 'project' : 'projects'}
          </h2>
          <ul className="yol-list yol-awards">
            {c.awards.map((a, i) => (
              <li key={i}>
                <Link href={a.project.href}>
                  <span>{a.name}</span>
                  {a.issuer && <span className="yol-sub"> · {a.issuer}</span>}
                  <span className="yol-sub yol-block">{a.project.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )
    case 'collaborators':
      return (
        <>
          <p className="yol-label">{c.picked ? 'In good company' : c.tie ? 'Most-awarded collaborators' : 'Most-awarded collaborator'}</p>
          {c.tie && <p className="yol-lede">It’s a tie.</p>}
          <div className="yol-firms">
            {c.firms.map((f, i) => (
              <div key={f.href}>
                {i > 0 && (
                  <p className="yol-amp yol-tint" aria-hidden="true">
                    &amp;
                  </p>
                )}
                <h2 className="yol-h yol-h-big">
                  <Link href={f.href}>{f.label}</Link>
                </h2>
                {f.projects.length > 0 && (
                  <p className="yol-sub">
                    {c.picked ? 'This year: ' : `${f.projects.length} awarded projects: `}
                    {f.projects.map((p, k) => (
                      <span key={p.href}>
                        {k > 0 && ', '}
                        <Link href={p.href}>{p.label}</Link>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )
    case 'studio':
      return (
        <>
          <p className="yol-label">Behind the scenes</p>
          <h2 className="yol-h yol-h-big">In the studio</h2>
          <dl className="yol-stats">
            {c.numbers.map((n, i) => (
              <div key={i}>
                <dt className="yol-sub">{n.label}</dt>
                <dd className="yol-n yol-tint">{n.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )
    case 'light':
      return (
        <>
          {c.image && (
            <figure className="yol-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.image.src}
                srcSet={c.image.srcSet}
                sizes="100vw"
                alt={c.image.alt}
                loading="lazy"
                style={c.image.position ? { objectPosition: c.image.position } : undefined}
              />
              {c.credit.length > 0 && <figcaption>Photo: {c.credit.join(', ')}</figcaption>}
            </figure>
          )}
          <div className="yol-light-text">
            <p className="yol-label yol-tint">Light of the year</p>
            <h2 className="yol-h yol-h-big">
              <Link href={c.project.href}>{c.project.label}</Link>
            </h2>
            {c.details.length > 0 && (
              <p className="yol-label">
                {c.details.map((d, k) => (
                  <span key={d.href}>
                    {k > 0 && ' · '}
                    <Link href={d.href}>{d.label}</Link>
                  </span>
                ))}
              </p>
            )}
            {c.quote && (
              <blockquote className="yol-quote">
                <p>“{c.quote}”</p>
                {c.quoteBy && <footer>{c.quoteBy.href ? <Link href={c.quoteBy.href}>{c.quoteBy.label}</Link> : c.quoteBy.label}</footer>}
              </blockquote>
            )}
            <Link href={c.project.href} className="yol-cta">
              See the project
            </Link>
          </div>
        </>
      )
    case 'closing':
      return (
        <>
          <p className="yol-label">That was {c.year}</p>
          <h2 className="yol-thanks">Thank you.</h2>
          {c.thanks && <p className="yol-lede">{c.thanks}</p>}
          <div className="yol-actions">
            <ShareButton year={c.year} />
            <Link href="/projects" className="yol-button yol-button-line">
              See all work
            </Link>
          </div>
          {c.years.length > 0 && (
            <p className="yol-label">
              Other years:{' '}
              {c.years.map((y, k) => (
                <span key={y.href}>
                  {k > 0 && ' · '}
                  <Link href={y.href}>{y.label}</Link>
                </span>
              ))}
            </p>
          )}
        </>
      )
  }
}

/** Shares the page with the phone's share sheet, or copies its address where there is none. */
function ShareButton({ year }: { year: number }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = window.location.href.split('#')[0].split('?')[0]
    if (navigator.share) {
      await navigator.share({ title: `Year of Light ${year} · Tillotson Design Associates`, url }).catch(() => undefined)
      return
    }
    await navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2400)
  }
  return (
    <button type="button" className="yol-button" onClick={share}>
      {copied ? 'Link copied' : 'Share'}
    </button>
  )
}
