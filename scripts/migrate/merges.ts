/**
 * Project pages TDA has confirmed are one project, though the old site gave them different
 * names. The extractor merges same-name duplicates on its own; anything else is listed here
 * by a person, never guessed.
 *
 * `name` must be a name TDA already uses (it is not corrected or invented here).
 */
export const MANUAL_MERGES: { slugs: string[]; name: string; source: string }[] = [
  {
    slugs: ['712-fifth-avenue-atrium', '712-fifth-avenue-lobby'],
    name: '712 Fifth Avenue Lobby & Atrium',
    source: 'Confirmed by TDA, October 2026; name as on the old site’s timeline page.',
  },
]
