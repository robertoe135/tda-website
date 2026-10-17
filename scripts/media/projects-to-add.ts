/**
 * Adds what marketing has prepared in "Projects to Add":
 *
 *   pnpm projects:add "/Volumes/T7/Website"                     # check only: what would happen
 *   pnpm projects:add "/Volumes/T7/Website" --write             # create drafts, upload photos
 *     --as "<folder>=<slug>"   this folder is that project on the site (repeatable)
 *     --new "<folder>"         create this folder as a new project although a similar name exists
 *     --update "<folder>"      the project is on the site: update it from this folder's document
 *                              (status and year follow the document, its text replaces the site's,
 *                              other fields are filled only where the site has none)
 *     --publish "<folder>"     publish that existing project once written (new projects stay drafts
 *                              until their categories are chosen)
 *     --confirm-backup         required when DATABASE_URL is not this machine
 *
 * Two kinds of folder:
 *
 *   Projects to Add/Bonhams (ready)/Bonhams.docx + Images/…    a new project: its fields and
 *                                                              text from the document, its photos
 *   Projects to Add/0 - Archive/Holt Renfrew (ready)/…         photos for a project already on
 *                                                              the site that has none
 *
 * A project folder is one with a Word document (.docx); "(ready)" is not required. A folder with
 * photos and no document yet (Cornell CIS Building) becomes a draft named after the folder. A folder
 * holding only folders (like "0 - Archive") holds photos for existing projects; its documents
 * are not read (the site's text wins). Timeline folders are listed, not read.
 *
 * Nothing is overwritten unless asked: an existing project gets photos only if it has none, and
 * its fields change only with --update. New projects and new photos are saved as drafts; publish them in the admin.
 * Names are matched exactly; a close-but-different name is held until --as or --new says what
 * it is. Anything the document leaves unclear goes to scripts/migrate/review.csv.
 */
import '../env'

import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config'
import { toSlug } from '../../src/fields/slug'
import { normalizeName } from '../../src/hooks/preventNearDuplicates'
import type { Project } from '../../src/payload-types'
import { ARCHITECT_ROLES } from '../migrate/credit-labels'
import { parseLocation } from '../migrate/extract'
import { finder, locationFinder, parseArea, parseCertifications, ROLE_NAMES, ROLE_ORDER } from '../migrate/import'
import { type ReviewRow, richText, writeReview } from '../migrate/lib'

import { extOf, isClutter, kindOf } from './inventory-lib'
import { type Candidate, findProjectsToAdd, IGNORED_EXTENSIONS, IMAGE_EXTENSIONS, matchProject, photosRoot, slideOrder } from './lib'
import { docLines, folderProjectName, markedReady, parseProjectDoc, type ProjectDoc } from './project-doc'
import { recordTouched } from './publish'
import { assertSafeTarget, uploadPhoto } from './upload'

// ── reading the folders (disk only) ──────────────────────────────────────────

export type FolderPlan = {
  folder: string // relative to Projects to Add: "Bonhams (ready)", "0 - Archive/FIT (ready)"
  dir: string
  mode: 'new' | 'photos' // a new project from its document, or photos for an existing project
  name: string // from the folder: "Bonhams"
  ready: boolean
  document?: string
  photosDir: string
  photos: string[] // file names in slideshow order
  notes: string[] // what was seen and not read
  problems: string[] // what stops this folder
}

const isDocx = (name: string) => extOf(name) === 'docx' && !name.startsWith('~$') // "~$…" is Word's lock file
const isPhotosFolder = (name: string) => /^(images?|photos?|pictures?)$/i.test(name.trim())

async function list(dir: string) {
  const entries = (await readdir(dir, { withFileTypes: true })).filter((e) => !isClutter(e.name))
  return {
    files: entries.filter((e) => e.isFile()).map((e) => e.name),
    dirs: entries.filter((e) => e.isDirectory()).map((e) => e.name),
  }
}

