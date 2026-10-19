import { notFound, redirect } from 'next/navigation'

import { getStoryYears } from '@/lib/year-of-light'

/** /year-of-light: the latest published year. */
export default async function LatestYearOfLight() {
  const [latest] = await getStoryYears()
  if (!latest) notFound()
  redirect(`/year-of-light/${latest}`)
}
