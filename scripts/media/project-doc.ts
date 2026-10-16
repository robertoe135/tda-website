/**
 * Reads marketing's new-project document (the .docx in each "Projects to Add" folder) into
 * fields. Pure: takes the document as HTML (mammoth's conversion keeps paragraphs and links)
 * and changes nothing as written. The layout marketing uses:
 *
 *   Bonhams Auction House
 *   Location: New York, NY
 *   Project Completed: 2025
 *   Area: 42,000 SF
 *   Architecture Company: Gensler
 *   Interior Design Company: Gensler
 *   Owner: Bonhams Auction House
 *   Photography: Colin Miller, courtesy Bonhams
 *   Press:
 *   <article title - Outlet>          (a link, or followed by its web address)
 *   Text:
 *   <paragraphs, copied as they are>
 *
 * Anything that does not fit (an unknown label, press with no link, a "courtesy" credit)
 * is returned as a note for the review file, never guessed.
 */
import { parse } from 'node-html-parser'

import { normalizeName } from '../../src/hooks/preventNearDuplicates'
import { ARCHITECT_ROLES, FIRM_ROLES, type Role, roleFor } from '../migrate/credit-labels'

export type DocLine = { text: string; links: string[] }
export type DocPress = { title: string; outlet?: string; url?: string }
export type DocCredit = { label: string; role: Role; values: string[] }
export type DocNote = { field: string; asWritten: string; note: string }

export type ProjectDoc = {
  name: string
  location?: string
  completed?: string
  area?: string
  sustainability?: string
  owner?: string
  architects: string[]
  credits: DocCredit[] // other firms by role, not architects
  photographers: string[]
  press: DocPress[]
  text: string[]
  notes: DocNote[]
}

const SECTION: Record<string, 'press' | 'text'> = {
  press: 'press',
  'press links': 'press',
  publications: 'press',
  text: 'text',
  description: 'text',
  'project description': 'text',
}

/** Paragraphs (and list items, headings) with the links inside them. */
export function docLines(html: string): DocLine[] {
  const root = parse(html)
  return root
    .querySelectorAll('p, li, h1, h2, h3, h4, h5, h6')
    .filter((el) => !el.querySelector('p, li')) // a list item holding paragraphs: read the paragraphs
    .map((el) => ({
      text: el.text.replace(/ /g, ' ').replace(/\s+/g, ' ').trim(),
      links: el.querySelectorAll('a').map((a) => a.getAttribute('href') ?? '').filter((h) => /^https?:\/\//i.test(h)),
    }))
    .filter((l) => l.text || l.links.length)
}

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim())
const labelOf = (label: string) => label.trim().toLowerCase().replace(/\s+/g, ' ')
const known = (label: string) => roleFor(label) !== 'unmapped' || labelOf(label) in SECTION

/** "Bonhams Auction House Location: New York, NY" (two lines run together) → name and rest. */
function splitRunTogether(line: string): [string, string | undefined] {
  const named = line.match(/^(?:project\s+)?name:\s*(.+)$/i) // "Project Name: Bonhams"
  if (named) return [named[1].trim(), undefined]
  const words = line.split(' ')
  for (let i = 1; i < words.length; i++) {
    const rest = words.slice(i).join(' ')
    const m = rest.match(/^([^:]{2,60}):/)
    if (m && known(m[1])) return [words.slice(0, i).join(' ').trim(), rest]
  }
  return [line, undefined]
}

/** People in a photography credit; "courtesy X" is a credit line, not a photographer. */
function photographyNames(value: string, notes: DocNote[]): string[] {
  const parts = value.split(/\s*[,;/]\s*|\s+and\s+/).map((p) => p.trim()).filter(Boolean)
  const courtesy = parts.filter((p) => /^(courtesy|©|\(c\))/i.test(p))
  if (courtesy.length) {
    notes.push({
      field: 'photography',
      asWritten: value,
      note: `"${courtesy.join(', ')}" is not a photographer, so it was left out. If the credit must read "courtesy …", add it to the project page by hand.`,
    })
  }
  return parts.filter((p) => !courtesy.includes(p))
}

/** "Title - Outlet", "Title | Outlet", "Title – Outlet": the outlet is the part after the last separator. */
export function splitPressTitle(line: string): { title: string; outlet?: string } {
  const m = line.match(/^(.+)\s+[-–—|]\s+([^-–—|]+)$/)
  return m ? { title: m[1].trim(), outlet: m[2].trim() } : { title: line.trim() }
}

