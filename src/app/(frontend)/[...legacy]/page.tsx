import { notFound, permanentRedirect } from 'next/navigation'

import { resolveLegacyPath } from '@/lib/legacy'

type Props = { params: Promise<{ legacy: string[] }> }

/** Any address no other page claims: an old Squarespace address redirects, anything else 404s. */
export default async function LegacyRedirect({ params }: Props) {
  const segments = (await params).legacy
  const target = await resolveLegacyPath(`/${segments.map((s) => decodeURIComponent(s)).join('/')}`)
  if (target) permanentRedirect(target)
  notFound()
}
