import type { TextField } from 'payload'

const isWebAddress = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Optional link field that only accepts full http(s) addresses. */
export const urlField = (name: string, label?: string): TextField => ({
  name,
  label,
  type: 'text',
  admin: {
    description: 'Full address, starting with https://',
  },
  validate: (value: null | string | undefined) =>
    !value || isWebAddress(value)
      ? true
      : 'Enter a full web address, for example https://example.com',
})

export const websiteField: TextField = urlField('website')
