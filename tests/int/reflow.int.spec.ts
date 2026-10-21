import { describe, expect, it } from 'vitest'

import { reflow } from '@/lib/reflow'

const t = (text: string) => ({ type: 'text', text, detail: 0, format: 0, mode: 'normal', style: '', version: 1 })
const br = { type: 'linebreak', version: 1 }
const p = (...children: object[]) => ({ type: 'paragraph', children, direction: 'ltr', format: '', indent: 0, version: 1 })
const doc = (...children: object[]) => ({ root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 } })
const texts = (d: ReturnType<typeof doc>) =>
  (d.root.children as { children: { text?: string }[] }[]).map((n) => n.children.map((c) => c.text ?? '').join(''))

describe('pasted text flows again', () => {
  it('turns line breaks inside a paragraph into spaces', () => {
    expect(texts(reflow(doc(p(t('She founded the studio'), br, t('in 2004 with twenty years'), br, t('of experience.')))))).toEqual([
      'She founded the studio in 2004 with twenty years of experience.',
    ])
  })

  it('joins one sentence pasted as several paragraphs, and drops blank ones, but keeps real paragraphs', () => {
    const out = reflow(
      doc(p(t('She graduated from')), p(t('')), p(t('Louisiana State University.')), p(t('Her work has won awards')), p(t('around the world.')), p(t('Education')), p(t('Bachelor of Interior Design.'))),
    )
    expect(texts(out)).toEqual([
      'She graduated from Louisiana State University.',
      'Her work has won awards around the world.',
      'Education',
      'Bachelor of Interior Design.',
    ])
  })

  it('mends words split at a line end and removes soft hyphens, without hyphenating anything', () => {
    expect(texts(reflow(doc(p(t('a lighting illumi-'), br, t('nation study'), br, t('in­stallation')))))).toEqual(['a lighting illumination study installation'])
  })

  it('leaves well-formed text and empty fields alone', () => {
    const fine = doc(p(t('One.')), p(t('Two.')))
    expect(reflow(fine)).toEqual(fine)
    expect(reflow(null)).toBeNull()
  })
})
