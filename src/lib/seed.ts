import { newId } from './id'
import type { Person, Relationship } from '../types'

type SeedPerson = {
  key: string
  name: string
  birthDate?: string
  deathDate?: string
  isSelf?: boolean
}

type SeedRel = {
  from: string
  to: string
  type: Relationship['type']
  status?: Relationship['status']
}

/**
 * The demo family from the reference mockups: two great-grandparent couples on
 * the top row, their children marrying into the generation below, and the
 * removed relative (Michael) already soft-removed so the theme's removal effect
 * is visible straight away.
 */
const PEOPLE: SeedPerson[] = [
  { key: 'edward', name: 'Edward', birthDate: '1880', deathDate: '1951' },
  { key: 'margaret', name: 'Margaret', birthDate: '1883', deathDate: '1958' },
  { key: 'thomas', name: 'Thomas', birthDate: '1877', deathDate: '1948' },
  { key: 'agnes', name: 'Agnes', birthDate: '1881', deathDate: '1962' },
  { key: 'william', name: 'William', birthDate: '1908', deathDate: '1976' },
  { key: 'eleanor', name: 'Eleanor', birthDate: '1912', deathDate: '1983' },
  { key: 'linda', name: 'Linda', birthDate: '1940' },
  { key: 'robert', name: 'Robert', birthDate: '1935', deathDate: '2010' },
  { key: 'michael', name: 'Michael', birthDate: '1938', deathDate: '2005' },
  { key: 'james', name: 'James', birthDate: '1962' },
  { key: 'you', name: 'You', birthDate: '1990', isSelf: true },
  { key: 'sarah', name: 'Sarah', birthDate: '1965' },
  { key: 'ethan', name: 'Ethan', birthDate: '2015' },
  { key: 'olivia', name: 'Olivia', birthDate: '2018' },
]

const RELS: SeedRel[] = [
  { from: 'edward', to: 'margaret', type: 'spouse' },
  { from: 'thomas', to: 'agnes', type: 'spouse' },

  { from: 'edward', to: 'william', type: 'parent' },
  { from: 'margaret', to: 'william', type: 'parent' },
  { from: 'thomas', to: 'eleanor', type: 'parent' },
  { from: 'agnes', to: 'eleanor', type: 'parent' },

  { from: 'william', to: 'eleanor', type: 'spouse' },
  { from: 'william', to: 'robert', type: 'parent' },
  { from: 'eleanor', to: 'robert', type: 'parent' },

  // Michael is soft-removed in the mockups — the shattered / cracked node.
  { from: 'william', to: 'michael', type: 'parent', status: 'removed' },
  { from: 'eleanor', to: 'michael', type: 'parent', status: 'removed' },
  { from: 'robert', to: 'michael', type: 'sibling', status: 'removed' },

  { from: 'robert', to: 'linda', type: 'spouse' },
  { from: 'robert', to: 'james', type: 'parent' },
  { from: 'linda', to: 'james', type: 'parent' },
  { from: 'robert', to: 'you', type: 'parent' },
  { from: 'linda', to: 'you', type: 'parent' },
  { from: 'robert', to: 'sarah', type: 'parent' },
  { from: 'linda', to: 'sarah', type: 'parent' },

  { from: 'you', to: 'ethan', type: 'parent' },
  { from: 'you', to: 'olivia', type: 'parent' },
]

export function buildSeedTree(frameVariants = 3) {
  const now = Date.now()
  const ids = new Map<string, string>()
  const people: Person[] = PEOPLE.map((p, i) => {
    const id = newId()
    ids.set(p.key, id)
    return {
      id,
      name: p.name,
      birthDate: p.birthDate,
      deathDate: p.deathDate,
      isSelf: p.isSelf,
      frameVariant: i % frameVariants,
      createdAt: now + i,
    }
  })

  const relationships: Relationship[] = RELS.map((r, i) => ({
    id: newId(),
    fromPersonId: ids.get(r.from)!,
    toPersonId: ids.get(r.to)!,
    type: r.type,
    status: r.status ?? 'active',
    createdAt: now + i,
  }))

  return { people, relationships, rootPersonId: ids.get('edward')! }
}
