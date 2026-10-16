import { mkdir, mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

import { getPayload, Payload } from 'payload'
import sharp from 'sharp'
import config from '@/payload.config'
import { normalizeName } from '@/hooks/preventNearDuplicates'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { docLines, folderProjectName, parseProjectDoc, splitPressTitle } from '../../scripts/media/project-doc'
import { addProjects, planProjectsToAdd } from '../../scripts/media/projects-to-add'

// Marketing's Bonhams document, as mammoth turns it into HTML. Two press titles carry links;
// one address sits on its own line; the Galerie title is listed twice.
const BONHAMS = `
<p>Bonhams Auction House Location: New York, NY</p>
<p>Project Completed: 2025</p>
<p>Area: 42,000 SF</p>
<p>Architecture Company: Gensler</p>
<p>Interior Design Company: Gensler</p>
<p>Owner: Bonhams Auction House</p>
<p>Photography: Colin Miller, courtesy Bonhams</p>
<p>Press:</p>
<p><a href="https://galeriemagazine.com/bonhams-steinway-hall/">Bonhams Relocates to New York's Historic Steinway Hall - Galerie Magazine</a></p>
<p>https://www.bonhams.com/press_release/40727/</p>
<p>Bonhams Opens in a Landmarked Steinway Space on 57th Street</p>
<p><a href="https://www.wallpaper.com/architecture/bonhams-steinway-hall">Steinway Hall sparkles anew as the new US headquarters for Bonhams | Wallpaper*</a></p>
<p>Bonhams Relocates to New York's Historic Steinway Hall - Galerie Magazine</p>
<p>Text:</p>
<p>This project transforms the historic rotunda.</p>
<p>Lighting: a second paragraph with a colon, copied as it is.</p>
`

describe("marketing's new-project document", () => {
  const doc = parseProjectDoc(docLines(BONHAMS))

  it('reads the fields as written', () => {
    expect(doc).toMatchObject({
      name: 'Bonhams Auction House',
      location: 'New York, NY',
      completed: '2025',
      area: '42,000 SF',
      owner: 'Bonhams Auction House',
      architects: ['Gensler'],
      credits: [{ label: 'Interior Design Company', role: 'interiorDesigner', values: ['Gensler'] }],
      photographers: ['Colin Miller'],
    })
  })

  it('copies the text verbatim, colons included', () => {
    expect(doc.text).toEqual(['This project transforms the historic rotunda.', 'Lighting: a second paragraph with a colon, copied as it is.'])
  })

  it('keeps linked press once, and sends the rest to review instead of guessing', () => {
    expect(doc.press).toEqual([
      { title: "Bonhams Relocates to New York's Historic Steinway Hall", outlet: 'Galerie Magazine', url: 'https://galeriemagazine.com/bonhams-steinway-hall/' },
      { title: 'Steinway Hall sparkles anew as the new US headquarters for Bonhams', outlet: 'Wallpaper*', url: 'https://www.wallpaper.com/architecture/bonhams-steinway-hall' },
    ])
    const notes = doc.notes.map((n) => `${n.field}: ${n.asWritten}`)
    expect(notes).toContain('press: https://www.bonhams.com/press_release/40727/')
    expect(notes).toContain('press: Bonhams Opens in a Landmarked Steinway Space on 57th Street')
    expect(notes).toContain('photography: Colin Miller, courtesy Bonhams')
  })

  it('reads names from folder names and press titles without changing them', () => {
    expect(folderProjectName('Bonhams (ready)')).toBe('Bonhams')
    expect(folderProjectName('3. FIT (Ready)')).toBe('FIT')
    expect(splitPressTitle('Lighting the Shed – Architect Magazine')).toEqual({ title: 'Lighting the Shed', outlet: 'Architect Magazine' })
    expect(splitPressTitle('Bonhams-Steinway, a review')).toEqual({ title: 'Bonhams-Steinway, a review' })
  })

  it('flags lines it does not understand', () => {
    const odd = parseProjectDoc(docLines('<p>Some Project</p><p>Budget: 4M</p><p>stray line</p>'))
    expect(odd.notes.map((n) => n.field)).toEqual(['Budget', 'document', 'text'])
  })
})

describe('pnpm projects:add', () => {
  let payload: Payload
  let base: string
  const prefix = `zz-add-${Date.now()}`
  const photo = (shade: string) => sharp({ create: { width: 40, height: 30, channels: 3, background: shade } }).jpeg().toBuffer()

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    base = await mkdtemp(path.join(tmpdir(), 'projects-to-add-'))
    const folder = (rel: string) => mkdir(path.join(base, rel), { recursive: true })
    await folder(`${prefix} Quixotic Harborfront Pavilion (ready)/Images`)
    await writeFile(path.join(base, `${prefix} Quixotic Harborfront Pavilion (ready)/Gallery.docx`), 'parsed by the test')
    await writeFile(path.join(base, `${prefix} Quixotic Harborfront Pavilion (ready)/~$Gallery.docx`), 'Word lock file')
    await writeFile(path.join(base, `${prefix} Quixotic Harborfront Pavilion (ready)/Images/G_02.jpg`), await photo('#222'))
    await writeFile(path.join(base, `${prefix} Quixotic Harborfront Pavilion (ready)/Images/G_01.jpg`), await photo('#333'))
    await writeFile(path.join(base, `${prefix} Quixotic Harborfront Pavilion (ready)/Images/G_03.psd`), 'layers')
    await folder(`0 - Archive/${prefix} Bare Museum (ready)`)
    await writeFile(path.join(base, `0 - Archive/${prefix} Bare Museum (ready)/M_1.jpg`), await photo('#444'))
    await folder(`0 - Archive/${prefix} Old Spelling Musem (ready)`)
    await writeFile(path.join(base, `0 - Archive/${prefix} Old Spelling Musem (ready)/S_1.jpg`), await photo('#555'))
    await folder('Timeline 2025')
    await writeFile(path.join(base, 'Timeline 2025/t.jpg'), await photo('#666'))

    const photographer = await payload.create({ collection: 'photographers', data: { name: `${prefix} Existing Photographer` } })
    await payload.create({ collection: 'projects', draft: true, data: { name: `${prefix} Bare Museum`, status: 'completed', photographers: [photographer.id] } })
    await payload.create({ collection: 'projects', draft: true, data: { name: `${prefix} Old Spelling Museum`, status: 'completed', photographers: [photographer.id] } })
  })

  afterAll(async () => {
    const projects = await payload.find({ collection: 'projects', where: { name: { like: prefix } }, draft: true, pagination: false, depth: 0 })
    const media = projects.docs.flatMap((p) => [p.heroImage, ...(p.gallery ?? []).map((g) => g.image)]).filter(Boolean)
    await payload.delete({ collection: 'projects', where: { name: { like: prefix } } })
    for (const m of media) await payload.delete({ collection: 'media', id: typeof m === 'object' ? m!.id : m! })
    await payload.delete({ collection: 'press', where: { title: { like: prefix } } })
    await payload.delete({ collection: 'firms', where: { name: { like: prefix } } })
    await payload.delete({ collection: 'photographers', where: { name: { like: prefix } } })
    await payload.delete({ collection: 'locations', where: { city: { like: prefix } } })
  })

  const readDoc = async () =>
    parseProjectDoc(
      docLines(`
        <p>${prefix} Quixotic Harborfront Pavilion</p>
        <p>Location: ${prefix}ville, NY</p>
        <p>Project Completed: 2024</p>
        <p>Area: 9,000 SF</p>
        <p>Architecture Company: ${prefix} Architects</p>
        <p>Owner: ${prefix} Owner</p>
        <p>Photography: ${prefix} New Photographer</p>
        <p>Press:</p>
        <p><a href="https://example.com/${prefix}">${prefix} Review - Example Journal</a></p>
        <p>Text:</p><p>As written.</p>`),
    )

  it('reads project folders and archive folders, and leaves the rest', async () => {
    const { plans, skipped } = await planProjectsToAdd(base)
    expect(plans.map((p) => [p.folder, p.mode])).toEqual([
      [`0 - Archive/${prefix} Bare Museum (ready)`, 'photos'],
      [`0 - Archive/${prefix} Old Spelling Musem (ready)`, 'photos'],
      [`${prefix} Quixotic Harborfront Pavilion (ready)`, 'new'],
    ])
    const gallery = plans.find((p) => p.mode === 'new')!
    expect(gallery.document).toMatch(/\/Gallery\.docx$/)
    expect(gallery.photos).toEqual(['G_01.jpg', 'G_02.jpg'])
    expect(gallery.notes.join(' ')).toMatch(/1 PSD/)
    expect(skipped).toEqual([{ folder: 'Timeline 2025', reason: 'no Word document, so not a new project' }])
  })

  it('writes nothing on a check, and holds a name that is close but not the same', async () => {
    const { plans } = await planProjectsToAdd(base)
    const { outcomes } = await addProjects(payload, plans, { write: false, as: new Map(), forceNew: new Set(), readDoc })
    expect(outcomes.map((o) => o.action)).toEqual(['photos', 'held', 'create'])
    expect(outcomes[1].detail).toMatch(/--as/)
    expect((await payload.count({ collection: 'projects', where: { name: { equals: `${prefix} Quixotic Harborfront Pavilion` } } })).totalDocs).toBe(0)
    expect((await payload.count({ collection: 'firms', where: { name: { like: prefix } } })).totalDocs).toBe(0)
  })

  it('creates the new project as a draft with its photos, and adds photos to the existing one', async () => {
    const { plans } = await planProjectsToAdd(base)
    const { outcomes, review } = await addProjects(payload, plans, { write: true, as: new Map(), forceNew: new Set(), readDoc })
    expect(outcomes.map((o) => o.action)).toEqual(['photos', 'held', 'create'])

    const created = (await payload.find({ collection: 'projects', where: { name: { equals: `${prefix} Quixotic Harborfront Pavilion` } }, draft: true, depth: 1 })).docs[0]
    expect(created).toMatchObject({ _status: 'draft', status: 'completed', year: 2024, areaSqFt: 9000 })
    expect(created.architects?.map((a) => (typeof a === 'object' ? a.name : a))).toEqual([`${prefix} Architects`])
    expect(created.clients?.map((a) => (typeof a === 'object' ? a.name : a))).toEqual([`${prefix} Owner`])
    expect(created.heroImage).toBeTruthy()
    expect(created.gallery).toHaveLength(1)
    const press = await payload.find({ collection: 'press', where: { url: { equals: `https://example.com/${prefix}` } }, depth: 0 })
    expect(press.docs[0]).toMatchObject({ title: `${prefix} Review`, outlet: 'Example Journal', projects: [created.id] })
    expect(review.map((r) => r.field)).toEqual(expect.arrayContaining(['categories', 'firm', 'photographer']))

    const bare = (await payload.find({ collection: 'projects', where: { name: { equals: `${prefix} Bare Museum` } }, draft: true, depth: 0 })).docs[0]
    expect(bare.heroImage).toBeTruthy()

    // Run again: everything is there, nothing is added twice.
    const again = await addProjects(payload, plans, { write: true, as: new Map(), forceNew: new Set(), readDoc })
    expect(again.outcomes.map((o) => o.action)).toEqual(['skip', 'held', 'skip'])
  })

  it('takes --as for a folder spelled differently from the project', async () => {
    const { plans } = await planProjectsToAdd(base)
    const held = plans.filter((p) => p.name.endsWith('Musem'))
    const old = (await payload.find({ collection: 'projects', where: { name: { equals: `${prefix} Old Spelling Museum` } }, draft: true, depth: 0 })).docs[0]
    const as = new Map([[normalizeName(held[0].name), old.slug!]])
    const { outcomes } = await addProjects(payload, held, { write: true, as, forceNew: new Set(), readDoc })
    expect(outcomes[0]).toMatchObject({ action: 'photos', project: `${prefix} Old Spelling Museum` })
  })
})
