import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { YearOfLight } from '@/components/YearOfLight'
import { getPayloadClient } from '@/lib/projects'
import { describeStory, getStory } from '@/lib/year-of-light'
import '../year-of-light.css'

type Props = {
  params: Promise<{ year: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const toYear = (raw: string) => (/^\d{4}$/.test(raw) ? Number(raw) : undefined)

/** A logged-in editor's live preview (?preview=1) shows the latest draft. */
async function previewUser(params: Record<string, string | string[] | undefined>) {
  if (!params.preview) return undefined
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  return user && user.collection === 'users' ? { user } : undefined
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const year = toYear((await params).year)
  const story = year ? await getStory(year) : undefined
  if (!story) return {}
  const title = `Year of Light ${story.year}`
  const description = describeStory(story.year, story.cards)
  return {
    title: `${title} — Tillotson Design Associates`,
    description,
    alternates: { canonical: `/year-of-light/${story.year}` },
    openGraph: {
      title,
      description,
      type: 'article',
      ...(story.share ? { images: [{ url: story.share.src, alt: story.share.alt }] } : {}),
    },
  }
}

/** Year of Light: the year in review as a scroll story (lib/year-of-light.ts, docs/year-of-light.md). */
export default async function YearOfLightPage({ params, searchParams }: Props) {
  const year = toYear((await params).year)
  if (!year) notFound()
  const preview = await previewUser(await searchParams)
  const story = await getStory(year, preview)
  if (!story) notFound()
  return <YearOfLight cards={story.cards} preview={Boolean(preview)} />
}
