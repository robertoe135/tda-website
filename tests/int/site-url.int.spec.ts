import { describe, expect, it } from 'vitest'

import { siteUrl } from '@/lib/seo'

describe("the site's address", () => {
  it('adds https:// when the setting leaves it out, and drops a trailing slash', () => {
    expect(siteUrl('tillotsondesign.com')).toBe('https://tillotsondesign.com')
    expect(siteUrl(' https://tillotsondesign.com/ ')).toBe('https://tillotsondesign.com')
    expect(siteUrl('http://localhost:3000')).toBe('http://localhost:3000')
    expect(siteUrl('')).toBe('http://localhost:3000')
    expect(() => new URL(siteUrl('www.tillotsondesign.com'))).not.toThrow()
  })
})
