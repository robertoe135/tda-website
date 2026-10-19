import React from 'react'
import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  render,
  Row,
  Section,
  Text,
} from 'react-email'

import type { Credit, EmailImage, Issue, IssueItem } from '../lib/newsletter'

/**
 * The newsletter as an email (design D, "Journal", agreed October 2026): masthead, then the
 * issue's blocks in order, then the studio footer. Built from React Email's table components so
 * it holds together in Outlook and Gmail. DM Sans loads where the mail app allows (Apple Mail,
 * iOS); everywhere else it falls back to Helvetica or Arial, and the design is drawn to survive that.
 */

const C = {
  text: '#000000',
  muted: '#595959',
  rule: '#e2e2e2',
  ground: '#ececea',
  paper: '#ffffff',
}
const FONT = "'DM Sans', Helvetica, Arial, sans-serif"
const W = 600
const PAD = 40

const p = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  margin: 0,
  fontFamily: FONT,
  fontSize: 15,
  lineHeight: '24px',
  fontWeight: 300,
  color: C.text,
  ...extra,
})
const label: React.CSSProperties = p({
  fontSize: 11,
  lineHeight: '16px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: C.muted,
  fontWeight: 400,
})
const link: React.CSSProperties = { color: C.text, textDecoration: 'underline' }
const pad = (top: number, bottom = 0): React.CSSProperties => ({
  padding: `${top}px ${PAD}px ${bottom}px`,
})

function Photo({ image, width, height }: { image?: EmailImage; width: number; height: number }) {
  if (!image) return <div style={{ width: '100%', height, backgroundColor: '#d9d6d0' }} />
  return (
    <Img
      src={image.src}
      alt={image.alt}
      width={width}
      height={height}
      style={{
        display: 'block',
        width: '100%',
        maxWidth: width,
        height: 'auto',
        objectFit: 'cover',
        border: 0,
      }}
    />
  )
}

function Rows<T>({
  rows,
  cell,
}: {
  rows: T[]
  cell: (r: T) => [React.ReactNode, React.ReactNode]
}) {
  return (
    <>
      {rows.map((r, i) => {
        const [a, b] = cell(r)
        return (
          <Row key={i} style={{ borderBottom: `1px solid ${C.rule}` }}>
            <Column style={{ width: 128, verticalAlign: 'top', padding: '12px 12px 12px 0' }}>
              {a}
            </Column>
            <Column style={{ verticalAlign: 'top', padding: '12px 0' }}>{b}</Column>
          </Row>
        )
      })}
    </>
  )
}

const CreditTable = ({ credits }: { credits: Credit[] }) =>
  credits.length ? (
    <Section style={{ marginTop: 16, borderTop: `1px solid ${C.rule}` }}>
      {credits.map((c) => (
        <Row key={c.label} style={{ borderBottom: `1px solid ${C.rule}` }}>
          <Column style={{ width: 120, padding: '9px 12px 9px 0', verticalAlign: 'top' }}>
            <Text style={p({ fontSize: 13, lineHeight: '20px', color: C.muted, fontWeight: 400 })}>
              {c.label}
            </Text>
          </Column>
          <Column style={{ padding: '9px 0', verticalAlign: 'top' }}>
            <Text style={p({ fontSize: 13, lineHeight: '20px' })}>{c.value}</Text>
          </Column>
        </Row>
      ))}
    </Section>
  ) : null

const Paragraphs = ({ items, style }: { items: string[]; style?: React.CSSProperties }) => (
  <>
    {items.map((t, i) => (
      <Text key={i} style={p({ marginTop: i ? 14 : 0, whiteSpace: 'pre-line', ...style })}>
        {t}
      </Text>
    ))}
  </>
)

const More = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Text style={p({ marginTop: 10, fontSize: 14, fontWeight: 400 })}>
    <Link href={href} style={link}>
      {children}
    </Link>
  </Text>
)