async function planFolder(base: string, folder: string, mode: FolderPlan['mode']): Promise<FolderPlan> {
  const dir = path.join(base, folder)
  const own = await list(dir)
  const docs = own.files.filter(isDocx)
  const imagesName = own.dirs.find(isPhotosFolder)
  const photosDir = imagesName ? path.join(dir, imagesName) : dir
  const inPhotos = imagesName ? await list(photosDir) : own
  const plan: FolderPlan = {
    folder,
    dir,
    mode,
    name: folderProjectName(path.basename(folder)),
    ready: markedReady(folder),
    document: mode === 'new' && docs.length === 1 ? path.join(dir, docs[0]) : undefined,
    photosDir,
    photos: [],
    notes: [],
    problems: [],
  }
  if (mode === 'new' && docs.length > 1) plan.problems.push(`${docs.length} Word documents; keep one.`)
  const photoFiles = inPhotos.files.filter((f) => IMAGE_EXTENSIONS.has(extOf(f)))
  plan.photos = slideOrder(photoFiles.map((file) => ({ file, slide: Number(file.match(/(\d+)\s*\.[^.]+$/)?.[1]) || undefined }))).map((p) => p.file)
  const needsExport = inPhotos.files.filter((f) => kindOf(f) === 'needs-export')
  if (needsExport.length) plan.notes.push(`${needsExport.length} photo(s) to export as JPEG first (not read).`)
  const psds = inPhotos.files.filter((f) => IGNORED_EXTENSIONS.has(extOf(f)))
  if (psds.length) plan.notes.push(`${psds.length} PSD(s) not read.`)
  const videos = [...own.files, ...(imagesName ? inPhotos.files : [])].filter((f) => kindOf(f) === 'video')
  if (videos.length) plan.notes.push(`${videos.length} video(s) not read: add them under Videos in the admin.`)
  const others = own.files.filter((f) => kindOf(f) === 'document' && !isDocx(f) && !f.startsWith('~$'))
  if (others.length) plan.notes.push(`Not read: ${others.join(', ')}.`)
  const deeper = (imagesName ? inPhotos.dirs : own.dirs.filter((d) => !isPhotosFolder(d)))
  if (deeper.length) plan.notes.push(`Subfolders not read: ${deeper.join(', ')}.`)
  if (!plan.photos.length) plan.notes.push('No photos.')
  return plan
}

/** Every folder in Projects to Add, and the ones that are not projects. */
export async function planProjectsToAdd(base: string): Promise<{ plans: FolderPlan[]; skipped: { folder: string; reason: string }[] }> {
  const plans: FolderPlan[] = []
  const skipped: { folder: string; reason: string }[] = []
  for (const top of (await list(base)).dirs.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
    const { files, dirs } = await list(path.join(base, top))
    if (files.some(isDocx)) plans.push(await planFolder(base, top, 'new'))
    else if (!files.length && dirs.length && !dirs.some(isPhotosFolder)) {
      for (const inner of dirs.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })))
        plans.push(await planFolder(base, path.join(top, inner), 'photos'))
    } else if (/^\s*timeline\b/i.test(top)) skipped.push({ folder: top, reason: 'timeline photos, not a project' })
    else {
      // No write-up yet: the project is created from the folder name with its photos.
      const plan = await planFolder(base, top, 'new')
      if (plan.photos.length) plans.push(plan)
      else skipped.push({ folder: top, reason: 'no Word document and no photos' })
    }
  }
  return { plans, skipped }
}

export async function readProjectDoc(file: string): Promise<ProjectDoc> {
  const mammoth = await import('mammoth')
  const { value } = await mammoth.convertToHtml({ path: file })
  return parseProjectDoc(docLines(value))
}

// ── writing (database) ───────────────────────────────────────────────────────

export type Options = {
  write: boolean
  as: Map<string, string>
  forceNew: Set<string>
  update?: Set<string> // existing projects to update from their document
  publish?: Set<string> // projects to publish once written
  readDoc?: (file: string) => Promise<ProjectDoc> // tests pass the document already parsed
  onWrite?: (projectId: number) => Promise<void> // after each project is saved (media:publish's list)
}
export type Outcome = { folder: string; action: 'create' | 'update' | 'photos' | 'skip' | 'held'; project?: string; detail: string }

const idOf = (ref: unknown) => (ref && typeof ref === 'object' ? (ref as { id: number }).id : (ref as number))
const hasPhotos = (p: Pick<Project, 'heroImage' | 'gallery'>) => Boolean(p.heroImage || p.gallery?.length)

/** Folder names on the command line are matched without "(ready)" and the archive part. */
const optionFor = <T>(map: Map<string, T> | Set<string>, plan: FolderPlan) =>
  map instanceof Set ? map.has(normalizeName(plan.name)) : map.get(normalizeName(plan.name))

