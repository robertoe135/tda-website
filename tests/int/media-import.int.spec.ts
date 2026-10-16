import { describe, expect, it } from 'vitest'

import { matchProject, parsePhotoPath, skipReason, slideOrder } from '../../scripts/media/lib'
import { splitCredit } from '../../scripts/migrate/lib'

describe('photo folders', () => {
  it('reads category, project order, project name and slide from a Windows path', () => {
    expect(parsePhotoPath('Corporate\\1. Comcast Technology Center\\Comcast Center_01.jpg')).toEqual({
      category: 'Corporate',
      folder: '1. Comcast Technology Center',
      folderName: 'Comcast Technology Center',
      folderOrder: 1,
      file: 'Comcast Center_01.jpg',
      slide: 1,
    })
  })

  it('ignores copy, hidden files and photos outside a project folder', () => {
    expect(parsePhotoPath('Corporate/1. Comcast Technology Center/Copy.docx')).toBeUndefined()
    expect(parsePhotoPath('Corporate/1. Comcast Technology Center/._Comcast_01.jpg')).toBeUndefined()
    expect(parsePhotoPath('Corporate/stray.jpg')).toBeUndefined()
    expect(parsePhotoPath('Corporate/1. Comcast/Selects/Comcast_01.jpg')).toBeUndefined()
  })

  it('orders slides by the number in the file name', () => {
    const files = ['X_10.jpg', 'X_2.jpg', 'X_01.jpg', 'cover.jpg'].map((file) => ({ file, slide: parsePhotoPath(`A/B/${file}`)?.slide }))
    expect(slideOrder(files).map((f) => f.file)).toEqual(['X_01.jpg', 'X_2.jpg', 'X_10.jpg', 'cover.jpg'])
  })

  it('matches exactly only when names agree, otherwise suggests for a person to confirm', () => {
    const projects = [
      { slug: 'comcast-technology-center', name: 'Comcast Technology Center' },
      { slug: 'the-shed', name: 'The Shed' },
    ]
    expect(matchProject('Comcast Technology  Center', projects)).toMatchObject({ exact: true })
    const near = matchProject('Comcast Tech Center', projects)
    expect(near).toMatchObject({ exact: false, candidate: { slug: 'comcast-technology-center' } })
    expect(matchProject('Unrelated Residence', projects)).toBeUndefined()
  })

  it('splits photo credits on commas only, keeping studio names and spellings', () => {
    expect(splitCredit('Floto + Warner, Agaton Strom,')).toEqual(['Floto + Warner', 'Agaton Strom'])
    expect(splitCredit('FG+SG Architectural Photography')).toEqual(['FG+SG Architectural Photography'])
  })

  it('never imports folders without rights, removed or working folders, or non-project categories', () => {
    const cats = ['Academic', 'Corporate', 'Museums', 'Performing Arts', 'Places of Worship']
    expect(skipReason('Academic', 'Madison Square Boy & Girls Club - NO RIGHTS', cats)).toMatch(/NO RIGHTS/)
    expect(skipReason('Academic', 'The Brearley School - no right', cats)).toMatch(/NO RIGHTS/)
    expect(skipReason('Corporate', 'ST Removed', cats)).toMatch(/removed/)
    expect(skipReason('!Temp Edits', 'Anything', cats)).toMatch(/removed|temporary/)
    expect(skipReason('Lifestyle Photos', 'New Headshots + Office', cats)).toMatch(/not a portfolio category/)
    expect(skipReason('Firm Profile', 'OBS', cats)).toMatch(/not a portfolio category/)
    // Real projects pass, including the singular "Museum" folder and names that contain "temp"/"old".
    expect(skipReason('Museum', '4. The Shed', cats)).toBeUndefined()
    expect(skipReason('Academic', '3. Charles Library at Temple University', cats)).toBeUndefined()
    expect(skipReason('Places of Worship', '2. Old Stone Church', cats)).toBeUndefined()
  })
})