export function Item({ item }: { item: IssueItem }) {
  switch (item.kind) {
    case 'letter':
      return (
        <Section style={pad(36)}>
          <Paragraphs items={item.paragraphs} style={{ fontSize: 17, lineHeight: '27px' }} />
          {item.signatureName && (
            <Text style={{ ...label, marginTop: 22, color: C.text }}>
              {[item.signatureName, item.signatureTitle].filter(Boolean).join(', ')}
            </Text>
          )}
        </Section>
      )
    case 'section':
      return (
        <Section style={pad(52)}>
          <Text
            style={p({
              fontSize: 26,
              lineHeight: '32px',
              paddingBottom: 10,
              borderBottom: `1px solid ${C.text}`,
            })}
          >
            <span style={{ fontSize: 13, color: C.muted, fontWeight: 400, paddingRight: 14 }}>
              {item.number}
            </span>
            {item.title}
          </Text>
        </Section>
      )
    case 'project':
      return (
        <Section style={{ paddingTop: 28 }}>
          <Link href={item.href}>
            <Photo image={item.image} width={W} height={400} />
          </Link>
          <Section style={pad(18)}>
            <Text style={p({ fontSize: 22, lineHeight: '28px', fontWeight: 400 })}>
              <Link href={item.href} style={{ color: C.text, textDecoration: 'none' }}>
                {item.name}
              </Link>
            </Text>
            {item.city && (
              <Text style={p({ marginTop: 4, fontSize: 14, lineHeight: '20px', color: C.muted })}>
                {item.city}
              </Text>
            )}
            {item.paragraphs.length > 0 && (
              <Section style={{ marginTop: 14 }}>
                <Paragraphs items={item.paragraphs} />
              </Section>
            )}
            <CreditTable credits={item.credits} />
            <More href={item.href}>View project</More>
          </Section>
        </Section>
      )
    case 'grid': {
      const pairs: (typeof item.projects)[] = []
      for (let i = 0; i < item.projects.length; i += 2) pairs.push(item.projects.slice(i, i + 2))
      return (
        <Section style={pad(24)}>
          {pairs.map((pair, i) => (
            <Row key={i} style={{ paddingBottom: 24 }}>
              {[0, 1].map((j) => {
                const pr = pair[j]
                return (
                  <Column
                    key={j}
                    className="stack"
                    style={{
                      width: '50%',
                      verticalAlign: 'top',
                      paddingLeft: j ? 10 : 0,
                      paddingRight: j ? 0 : 10,
                    }}
                  >
                    {pr && (
                      <Link href={pr.href} style={{ color: C.text, textDecoration: 'none' }}>
                        <Photo image={pr.image} width={250} height={173} />
                        <Text style={p({ marginTop: 10, fontWeight: 400 })}>{pr.name}</Text>
                        {pr.city && (
                          <Text style={p({ fontSize: 13, lineHeight: '20px', color: C.muted })}>
                            {pr.city}
                          </Text>
                        )}
                      </Link>
                    )}
                  </Column>
                )
              })}
            </Row>
          ))}
        </Section>
      )
    }
    case 'conversation':
      return (
        <Section style={pad(24)}>
          <Row>
            {item.portrait && (
              <Column
                className="stack"
                style={{ width: 200, verticalAlign: 'top', paddingRight: 24, paddingBottom: 16 }}
              >
                <Photo image={item.portrait} width={200} height={260} />
              </Column>
            )}
            <Column className="stack" style={{ verticalAlign: 'top' }}>
              {item.name && <Text style={p({ fontSize: 16, fontWeight: 400 })}>{item.name}</Text>}
              {item.role && (
                <Text style={p({ fontSize: 13, lineHeight: '20px', color: C.muted })}>
                  {item.role}
                </Text>
              )}
              {item.question && (
                <Text style={p({ marginTop: 16, fontSize: 14, fontWeight: 400 })}>
                  <span style={{ color: C.muted }}>TDA: </span>
                  {item.question}
                </Text>
              )}
              {item.answer.length > 0 && (
                <Section style={{ marginTop: 10 }}>
                  <Paragraphs items={item.answer} style={{ fontSize: 14, lineHeight: '22px' }} />
                </Section>
              )}
              {item.href && <More href={item.href}>{item.linkLabel}</More>}
            </Column>
          </Row>
        </Section>
      )
    case 'awards':
      return (
        <Section style={pad(24)}>
          <Text style={label}>Awards</Text>
          <Rows
            rows={item.rows}
            cell={(r) => [
              <Text
                key="a"
                style={p({ fontSize: 13, lineHeight: '22px', color: C.muted, fontWeight: 400 })}
              >
                {r.year ?? ''}
              </Text>,
              <React.Fragment key="b">
                <Text style={p({ lineHeight: '22px' })}>{r.name}</Text>
                {r.project && (
                  <Text
                    style={p({ fontSize: 13, lineHeight: '20px', color: C.muted, marginTop: 2 })}
                  >
                    {r.href ? (
                      <Link href={r.href} style={{ color: C.muted }}>
                        {r.project}
                      </Link>
                    ) : (
                      r.project
                    )}
                  </Text>
                )}
              </React.Fragment>,
            ]}
          />
        </Section>
      )
    case 'press':
      return (
        <Section style={pad(24)}>
          <Text style={label}>Press</Text>
          <Rows
            rows={item.rows}
            cell={(r) => [
              <Text
                key="a"
                style={p({ fontSize: 13, lineHeight: '22px', color: C.muted, fontWeight: 400 })}
              >
                {r.outlet ?? ''}
              </Text>,
              <Text key="b" style={p({ lineHeight: '22px' })}>
                <Link href={r.href} style={{ color: C.text, textDecoration: 'none' }}>
                  {r.title}
                </Link>
              </Text>,
            ]}
          />
        </Section>
      )
    case 'events':
      return (
        <Section style={pad(24)}>
          <Text style={label}>Talks and events</Text>
          <Rows
            rows={item.rows}
            cell={(r) => [
              <Text
                key="a"
                style={p({ fontSize: 13, lineHeight: '22px', color: C.muted, fontWeight: 400 })}
              >
                {r.date ?? ''}
              </Text>,
              <React.Fragment key="b">
                <Text style={p({ lineHeight: '22px' })}>
                  {r.href ? (
                    <Link href={r.href} style={{ color: C.text }}>
                      {r.title}
                    </Link>
                  ) : (
                    r.title
                  )}
                </Text>
                {r.place && (
                  <Text
                    style={p({ fontSize: 13, lineHeight: '20px', color: C.muted, marginTop: 2 })}
                  >
                    {r.place}
                  </Text>
                )}
              </React.Fragment>,
            ]}
          />
        </Section>
      )
    case 'text':
      return (
        <Section style={pad(28)}>
          {item.heading && (
            <Text
              style={p({ fontSize: 20, lineHeight: '26px', fontWeight: 400, marginBottom: 10 })}
            >
              {item.heading}
            </Text>
          )}
          <Paragraphs items={item.paragraphs} />
          {item.href && <More href={item.href}>{item.linkLabel}</More>}
        </Section>
      )
    case 'image':
      return (
        <Section style={{ paddingTop: 28 }}>
          {item.href ? (
            <Link href={item.href}>
              <Photo image={item.image} width={W} height={400} />
            </Link>
          ) : (
            <Photo image={item.image} width={W} height={400} />
          )}
          {item.caption && (
            <Text
              style={{ ...p({ fontSize: 13, lineHeight: '20px', color: C.muted }), ...pad(10) }}
            >
              {item.caption}
            </Text>
          )}
        </Section>
      )
  }
}

