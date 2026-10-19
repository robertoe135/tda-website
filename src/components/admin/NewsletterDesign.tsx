'use client'

import '@puckeditor/core/puck.css'

import { type Config, type Data, type Field, Puck } from '@puckeditor/core'
import Link from 'next/link'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { blocksToPuck, type Kind, puckToBlocks, type Ref } from '@/lib/newsletter-puck'

/**
 * The issue's Design tab: drag blocks from the left into the email, reorder them on the page,
 * and fill the selected one in on the right. The canvas shows each block drawn by the server
 * exactly as it will be emailed (POST /api/newsletters/preview-blocks). Changes save on their
 * own, into the same blocks the Edit tab shows, so sending is unchanged.
 */

type Parts = { blocks: Record<string, string>; header: string; footer: string }
const PartsContext = createContext<{ parts?: Parts; loading: boolean }>({ loading: true })

const LABELS: Record<string, string> = {
  letter: 'Letter',
  section: 'Section heading',
  project: 'Project',
  projectGrid: 'Projects, two across',
  conversation: 'Conversation',
  awards: 'Awards',
  press: 'Press',
  events: 'Talks and events',
  text: 'Text',
  image: 'Image',
}
/** What an empty block asks for, on the canvas only (empty blocks are never sent). */
const HINTS: Record<string, string> = {
  letter: 'Write the letter on the right.',
  section: 'Give the heading a title. Left out of the email when nothing follows it.',
  project: 'Choose a published project on the right.',
  projectGrid: 'Add projects on the right.',
  conversation: 'Fill in the conversation on the right.',
  awards: 'Add awards on the right.',
  press: 'Add articles on the right.',
  events: 'Add talks or events on the right.',
  text: 'Write the text on the right.',
  image: 'Choose an image on the right.',
}

function Block({ id, type }: { id: string; type: string }) {
  const { parts, loading } = useContext(PartsContext)
  const html = parts?.blocks[id]
  if (html) return <div dangerouslySetInnerHTML={{ __html: html }} />
  return (
    <div
      style={{
        margin: '16px 40px',
        padding: '18px 20px',
        border: '1px dashed #b5b5b5',
        font: '14px/1.4 Helvetica, Arial, sans-serif',
        color: '#595959',
      }}
    >
      <strong style={{ color: '#000' }}>{LABELS[type]}</strong>
      <br />
      {loading ? 'Drawing…' : HINTS[type]}
    </div>
  )
}

function Paper({ children }: { children: React.ReactNode }) {
  const { parts } = useContext(PartsContext)
  return (
    <div style={{ minHeight: '100vh', padding: '24px 0 40px', background: '#ececea' }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- inside the editor's canvas frame */}
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400&display=swap"
        rel="stylesheet"
      />
      <div style={{ width: '100%', maxWidth: 600, margin: '0 auto', background: '#fff' }}>
        {parts && <div dangerouslySetInnerHTML={{ __html: parts.header }} />}
        <div style={{ minHeight: 120 }}>{children}</div>
        <div style={{ height: 48 }} />
        {parts && <div dangerouslySetInnerHTML={{ __html: parts.footer }} />}
      </div>
    </div>
  )
}

/** A search over something on the site, for a field that points at it. */
function picker(kind: Kind, label: string, placeholder: string): Field {
  const url = (q: string) => {
    const like = (f: string) => (q ? `&where[${f}][like]=${encodeURIComponent(q)}` : '')
    if (kind === 'projects')
      return `/api/projects?depth=1&limit=30&sort=-year&where[_status][equals]=published${like('name')}`
    if (kind === 'awards') return `/api/awards?depth=1&limit=30&sort=-year${like('name')}`
    if (kind === 'press') return `/api/press?depth=0&limit=30&sort=-date${like('title')}`
    return `/api/media?depth=0&limit=30&sort=-createdAt${like('alt')}`
  }
  type Row = Record<string, unknown> & { id: number }
  const thumb = (r: Row) => (typeof r.thumbnailURL === 'string' ? r.thumbnailURL : undefined)
  return {
    type: 'external',
    label,
    placeholder,
    showSearch: true,
    fetchList: async ({ query }) => {
      const res = await fetch(url(query), { credentials: 'include' })
      return res.ok ? ((await res.json()).docs as Row[]) : []
    },
    mapRow: (r: Row): Record<string, string | React.ReactElement> => {
      const project = r.project as { name?: string } | undefined
      if (kind === 'projects')
        return {
          Project: String(r.name ?? ''),
          City: String((r.location as { displayName?: string } | undefined)?.displayName ?? ''),
          Year: String(r.year ?? ''),
        }
      if (kind === 'awards')
        return {
          Year: String(r.year ?? ''),
          Award: String(r.name ?? ''),
          Project: String(project?.name ?? ''),
        }
      if (kind === 'press')
        return { Outlet: String(r.outlet ?? ''), Article: String(r.title ?? '') }
      return {
        Image: thumb(r) ? (
          // eslint-disable-next-line @next/next/no-img-element -- a thumbnail in the admin's picker
          <img src={thumb(r)} alt="" style={{ width: 72, height: 48, objectFit: 'cover' }} />
        ) : (
          ''
        ),
        Description: String(r.alt ?? ''),
      }
    },
    mapProp: (r: Row): Ref => {
      const project = r.project as { name?: string } | undefined
      const label =
        kind === 'projects'
          ? String(r.name)
          : kind === 'media'
            ? String(r.alt)
            : kind === 'awards'
              ? [r.year, r.name, project?.name && `(${project.name})`].filter(Boolean).join(' ')
              : [r.outlet, r.title].filter(Boolean).join(': ')
      return { id: r.id, label, thumb: thumb(r) }
    },
    getItemSummary: (r: Ref) =>
      r?.thumb ? (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a thumbnail in the admin */}
          <img src={r.thumb} alt="" style={{ width: 40, height: 28, objectFit: 'cover' }} />
          {r.label}
        </span>
      ) : (
        (r?.label ?? '')
      ),
  } as Field
}

