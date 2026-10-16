import { describe, expect, it } from 'vitest'

import { flagsFor, isClutter, kindOf, redactor } from '../../scripts/media/inventory-lib'

describe('website files inventory', () => {
  it('sorts files into what the site can use as they are and what needs work', () => {
    expect(kindOf('A/B/Shed_01.JPG')).toBe('photo')
    expect(kindOf('A/B/Shed_01.tif')).toBe('photo')
    expect(kindOf('A/B/Shed_02.HEIC')).toBe('needs-export')
    expect(kindOf('A/B/raw.CR2')).toBe('needs-export')
    expect(kindOf('Videos/loop.mov')).toBe('video')
    expect(kindOf('Copy/Shed.docx')).toBe('document')
    expect(isClutter('._Shed_01.jpg')).toBe(true)
    expect(isClutter('.DS_Store')).toBe(true)
    expect(isClutter('Thumbs.db')).toBe(true)
    expect(isClutter('Shed_01.jpg')).toBe(false)
  })

  it('flags what to fix before upload', () => {
    expect(flagsFor({ path: 'v/loop.mov', kind: 'video', bytes: 41 * 1024 * 1024 })).toEqual([
      'convert to MP4 (H.264)',
      'video over 40 MB: export a shorter or smaller loop',
    ])
    expect(flagsFor({ path: 'p/a.jpg', kind: 'photo', bytes: 1, width: 1000, height: 667 })).toEqual(['small (1000 px): may look soft'])
    expect(flagsFor({ path: 'p/a.jpg', kind: 'photo', bytes: 1, width: 4500, height: 3000 })).toEqual([])
    expect(flagsFor({ path: 'p/a.heic', kind: 'needs-export', bytes: 1 })).toEqual(['export as JPEG first'])
  })

  it('hides folder names under Residential or Private folders, consistently', () => {
    const redact = redactor()
    expect(redact('Photos/Corporate/1. One Vanderbilt')).toBe('Photos/Corporate/1. One Vanderbilt')
    expect(redact('Photos/Residential/1. Smith Residence')).toBe('Photos/Residential/[private 1]')
    expect(redact('Photos/Residential/1. Smith Residence/Selects')).toBe('Photos/Residential/[private 1]/[private 2]')
    expect(redact('Photos/Residential/1. Smith Residence')).toBe('Photos/Residential/[private 1]')
  })
})
