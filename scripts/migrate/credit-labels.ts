/**
 * How each label on the old "full project credits" pages maps to a role. The old site
 * spells the same role many ways ("Architect of Record", "Architect on Record"). Labels not
 * listed here are kept with role "unmapped" and flagged in review.csv; add them here rather
 * than guessing in the extractor.
 *
 * Roles marked `firm` hold collaborator firm names; `fact` roles hold project facts.
 */
export type Role =
  | 'location'
  | 'completed'
  | 'area'
  | 'sustainabilityStatus'
  | 'owner'
  | 'photography'
  | 'awards'
  | 'consultantsHeading'
  | 'designArchitect'
  | 'architect'
  | 'executiveArchitect'
  | 'architectOfRecord'
  | 'associateArchitect'
  | 'collaboratingArchitect'
  | 'originalArchitect'
  | 'interiorDesigner'
  | 'landscapeArchitect'
  | 'exhibitDesigner'
  | 'lightingDesign'
  | 'ownerRepresentative'
  | 'consultant'
  | 'curator'
  | 'artist'
  | 'unmapped'

export const FIRM_ROLES = new Set<Role>([
  'designArchitect',
  'architect',
  'executiveArchitect',
  'architectOfRecord',
  'associateArchitect',
  'collaboratingArchitect',
  'originalArchitect',
  'interiorDesigner',
  'landscapeArchitect',
  'exhibitDesigner',
  'lightingDesign',
  'ownerRepresentative',
  'consultant',
])

/** Roles that name the project's architects (the `architects` field on a project). */
export const ARCHITECT_ROLES = new Set<Role>(['designArchitect', 'architect', 'collaboratingArchitect'])

const LABELS: Record<string, Role> = {
  location: 'location',
  'project completed': 'completed',
  area: 'area',
  size: 'area',
  'leed/well status': 'sustainabilityStatus',
  'leed / well status': 'sustainabilityStatus',
  owner: 'owner',
  'owner/client': 'owner',
  client: 'owner',
  owners: 'owner',
  'owner/project organizer': 'owner',
  photography: 'photography',
  photographer: 'photography',
  photographers: 'photography',
  photos: 'photography',
  awards: 'awards',
  consultants: 'consultantsHeading',
  'design architect': 'designArchitect',
  'design architects': 'designArchitect',
  architect: 'architect',
  'executive architect': 'executiveArchitect',
  'architect of record': 'architectOfRecord',
  'architect on record': 'architectOfRecord',
  'associate architect': 'associateArchitect',
  'collaborating architect': 'collaboratingArchitect',
  'original architect': 'originalArchitect',
  // As written in marketing's new-project documents (Projects to Add).
  'architecture company': 'architect',
  'architecture firm': 'architect',
  'interior design company': 'interiorDesigner',
  'interior design firm': 'interiorDesigner',
  'interior designer': 'interiorDesigner',
  'interior design': 'interiorDesigner',
  'interior architect': 'interiorDesigner',
  'landscape architect': 'landscapeArchitect',
  'landscape (interior) architect': 'landscapeArchitect',
  'exhibit designer': 'exhibitDesigner',
  'exhibit design': 'exhibitDesigner',
  'exhibition designer': 'exhibitDesigner',
  'exhibit architect': 'exhibitDesigner',
  'lighting design': 'lightingDesign',
  'owner representative': 'ownerRepresentative',
  'owners representative': 'ownerRepresentative',
  curators: 'curator',
  'sculpture artist': 'artist',
  // Engineers and specialist consultants: kept with their own label as the role name.
  engineer: 'consultant',
  'structural engineer': 'consultant',
  'façade consultant': 'consultant',
  'facade consultant': 'consultant',
  'facade engineer': 'consultant',
  'leed sustainability': 'consultant',
  'leed consultant': 'consultant',
  sustainability: 'consultant',
  security: 'consultant',
  'graphic designer': 'consultant',
  'graphic design': 'consultant',
  'graphic design and signage': 'consultant',
  'fabrication architect': 'consultant',
  'mechanical/electrical engineer': 'consultant',
  'mep/fp engineer': 'consultant',
  'mep/fp/it': 'consultant',
  'construction manager': 'consultant',
  'general contractor': 'consultant',
  'civil engineer': 'consultant',
  'audiovisual and it': 'consultant',
  'av/it': 'consultant',
  'acoustics/av': 'consultant',
  'acoustical design': 'consultant',
  'historic preservation': 'consultant',
  envelope: 'consultant',
  'lab planning consultant': 'consultant',
  'retail consultant': 'consultant',
}

export const roleFor = (label: string): Role => LABELS[label.trim().toLowerCase().replace(/\s+/g, ' ')] ?? 'unmapped'