export type Links = {
  /** "View in browser", when the issue has a public page. */
  browserHref?: string
  /** The list's unsubscribe link; none in the browser version. */
  unsubscribeHref?: string
}

/** Logo, newsletter name and issue line. */
export function Masthead({ issue }: { issue: Issue }) {
  // A PNG (Gmail and Outlook don't show SVG), in Blob storage so every inbox reaches it.
  const logo = issue.logo
  return (
    <>
      <Section
        style={{
          padding: `40px ${PAD}px 36px`,
          textAlign: 'center',
          borderBottom: `1px solid ${C.text}`,
        }}
      >
        <Link href={issue.site}>
          <Img
            src={logo}
            alt="Tillotson Design Associates"
            width={87}
            height={36}
            style={{ display: 'inline-block', height: 36, width: 'auto', border: 0 }}
          />
        </Link>
        {issue.masthead && (
          <Text
            style={p({
              marginTop: 28,
              fontSize: 40,
              lineHeight: '44px',
              letterSpacing: '-0.01em',
              textAlign: 'center',
            })}
          >
            {issue.masthead}
          </Text>
        )}
        {issue.issueLine && (
          <Text style={p({ marginTop: 10, color: C.muted, textAlign: 'center' })}>
            {issue.issueLine}
          </Text>
        )}
      </Section>
    </>
  )
}