export async function addProjects(payload: Payload, plans: FolderPlan[], options: Options) {
  const review: ReviewRow[] = []
  const outcomes: Outcome[] = []
  const findOrCreate = finder(payload)
  const flag = (where: string, field: string, asWritten: string, note: string) =>
    review.push({ url: `Projects to Add/${where}`, field, asWritten, suggested: '', note })
  const locationId = locationFinder(payload, flag)

  const all = await payload.find({ collection: 'projects', draft: true, pagination: false, depth: 0, select: { name: true, slug: true } })
  const candidates: Candidate[] = all.docs.map((p) => ({ slug: p.slug ?? '', name: p.name }))
  const exists = async (collection: 'firms' | 'photographers', name: string) => {
    const key = normalizeName(name)
    const found = await payload.count({
      collection,
      where:
        collection === 'firms'
          ? { or: [{ normalizedName: { equals: key } }, { 'aliases.normalizedName': { equals: key } }] }
          : { normalizedName: { equals: key } },
    })
    return found.totalDocs > 0
  }

  for (const plan of plans) {
    const done = (o: Omit<Outcome, 'folder'>) => outcomes.push({ folder: plan.folder, ...o })
    if (plan.problems.length) {
      done({ action: 'held', detail: plan.problems.join(' ') })
      continue
    }
    const doc = plan.document ? await (options.readDoc ?? readProjectDoc)(plan.document) : undefined
    if (plan.document && !doc?.name) {
      done({ action: 'held', detail: 'The document has no project name on its first line.' })
      continue
    }
    const name = doc?.name || plan.name
    const where = plan.folder
    const publish = Boolean(options.publish && optionFor(options.publish, plan))

    // Which project on the site this folder is, if any.
    const asSlug = optionFor(options.as, plan)
    let target: { slug: string; name: string } | undefined
    if (asSlug) {
      target = candidates.find((c) => c.slug === asSlug)
      if (!target) {
        done({ action: 'held', detail: `--as names "${asSlug}", but no project has that slug.` })
        continue
      }
    } else {
      const match = matchProject(name, candidates) ?? (doc ? matchProject(plan.name, candidates) : undefined)
      if (match?.exact) target = match.candidate
      else if (match && !(plan.mode === 'new' && optionFor(options.forceNew, plan))) {
        const hint =
          plan.mode === 'new'
            ? `If it is that project: --as "${path.basename(plan.folder)}=${match.candidate.slug}". If it is a different one: --new "${path.basename(plan.folder)}".`
            : `If it is that project: --as "${path.basename(plan.folder)}=${match.candidate.slug}".`
        done({ action: 'held', detail: `"${name}" looks like "${match.candidate.name}" on the site, but is not the same name. ${hint}` })
        continue
      } else if (plan.mode === 'photos') {
        done({ action: 'held', detail: `No project on the site is called "${name}". Give its slug: --as "${path.basename(plan.folder)}=<slug>".` })
        continue
      }
    }
    if (doc) for (const n of doc.notes) flag(where, n.field, n.asWritten, n.note)

    if (target) {
      const project = (
        await payload.find({ collection: 'projects', where: { slug: { equals: target.slug } }, draft: true, limit: 1, depth: 0 })
      ).docs[0] as Project
      const update = Boolean(doc && options.update && optionFor(options.update, plan))
      const changes: Record<string, unknown> = {}
      const said: string[] = []

      if (update) {
        const fromDoc = await docData(doc!, where, options.write)
        said.push(...fromDoc.said)
        // The document is the newer account of a finished project: status and year follow it.
        if (fromDoc.year) changes.year = fromDoc.year
        if (fromDoc.status) changes.status = fromDoc.status
        if (fromDoc.status && fromDoc.status !== project.status) said.push(`status ${project.status} → ${fromDoc.status}`)
        // Everything else fills only what the site leaves empty.
        const empty = (v: unknown) => v === null || v === undefined || (Array.isArray(v) && !v.length)
        const filled: string[] = []
        const kept: string[] = []
        for (const field of FILLABLE) {
          if (!fromDoc.has[field]) continue
          if (empty(project[field])) {
            filled.push(field)
            if (fromDoc.data) changes[field] = fromDoc.data[field]
          } else kept.push(field)
        }
        if (filled.length) said.push(`fills ${filled.join(', ')}`)
        for (const field of kept) flag(where, field, '', `The site already has ${field} for ${project.name}; kept it. The document's version is in the Word file.`)
        if (doc!.text.length) {
          said.push(project.description ? 'replaces the text with the document\'s' : 'adds the text')
          if (project.description) flag(where, 'text', project.name, "Text replaced with the document's. The earlier text is under Versions in the admin.")
          if (fromDoc.data) changes.description = fromDoc.data.description
        }
        if (options.write) await linkPress(doc!.press, project.id, where)
        if (doc!.press.length) said.push(`${doc!.press.length} press`)
      } else if (doc && plan.mode === 'new') {
        said.push('already on the site, so the document was not read into it (--update reads it)')
      }
      if (doc && !project.typologies?.length) flag(where, 'categories', project.name, 'Choose its categories (typologies) in the admin before publishing.')

      let photosAdded = false
      if (!hasPhotos(project) && plan.photos.length) {
        const photographers = ((changes.photographers as number[] | undefined) ?? (project.photographers ?? []).map(idOf)) as number[]
        const documentNamesOne = update && doc!.photographers.length > 0
        // No photographer yet: the photos come in anyway; the admin flags it (Still needed).
        if (!photographers.length && !documentNamesOne) said.push('no photographer yet (flagged in the admin)')
        if (options.write) Object.assign(changes, await uploadPhotos(payload, plan, project.slug!, project.name, photographers))
        said.unshift(`${plan.photos.length} photos`)
        photosAdded = true
      } else if (hasPhotos(project) && plan.photos.length) said.push('already has photos, so none added')

      if (publish && !project.typologies?.length) {
        done({ action: 'held', project: project.name, detail: 'Cannot publish without categories (typologies). Choose them in the admin, or drop --publish.' })
        continue
      }
      if (!update && !photosAdded && !publish) {
        done({ action: 'skip', project: project.name, detail: hasPhotos(project) ? 'already on the site with photos; nothing changed.' : 'already on the site; this folder has no photos.' })
        continue
      }
      if (options.write)
        await payload.update({
          collection: 'projects',
          id: project.id,
          draft: !publish,
          data: { ...changes, ...(publish ? { _status: 'published' } : {}) } as never,
        })
      if (options.write) await options.onWrite?.(project.id)
      done({ action: update ? 'update' : 'photos', project: project.name, detail: [...said, publish ? 'published' : 'saved as draft'].join('; ') + '.' })
      continue
    }

    // A new project: from its document, or (no write-up yet) from the folder name and photos.
    if (!plan.ready) flag(where, 'ready', plan.folder, 'Folder is not marked "(ready)"; imported as a draft on request. Check it before publishing.')
    flag(where, 'categories', name, 'New project: choose its categories (typologies) in the admin before publishing.')
    if (!doc) {
      flag(where, 'name', name, 'No write-up: the project was created from the folder name. Set its real name, facts, text and photographer before publishing.')
    } else if (!doc.photographers.length && plan.photos.length) {
      flag(where, 'photographer', name, 'The document names no photographer. Photos imported; add the credit in the admin (Still needed → Photographer).')
    }
    const fromDoc = doc ? await docData(doc, where, options.write) : undefined
    const detail = [`${plan.photos.length} photos`, ...(fromDoc?.said ?? ['no write-up: name from the folder']), plan.ready ? '' : 'not marked (ready)']
      .filter(Boolean)
      .join('; ')
    if (!options.write) {
      done({ action: 'create', project: name, detail })
      continue
    }
    const slugBase = toSlug(name)!
    let slug = slugBase
    for (let n = 2; (await payload.count({ collection: 'projects', where: { slug: { equals: slug } } })).totalDocs; n++) slug = `${slugBase}-${n}`
    const created = await payload.create({
      collection: 'projects',
      draft: true,
      data: { name, slug, status: fromDoc?.status ?? 'completed', year: fromDoc?.year, ...(fromDoc?.data ?? {}) } as never,
    })
    candidates.push({ slug, name })
    if (doc) await linkPress(doc.press, created.id, where)
    if (plan.photos.length) {
      const photos = await uploadPhotos(payload, plan, slug, name, (fromDoc?.data?.photographers as number[] | undefined) ?? [])
      await payload.update({ collection: 'projects', id: created.id, draft: true, data: photos as never })
    }
    await options.onWrite?.(created.id)
    done({ action: 'create', project: name, detail: publish ? `${detail}; not published: a new project needs its categories first` : detail })
  }
  return { outcomes, review }

  /**
   * What the document says, as project fields. Checks and flags in every run; finds or creates
   * firms, roles, photographers and the location only when writing (data is undefined otherwise).
   */
  async function docData(d: ProjectDoc, where: string, write: boolean) {
    const said: string[] = []
    const area = parseArea(d.area)
    if (d.area && !area) flag(where, 'area', d.area, 'Area not in "N SF" form; not imported. Enter it by hand.')
    const certifications = parseCertifications(d.sustainability)
    if (!certifications) flag(where, 'certification', d.sustainability ?? '', 'Not a plain "LEED Gold" style value; not imported. Enter it by hand.')
    const year = d.completed && /^\d{4}$/.test(d.completed.trim()) ? Number(d.completed) : undefined
    if (d.completed && !year) flag(where, 'year', d.completed, 'Not a single year; not imported. Enter it by hand.')
    const status: Project['status'] | undefined = year && year > new Date().getFullYear() ? 'in-progress' : d.completed ? 'completed' : undefined
    if (!d.location) flag(where, 'location', '', 'No location in the document. Set it in the admin.')

    const architectKeys = new Set(d.architects.map(normalizeName))
    const credits = d.credits.filter((c) => c.role !== 'lightingDesign' && !ARCHITECT_ROLES.has(c.role))
    for (const c of d.credits) {
      if (c.role === 'lightingDesign' && !c.values.every((v) => normalizeName(v) === normalizeName('Tillotson Design Associates')))
        flag(where, 'lighting design', c.values.join(' | '), 'Lighting design credit is not "Tillotson Design Associates". Check it.')
      for (const v of c.values.filter((v) => architectKeys.has(normalizeName(v))))
        flag(where, 'credit', `${c.label}: ${v}`, `${v} is also the architect, so it is shown once, as architect. Add the ${c.label} credit by hand if it should show too.`)
    }
    const creditFirms = credits.map((c) => ({ ...c, values: c.values.filter((v) => !architectKeys.has(normalizeName(v))) })).filter((c) => c.values.length)
    const newFirms: string[] = []
    const newPhotographers: string[] = []
    for (const f of new Set([...d.architects, ...creditFirms.flatMap((c) => c.values), ...(d.owner ? [d.owner] : [])]))
      if (!(await exists('firms', f))) newFirms.push(f)
    for (const p of new Set(d.photographers)) if (!(await exists('photographers', p))) newPhotographers.push(p)
    for (const f of newFirms) flag(where, 'firm', f, 'New firm record, named as written in the document. Check the spelling, or merge it with an existing firm.')
    for (const p of newPhotographers) flag(where, 'photographer', p, 'New photographer, named as written in the document. Check the spelling.')
    said.push(`${d.press.length} press`)
    if (newFirms.length) said.push(`new firms: ${newFirms.join(', ')}`)
    if (newPhotographers.length) said.push(`new photographers: ${newPhotographers.join(', ')}`)

    const has: Record<(typeof FILLABLE)[number], boolean> = {
      location: Boolean(d.location && parseLocation(d.location).city),
      areaSqFt: Boolean(area),
      certifications: Boolean(certifications?.length),
      architects: d.architects.length > 0,
      credits: creditFirms.length > 0,
      clients: Boolean(d.owner),
      photographers: d.photographers.length > 0,
    }
    if (!write) return { said, status, year, has, data: undefined }

    const creditRows: { role: number; firms: number[] }[] = []
    for (const c of creditFirms) {
      const role = await findOrCreate('creditRoles', ROLE_NAMES[c.role] ?? c.label, { order: ROLE_ORDER[c.role] ?? 50 })
      const firms = await Promise.all(c.values.map((v) => findOrCreate('firms', v)))
      const row = creditRows.find((r) => r.role === role)
      if (row) row.firms = [...new Set([...row.firms, ...firms])]
      else creditRows.push({ role, firms: [...new Set(firms)] })
    }
    const data: Record<string, unknown> = {
      location: d.location ? await locationId(parseLocation(d.location), where) : undefined,
      areaSqFt: area?.areaSqFt,
      areaNote: area?.areaNote,
      certifications: certifications ?? [],
      architects: [...new Set(await Promise.all(d.architects.map((f) => findOrCreate('firms', f))))],
      credits: creditRows,
      clients: d.owner ? [await findOrCreate('firms', d.owner)] : [],
      photographers: [...new Set(await Promise.all(d.photographers.map((p) => findOrCreate('photographers', p))))],
      description: d.text.length ? richText(d.text) : undefined,
    }
    return { said, status, year, has, data }
  }

  async function linkPress(press: ProjectDoc['press'], projectId: number, where: string) {
    for (const item of press) {
      const found = (await payload.find({ collection: 'press', where: { url: { equals: item.url } }, limit: 1, depth: 0 })).docs[0]
      if (found) {
        const linked = (found.projects ?? []).map(idOf)
        if (!linked.includes(projectId)) await payload.update({ collection: 'press', id: found.id, data: { projects: [...linked, projectId] } })
        continue
      }
      try {
        await payload.create({ collection: 'press', data: { title: item.title, outlet: item.outlet, url: item.url!, projects: [projectId] } })
      } catch (error) {
        flag(where, 'press', item.title, `Not imported: ${(error as Error).message}`)
      }
    }
  }
}

