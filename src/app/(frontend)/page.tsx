import Link from 'next/link'

// Placeholder until the real homepage (featured projects) is built.
export default function HomePage() {
  return (
    <>
      <h1>Tillotson Design Associates</h1>
      <p>
        <Link href="/projects?status=featured">Featured projects</Link>
      </p>
    </>
  )
}