function readPress(lines: DocLine[], notes: DocNote[]): DocPress[] {
  const items: DocPress[] = []
  for (const line of lines) {
    if (isUrl(line.text)) {
      // A web address on its own line: marketing sometimes pastes the link under its title,
      // but the address can be for a different article (a press release), so it is not paired.
      notes.push({ field: 'press', asWritten: line.text, note: 'Web address with no article title; not imported. Add it in Press with its title if it belongs.' })
      continue
    }
    const { title, outlet } = splitPressTitle(line.text)
    items.push({ title, outlet, url: line.links[0] })
  }
  // The same article listed twice: keep one, the one with a link if either has it.
  const merged: DocPress[] = []
  for (const item of items) {
    const same = merged.find((m) => normalizeName(m.title) === normalizeName(item.title) && (!m.url || !item.url || m.url === item.url))
    if (!same) merged.push(item)
    else if (!same.url && item.url) same.url = item.url
  }
  for (const item of merged.filter((m) => !m.url)) {
    notes.push({
      field: 'press',
      asWritten: [item.title, item.outlet].filter(Boolean).join(' - '),
      note: 'Press item has no web link in the document; not imported. Add it in Press with its link.',
    })
  }
  return merged.filter((m) => m.url)
}

export function parseProjectDoc(lines: DocLine[]): ProjectDoc {
  const notes: DocNote[] = []
  const doc: ProjectDoc = { name: '', architects: [], credits: [], photographers: [], press: [], text: [], notes }
  const queue = [...lines]
  const first = queue.shift()
  if (!first) return doc
  const [name, rest] = splitRunTogether(first.text)
  doc.name = name
  if (rest) queue.unshift({ text: rest, links: [] })

  let section: 'press' | 'text' | undefined
  const pressLines: DocLine[] = []
  for (const line of queue) {
    // Text runs to the end of the document, copied as written (a colon inside a paragraph is
    // not a label there).
    if (section === 'text') {
      doc.text.push(line.text)
      continue
    }
    const m = line.text.match(/^([^:]{2,60}):\s*(.*)$/)
    const label = m && known(m[1]) ? m[1] : undefined
    if (!label) {
      if (section === 'press') pressLines.push(line)
      else if (m) notes.push({ field: m[1].trim(), asWritten: m[2].trim(), note: 'Label not imported by this script; enter it by hand if it belongs on the site.' })
      else notes.push({ field: 'document', asWritten: line.text, note: 'Line without a known label; not imported.' })
      continue
    }
    const value = m![2].trim()
    const sectionName = SECTION[labelOf(label)]
    if (sectionName) {
      section = sectionName
      if (value && section === 'text') doc.text.push(value)
      else if (value) pressLines.push({ text: value, links: line.links })
      continue
    }
    section = undefined
    if (!value) continue
    const role = roleFor(label)
    if (role === 'location') doc.location = value
    else if (role === 'completed') doc.completed = value
    else if (role === 'area') doc.area = value
    else if (role === 'sustainabilityStatus') doc.sustainability = value
    else if (role === 'owner') doc.owner = value
    else if (role === 'photography') doc.photographers.push(...photographyNames(value, notes))
    else if (FIRM_ROLES.has(role)) {
      const values = value.split('|').map((v) => v.trim()).filter(Boolean) // "REX | Rockwell Group" is two firms
      if (ARCHITECT_ROLES.has(role)) doc.architects.push(...values)
      else doc.credits.push({ label: label.trim(), role, values })
    } else notes.push({ field: label.trim(), asWritten: value, note: 'Label not imported by this script; enter it by hand if it belongs on the site.' })
  }
  doc.press = readPress(pressLines, notes)
  if (!doc.text.length) notes.push({ field: 'text', asWritten: '', note: 'No project text in the document.' })
  return doc
}

/** The project name from a folder: "Bonhams (ready)" → "Bonhams", "3. FIT" → "FIT". */
export const folderProjectName = (folder: string) =>
  folder
    .replace(/\((?:ready|done|final)\)/gi, '')
    .replace(/^\s*\d+\s*[.)-]\s*/, '')
    .trim()

export const markedReady = (folder: string) => /\(ready\)/i.test(folder)