const text = (label: string): Field => ({ type: 'text', label })
const area = (label: string): Field => ({ type: 'textarea', label })
const link = (label = 'Link (optional), starting with https://'): Field => ({ type: 'text', label })
const list = (key: string, field: Field, label: string, summary: string): Field => ({
  type: 'array',
  label,
  arrayFields: { [key]: field },
  getItemSummary: (row: Record<string, Ref>, i?: number) =>
    row[key]?.label ?? `${summary} ${(i ?? 0) + 1}`,
  defaultItemProps: { [key]: null },
})

const block = (
  type: string,
  fields: Record<string, Field>,
  defaultProps: Record<string, unknown> = {},
) => ({
  label: LABELS[type],
  fields,
  defaultProps,
  render: ({ id }: { id: string }) => <Block id={id} type={type} />,
})

const config: Config = {
  categories: {
    opening: { title: 'Opening', components: ['letter'] },
    layout: { title: 'Layout', components: ['section'] },
    site: { title: 'From the site', components: ['project', 'projectGrid', 'awards', 'press'] },
    stories: { title: 'Stories', components: ['conversation', 'events', 'text', 'image'] },
  },
  components: {
    letter: block('letter', {
      body: area('Letter (empty line between paragraphs)'),
      signatureName: text('Signed by'),
      signatureTitle: text('Their title'),
    }),
    section: block('section', { title: text('Title, e.g. Recent work') }, { title: '' }),
    project: block(
      'project',
      {
        project: picker('projects', 'Project', 'Choose a published project'),
        note: area('Note for this issue (empty: the project’s summary)'),
        image: picker('media', 'Different photo (optional)', 'Choose an image'),
        showCredits: {
          type: 'radio',
          label: 'Credits',
          options: [
            { label: 'Show', value: true },
            { label: 'Hide', value: false },
          ],
        },
      },
      { showCredits: true, project: null, image: null },
    ),
    projectGrid: block(
      'projectGrid',
      {
        projects: list(
          'project',
          picker('projects', 'Project', 'Choose a published project'),
          'Projects',
          'Project',
        ),
      },
      { projects: [] },
    ),
    conversation: block(
      'conversation',
      {
        name: text('Who TDA spoke with'),
        role: text('Their role or firm'),
        portrait: picker('media', 'Portrait', 'Choose an image'),
        question: area('Question'),
        answer: area('The start of the answer'),
        url: link('Link to the full conversation'),
        linkLabel: text('Link label'),
      },
      { linkLabel: 'Read the conversation', portrait: null },
    ),
    awards: block(
      'awards',
      { awards: list('award', picker('awards', 'Award', 'Choose an award'), 'Awards', 'Award') },
      { awards: [] },
    ),
    press: block(
      'press',
      {
        items: list('item', picker('press', 'Article', 'Choose an article'), 'Articles', 'Article'),
      },
      { items: [] },
    ),
    events: block(
      'events',
      {
        events: {
          type: 'array',
          label: 'Events',
          arrayFields: {
            date: text('Date, as it should read'),
            title: text('Title'),
            place: text('Place'),
            url: link(),
          },
          getItemSummary: (e: { title?: string }, i?: number) => e.title || `Event ${(i ?? 0) + 1}`,
          defaultItemProps: { date: '', title: '', place: '', url: '' },
        },
      },
      { events: [] },
    ),
    text: block(
      'text',
      {
        heading: text('Heading (optional)'),
        body: area('Text (empty line between paragraphs)'),
        url: link(),
        linkLabel: text('Link label'),
      },
      { linkLabel: 'Read more' },
    ),
    image: block(
      'image',
      { image: picker('media', 'Image', 'Choose an image'), caption: text('Caption'), url: link() },
      { image: null },
    ),
  },
  // The page itself has nothing to set here: subject, name and issue line are on the Edit tab.
  root: {
    fields: {},
    render: ({ children }: { children: React.ReactNode }) => <Paper>{children}</Paper>,
  },
}

