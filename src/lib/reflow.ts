/**
 * Text pasted from Word or a PDF keeps a hard break at the end of every line it had there, so on
 * the site a bio or write-up breaks off mid-sentence. This joins those lines back into flowing
 * text, for display only: what was typed in the admin is left as it is.
 *
 * - A line break inside a paragraph becomes a space.
 * - A paragraph that stops mid-sentence (no closing punctuation, and either the next one starts
 *   in lowercase or this one ends on a lowercase word or a comma) is joined to the next: one
 *   sentence pasted as several paragraphs. Short headings ("Education") stay as they are.
 * - Empty paragraphs (blank lines between pasted lines) are left out.
 * - A word split at a line end ("illumi-" / "nation") is joined without the hyphen; soft
 *   hyphens are removed. Real paragraphs and headings are kept.
 */

type Node = { type: string; text?: string; children?: Node[]; [key: string]: unknown }

const space = (): Node => ({ type: 'text', text: ' ', detail: 0, format: 0, mode: 'normal', style: '', version: 1 })
const textOf = (n: Node): string => (n.type === 'text' ? (n.text ?? '') : (n.children ?? []).map(textOf).join(''))
const ENDS_SENTENCE = /[.!?:;"”’)\]…]\s*$/
const STARTS_LOWER = /^\s*\p{Ll}/u
// Ends on a lowercase word or a comma ("She graduated from"): a sentence that goes on. A short
// heading ("Education", "Awards") ends on a capitalised word and stays a paragraph.
const MID_SENTENCE = /(\s\p{Ll}[\p{L}'’]*|,)\s*$/u

/** Inside one paragraph: line breaks as spaces, words split at a line end joined again. */
function flowInline(children: Node[]): Node[] {
  const out: Node[] = []
  for (let i = 0; i < children.length; i++) {
    const n = children[i]
    if (n.type === 'linebreak') {
      const prev = out[out.length - 1]
      const next = children[i + 1]
      // "illumi-" + break + "nation": one word.
      if (prev?.type === 'text' && /\p{L}-$/u.test(prev.text ?? '') && next?.type === 'text' && STARTS_LOWER.test(next.text ?? '')) {
        prev.text = (prev.text ?? '').slice(0, -1)
        continue
      }
      if (prev?.type === 'text' && /\s$/.test(prev.text ?? '')) continue
      out.push(space())
      continue
    }
    if (n.type === 'text') {
      const text = (n.text ?? '').replace(/­/g, '').replace(/(\p{L})-\r?\n(\p{Ll})/gu, '$1$2').replace(/\s*\r?\n\s*/g, ' ')
      out.push({ ...n, text })
      continue
    }
    out.push(n.children ? { ...n, children: flowInline(n.children) } : n)
  }
  return out
}

type RichTextData = { root: { children: unknown[]; [key: string]: unknown }; [key: string]: unknown }

export function reflow<T extends RichTextData | null | undefined>(data: T): T {
  if (!data?.root?.children) return data
  const blocks = (data.root.children as Node[]).map((n) =>
    n.type === 'paragraph' && n.children ? { ...n, children: flowInline(n.children) } : n,
  )
  const joined: Node[] = []
  // Empty paragraphs (blank lines a paste leaves between lines) would show as gaps: left out.
  for (const n of blocks.filter((b) => !(b.type === 'paragraph' && !textOf(b).trim() && !(b.children ?? []).some((c) => c.type !== 'text' && c.type !== 'linebreak')))) {
    const prev = joined[joined.length - 1]
    const prevText = prev ? textOf(prev) : ''
    if (prev?.type === 'paragraph' && n.type === 'paragraph' && prevText.trim() && !ENDS_SENTENCE.test(prevText) && (STARTS_LOWER.test(textOf(n)) || MID_SENTENCE.test(prevText))) {
      const split = /\p{L}-\s*$/u.test(prevText)
      const children = [...(prev.children ?? [])]
      const last = children[children.length - 1]
      if (split && last?.type === 'text') children[children.length - 1] = { ...last, text: (last.text ?? '').replace(/-\s*$/, '') }
      joined[joined.length - 1] = { ...prev, children: [...children, ...(split || /\s$/.test(prevText) ? [] : [space()]), ...(n.children ?? [])] }
      continue
    }
    joined.push(n)
  }
  return { ...data, root: { ...data.root, children: joined } } as T
}
