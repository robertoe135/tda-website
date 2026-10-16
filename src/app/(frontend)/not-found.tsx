import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="not-found">
      <h1 className="page-title page-title-large">Page not found</h1>
      <p>
        This page may have moved. See the <Link href="/projects">portfolio</Link>, or go to the{' '}
        <Link href="/">homepage</Link>.
      </p>
    </div>
  )
}