/** Fields --update fills from the document when the site leaves them empty. */
const FILLABLE = ['location', 'areaSqFt', 'certifications', 'architects', 'credits', 'clients', 'photographers'] as const

/** Uploads the folder's photos; the first is the hero. Returns the project fields to save. */
async function uploadPhotos(payload: Payload, plan: FolderPlan, slug: string, name: string, photographers: number[]) {
  const ids: number[] = []
  for (const [i, file] of plan.photos.entries()) {
    const original = await readFile(path.join(plan.photosDir, file))
    const media = await uploadPhoto(payload, slug, original, {
      alt: `${name}, photograph ${i + 1}`,
      photographer: photographers.length === 1 ? photographers[0] : undefined,
    })
    ids.push(media.id)
    process.stdout.write(`\r  ${name}: ${i + 1}/${plan.photos.length} photos`)
  }
  process.stdout.write('\n')
  return { heroImage: ids[0], gallery: ids.slice(1).map((image) => ({ image })) }
}

// ── command ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const values = (flag: string) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]] : []))
  const given = args.find((a, i) => !a.startsWith('--') && !['--as', '--new', '--update', '--publish'].includes(args[i - 1]))
  const write = args.includes('--write')
  if (!given) {
    console.error('Usage: pnpm projects:add "/Volumes/T7/Website" [--write] [--as "<folder>=<slug>"] [--new "<folder>"] [--update "<folder>"] [--publish "<folder>"] [--confirm-backup]')
    process.exit(1)
  }
  const as = new Map<string, string>()
  for (const v of values('--as')) {
    const at = v.lastIndexOf('=')
    if (at < 1) {
      console.error(`--as "${v}": write it as "<folder>=<slug>".`)
      process.exit(1)
    }
    as.set(normalizeName(folderProjectName(v.slice(0, at))), v.slice(at + 1).trim())
  }
  const names = (flag: string) => new Set(values(flag).map((v) => normalizeName(folderProjectName(v))))
  const forceNew = names('--new')
  const update = names('--update')
  const publish = names('--publish')
  if (write) assertSafeTarget(args.includes('--confirm-backup'))

  const [base] = await findProjectsToAdd(given, await photosRoot(given).catch(() => given))
  if (!base) {
    console.error(`No "Projects to Add" folder in ${given}.`)
    process.exit(1)
  }
  const { plans, skipped } = await planProjectsToAdd(base)
  const payload = await getPayload({ config })
  const { outcomes, review } = await addProjects(payload, plans, { write, as, forceNew, update, publish, onWrite: (id) => recordTouched(id) })

  const label = { create: write ? 'Created' : 'New', update: write ? 'Updated' : 'Update', photos: 'Photos', skip: 'Skipped', held: 'Held' } as const
  for (const action of ['create', 'update', 'photos', 'skip', 'held'] as const) {
    const rows = outcomes.filter((o) => o.action === action)
    if (!rows.length) continue
    console.log(`\n${label[action]} (${rows.length})`)
    for (const o of rows) console.log(`  ${o.folder}${o.project ? ` → ${o.project}` : ''}: ${o.detail}`)
  }
  for (const s of skipped) console.log(`\nNot read: ${s.folder} (${s.reason})`)
  const notes = plans.filter((p) => p.notes.length)
  if (notes.length) {
    console.log('\nSeen and not read')
    for (const p of notes) console.log(`  ${p.folder}: ${p.notes.join(' ')}`)
  }
  const total = await writeReview('projects-to-add', review)
  console.log(`\n${review.length} rows for marketing in scripts/migrate/review.csv (now ${total}).`)
  console.log(write ? 'Saved as drafts: publish them in the admin, or all at once with pnpm media:publish.' : 'Nothing was written. Rerun with --write.')
  process.exit(0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
