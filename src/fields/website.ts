import type { TextField } from 'payload'

export const websiteField: TextField = {
  name: 'website',
  type: 'text',
  admin: {
    description: 'Full address, starting with https://',
  },
  validate: (value: null | string | undefined) => {
    if (!value) return true
    try {
      const url = new URL(value)
      if (url.protocol === 'http:' || url.protocol === 'https:') return true
    } catch {
      // fall through
    }
    return 'Enter a full web address, for example https://example.com'
  },
}