/** The studio's address and contacts, then the unsubscribe line (none in the browser version). */
export function StudioFooter({ issue, links = {} }: { issue: Issue; links?: Links }) {
  const f = issue.footer
  const white: React.CSSProperties = { color: '#ffffff', textDecoration: 'underline' }
  return (
    <>
      <Section style={{ height: 48 }} />
      <Section style={{ backgroundColor: '#000000', padding: `36px ${PAD}px` }}>
        <Row>
          <Column
            className="stack"
            style={{ width: '50%', verticalAlign: 'top', paddingRight: 14, paddingBottom: 20 }}
          >
            <Text
              style={p({ fontSize: 12, lineHeight: '20px', color: '#ffffff', fontWeight: 400 })}
            >
              Tillotson Design Associates
            </Text>
            {[...f.addressLines, f.phone].filter(Boolean).map((line) => (
              <Text key={line} style={p({ fontSize: 12, lineHeight: '20px', color: '#d4d4d4' })}>
                {line}
              </Text>
            ))}
          </Column>
          <Column className="stack" style={{ verticalAlign: 'top' }}>
            {f.generalEmail && (
              <Text style={p({ fontSize: 12, lineHeight: '20px', color: '#bdbdbd' })}>
                General{' '}
                <Link href={`mailto:${f.generalEmail}`} style={white}>
                  {f.generalEmail}
                </Link>
              </Text>
            )}
            {f.pressEmail && (
              <Text style={p({ fontSize: 12, lineHeight: '20px', color: '#bdbdbd' })}>
                Press{' '}
                <Link href={`mailto:${f.pressEmail}`} style={white}>
                  {f.pressEmail}
                </Link>
              </Text>
            )}
            <Text style={p({ marginTop: 12, fontSize: 12, lineHeight: '20px', color: '#ffffff' })}>
              {[{ label: 'tillotsondesign.com', url: issue.site }, ...f.social].map((s, i) => (
                <React.Fragment key={s.url}>
                  {i > 0 && ' · '}
                  <Link href={s.url} style={white}>
                    {s.label}
                  </Link>
                </React.Fragment>
              ))}
            </Text>
          </Column>
        </Row>
      </Section>
      {links.unsubscribeHref && (
        <Section style={{ backgroundColor: '#f4f4f4', padding: `16px ${PAD}px` }}>
          <Text
            style={p({ fontSize: 11, lineHeight: '16px', color: C.muted, textAlign: 'center' })}
          >
            You are getting this because you signed up at tillotsondesign.com.{' '}
            <Link
              href={links.unsubscribeHref}
              style={{ color: C.muted, textDecoration: 'underline' }}
            >
              Unsubscribe
            </Link>
          </Text>
        </Section>
      )}
    </>
  )
}

export function NewsletterEmail({ issue, links = {} }: { issue: Issue; links?: Links }) {
  return (
    <Html lang="en">
      <Head>
        {/* Loaded by Apple Mail and iOS; Gmail and Outlook ignore it and use the fallback. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- an email's <head>, not a Next page */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400&display=swap"
          rel="stylesheet"
        />
        <style>{`@media (max-width: 620px) { .stack { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; } .stack img { max-width: 100% !important; } }`}</style>
      </Head>
      {issue.preheader && <Preview>{issue.preheader}</Preview>}
      <Body style={{ margin: 0, padding: '24px 0 40px', backgroundColor: C.ground }}>
        {links.browserHref && (
          <Text
            style={p({
              fontSize: 11,
              lineHeight: '16px',
              color: C.muted,
              textAlign: 'center',
              marginBottom: 12,
            })}
          >
            <Link href={links.browserHref} style={{ color: C.muted, textDecoration: 'underline' }}>
              View in browser
            </Link>
          </Text>
        )}
        <Container style={{ width: '100%', maxWidth: W, backgroundColor: C.paper }}>
          <Masthead issue={issue} />

          {issue.items.map((item, i) => (
            <Item key={i} item={item} />
          ))}

          <StudioFooter issue={issue} links={links} />
        </Container>
      </Body>
    </Html>
  )
}

/** Resend fills this in for each person on the list; it only works in a broadcast. */
export const RESEND_UNSUBSCRIBE = '{{{RESEND_UNSUBSCRIBE_URL}}}'

export async function renderNewsletter(issue: Issue, links: Links = {}) {
  const element = <NewsletterEmail issue={issue} links={links} />
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])
  return { html, text }
}

const fragment = async (el: React.ReactElement) =>
  (await render(el)).replace(/^<!DOCTYPE[^>]*>/i, '').trim()

/**
 * The email in parts, for the visual editor's canvas: each block's HTML by block id (blocks
 * left out of the email have none), plus the masthead and footer. Drawn by the same components
 * as the email, so the canvas shows exactly what will be sent.
 */
export async function renderParts(issue: Issue) {
  const blocks: Record<string, string> = {}
  for (const item of issue.items)
    if (item.blockId) blocks[item.blockId] = await fragment(<Item item={item} />)
  const [header, footer] = await Promise.all([
    fragment(<Masthead issue={issue} />),
    fragment(<StudioFooter issue={issue} links={{ unsubscribeHref: '#' }} />),
  ])
  return { blocks, header, footer }
}
