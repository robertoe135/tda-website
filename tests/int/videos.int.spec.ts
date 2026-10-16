import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { getPayload, Payload } from 'payload'
import sharp from 'sharp'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { checkVideoSize, MAX_VIDEO_MB } from '@/collections/Videos'

let payload: Payload
const created: { collection: 'media' | 'videos'; id: number }[] = []

const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  for (const { collection, id } of created.reverse()) await payload.delete({ collection, id }).catch(() => {})
})

describe('videos', () => {
  it.skipIf(!hasFfmpeg)('stores a short MP4 with its still image', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'tda-video-'))
    const file = path.join(dir, 'loop.mp4')
    execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=gray:s=320x180:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', file])
    const data = readFileSync(file)
    const still = await sharp({ create: { width: 320, height: 180, channels: 3, background: '#777' } }).jpeg().toBuffer()
    const poster = await payload.create({
      collection: 'media',
      data: { alt: 'Still for a test loop', credit: 'Test' },
      file: { data: still, mimetype: 'image/jpeg', name: 'still.jpg', size: still.length },
    })
    created.push({ collection: 'media', id: poster.id })

    await expect(
      payload.create({ collection: 'videos', data: { alt: 'No still' } as never, file: { data, mimetype: 'video/mp4', name: 'loop.mp4', size: data.length } }),
    ).rejects.toThrow()

    const video = await payload.create({
      collection: 'videos',
      data: { alt: 'Test loop', poster: poster.id },
      file: { data, mimetype: 'video/mp4', name: 'loop.mp4', size: data.length },
    })
    created.push({ collection: 'videos', id: video.id })
    expect(video.mimeType).toBe('video/mp4')
    expect(video.url).toBeTruthy()
  })

  it('refuses images in the video library', async () => {
    const still = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#777' } }).jpeg().toBuffer()
    await expect(
      payload.create({ collection: 'videos', data: { alt: 'x', poster: 1 } as never, file: { data: still, mimetype: 'image/jpeg', name: 'x.jpg', size: still.length } }),
    ).rejects.toThrow()
  })

  it(`refuses videos over ${MAX_VIDEO_MB} MB`, () => {
    const call = (filesize: number, extra: Record<string, unknown> = { operation: 'create' }) =>
      (checkVideoSize as (args: unknown) => unknown)({ data: { filesize }, ...extra })
    let message = ''
    try {
      call(MAX_VIDEO_MB * 1024 * 1024 + 1)
    } catch (e) {
      message = (e as { data?: { errors?: { message: string }[] } }).data?.errors?.[0]?.message ?? ''
    }
    expect(message).toMatch(/under 15 MB/)
    expect(call(5 * 1024 * 1024)).toEqual({ filesize: 5 * 1024 * 1024 })
    // A video uploaded under the old 40 MB limit can still have its description edited.
    const big = 30 * 1024 * 1024
    expect(call(big, { operation: 'update', originalDoc: { filename: 'loop.mp4' } })).toEqual({ filesize: big })
  })
})

describe('photo addresses', () => {
  it('points at the public Blob store named by the token, or at Payload locally', async () => {
    const { blobFileURL } = await import('@/lib/blob')
    expect(blobFileURL('tda-1 a.jpg', 'vercel_blob_rw_AbC123_secretpart')).toBe('https://abc123.public.blob.vercel-storage.com/tda-1%20a.jpg')
    expect(blobFileURL('tda-1.jpg', '')).toBe('/api/media/file/tda-1.jpg')
  })
})
