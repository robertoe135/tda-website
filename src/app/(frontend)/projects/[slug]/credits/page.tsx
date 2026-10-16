import { permanentRedirect } from 'next/navigation'

type Props = { params: Promise<{ slug: string }> }

// Project credits now live on the project page under "Project Info".
export default async function CreditsRedirect({ params }: Props) {
  permanentRedirect(`/projects/${(await params).slug}`)
}
