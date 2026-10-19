import { type NextRequest, NextResponse } from 'next/server'

/**
 * A password on the whole public site until launch. On while SITE_PASSWORD is set (in Vercel:
 * Settings > Environment Variables, for Production and Preview); delete it and redeploy to open
 * the site. The admin (/admin, /api) keeps its own login and is never behind this.
 *
 * Someone without the cookie sees the password page at the address they asked for; the right
 * password sets a cookie for 30 days and sends them on. The cookie holds a hash, not the
 * password, and changing the password signs everyone out.
 */
export const GATE_COOKIE = 'tda-preview'
const DAYS = 30

export async function gateToken(password: string, secret = process.env.PAYLOAD_SECRET ?? '') {
  const bytes = new TextEncoder().encode(`tda-site-gate:${password}:${secret}`)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Only a path on this site, so the form can't be used to send people elsewhere. */
const safeNext = (next: unknown) =>
  typeof next === 'string' &&
  next.startsWith('/') &&
  !next.startsWith('//') &&
  !next.startsWith('/\\')
    ? next
    : '/'

/** Compares in the same time whatever the input, so timing gives nothing away. */
const equal = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD
  if (!password) return NextResponse.next()
  const { pathname, search } = request.nextUrl
  const token = await gateToken(password)

  // The password form posts here.
  if (pathname === '/unlock' && request.method === 'POST') {
    const form = await request.formData().catch(() => undefined)
    const next = safeNext(form?.get('next'))
    const given = form?.get('password')
    if (typeof given === 'string' && equal(await gateToken(given), token)) {
      const res = NextResponse.redirect(new URL(next, request.url), 303)
      res.cookies.set(GATE_COOKIE, token, {
        httpOnly: true,
        secure: request.nextUrl.protocol === 'https:',
        sameSite: 'lax',
        path: '/',
        maxAge: DAYS * 24 * 60 * 60,
      })
      return res
    }
    // A wrong guess waits a moment, so the password can't be tried thousands of times a minute.
    await new Promise((r) => setTimeout(r, 800))
    const back = new URL('/unlock', request.url)
    back.searchParams.set('next', next)
    back.searchParams.set('error', '1')
    return NextResponse.redirect(back, 303)
  }

  const cookie = request.cookies.get(GATE_COOKIE)?.value
  if (pathname === '/unlock' || (cookie && equal(cookie, token))) return NextResponse.next()

  // Show the password page here, keeping the address, so the visitor lands where they meant to.
  const gate = new URL('/unlock', request.url)
  gate.searchParams.set('next', pathname + search)
  const res = NextResponse.rewrite(gate, { status: 401 })
  res.headers.set('X-Robots-Tag', 'noindex')
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export const config = {
  // Everything but the admin and its API, the newsletter preview (admins only, by its own login),
  // the newsletter's sign-up confirmation (its link must work from any inbox),
  // the daily cleanup job (it has its own secret),
  // Next's own files, and files with an extension (images, the icon, robots.txt).
  matcher: [
    '/((?!admin|api|cron|newsletter-preview|subscribe/confirm|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)',
  ],
}