type Doc = {
  subject?: string
  masthead?: string
  issueNumber?: number
  theme?: string
  season?: string
  sentAt?: string
  content?: unknown[]
}

export function NewsletterDesign({ id, readOnly }: { id: string; readOnly: boolean }) {
  const [doc, setDoc] = useState<Doc>()
  const [error, setError] = useState<string>()
  const [parts, setParts] = useState<Parts>()
  const [drawing, setDrawing] = useState(true)
  const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved')
  const latest = useRef<Data>(undefined)
  const timers = useRef<{
    draw?: ReturnType<typeof setTimeout>
    save?: ReturnType<typeof setTimeout>
  }>({})

  const initial = useMemo(
    () => (doc ? (blocksToPuck(doc.content) as unknown as Data) : undefined),
    [doc],
  )

  const draw = useCallback((data: Data, issue: Doc | undefined) => {
    setDrawing(true)
    fetch('/api/newsletters/preview-blocks', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: puckToBlocks(data as never), issue }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setParts)
      .catch(() => undefined)
      .finally(() => setDrawing(false))
  }, [])

  useEffect(() => {
    fetch(`/api/newsletters/${id}?draft=true&depth=1`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Doc) => {
        setDoc(d)
        draw(blocksToPuck(d.content) as unknown as Data, d) // the canvas, once loaded
      })
      .catch(() => setError('This issue could not be loaded. Reload the page.'))
  }, [id, draw])

  // Save as a draft (as the Edit tab's autosave does), a moment after the last change.
  const save = useCallback(
    (data: Data) => {
      setSaved('saving')
      fetch(`/api/newsletters/${id}?draft=true&autosave=true`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: puckToBlocks(data as never) }),
      })
        .then((r) => setSaved(r.ok ? 'saved' : 'error'))
        .catch(() => setSaved('error'))
    },
    [id],
  )

  const onChange = (data: Data) => {
    latest.current = data
    clearTimeout(timers.current.draw)
    timers.current.draw = setTimeout(() => draw(data, doc), 350)
    if (readOnly) return
    setSaved('saving')
    clearTimeout(timers.current.save)
    timers.current.save = setTimeout(() => save(data), 900)
  }

  // Leaving with a change not yet saved: save it now.
  useEffect(() => {
    const t = timers.current
    return () => {
      if (t.save && latest.current && !readOnly) {
        clearTimeout(t.save)
        save(latest.current)
      }
    }
  }, [save, readOnly])

  if (error) return <p style={{ padding: 'var(--base)' }}>{error}</p>
  if (!initial) return <p style={{ padding: 'var(--base)' }}>Loading the issue…</p>

  return (
    <PartsContext.Provider value={{ parts, loading: drawing }}>
      <div className="newsletter-design">
        <Puck
          config={config}
          data={initial}
          onChange={onChange}
          headerTitle={doc?.subject || 'Newsletter'}
          height="calc(100vh - 150px)"
          viewports={[
            { width: 680, label: 'Desktop', icon: 'Monitor' },
            { width: 390, label: 'Phone', icon: 'Smartphone' },
          ]}
          permissions={
            readOnly
              ? { drag: false, duplicate: false, delete: false, edit: false, insert: false }
              : undefined
          }
          overrides={{
            headerActions: () => (
              <span style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 14 }}>
                <span
                  role="status"
                  style={{ color: saved === 'error' ? 'var(--theme-error-500)' : 'inherit' }}
                >
                  {readOnly
                    ? 'Sent: read only'
                    : saved === 'saving'
                      ? 'Saving…'
                      : saved === 'error'
                        ? 'Not saved: check your connection'
                        : 'Saved'}
                </span>
                <Link href={`/admin/collections/newsletters/${id}`}>
                  Subject, preview and sending
                </Link>
              </span>
            ),
          }}
        />
      </div>
    </PartsContext.Provider>
  )
}
