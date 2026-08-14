import type { Person, Relationship } from '../types'

/**
 * Colour-codes each person by which ancestral line they descend from, so the
 * two sides of the family read apart at a glance (blue for one grandparent
 * pair, gold for the other, in the Celestial mockup).
 *
 * Every person is walked up to the topmost ancestor reachable from them; that
 * ancestor's position in the tree decides the colour index, and everyone below
 * inherits it. Spouses who married in adopt their partner's line only when they
 * have no line of their own.
 */
export function assignLineage(
  people: Person[],
  relationships: Relationship[],
): Record<string, number> {
  const parentsOf = new Map<string, string[]>()
  const spousesOf = new Map<string, string[]>()
  for (const r of relationships) {
    if (r.type === 'parent') {
      parentsOf.set(r.toPersonId, [...(parentsOf.get(r.toPersonId) ?? []), r.fromPersonId])
    } else if (r.type === 'spouse') {
      spousesOf.set(r.fromPersonId, [...(spousesOf.get(r.fromPersonId) ?? []), r.toPersonId])
      spousesOf.set(r.toPersonId, [...(spousesOf.get(r.toPersonId) ?? []), r.fromPersonId])
    }
  }

  const rootOf = new Map<string, string>()
  const resolveRoot = (id: string): string => {
    const cached = rootOf.get(id)
    if (cached) return cached
    const seen = new Set<string>()
    let cursor = id
    while (true) {
      if (seen.has(cursor)) break
      seen.add(cursor)
      const parents = parentsOf.get(cursor)
      if (!parents || parents.length === 0) break
      cursor = parents[0]
    }
    for (const visited of seen) rootOf.set(visited, cursor)
    return cursor
  }

  // Root ancestors get colours in creation order, so the first line added is
  // colour 0 and lines stay stable as the tree grows.
  const roots = people
    .filter((p) => !(parentsOf.get(p.id) ?? []).length)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))

  const rootIndex = new Map<string, number>()
  let next = 0
  for (const root of roots) {
    if (rootIndex.has(root.id)) continue
    // A married-in root shares the colour of the partner they joined.
    const partnerWithIndex = (spousesOf.get(root.id) ?? []).find((s) => rootIndex.has(s))
    rootIndex.set(root.id, partnerWithIndex ? rootIndex.get(partnerWithIndex)! : next++)
  }

  const result: Record<string, number> = {}
  for (const person of people) {
    const root = resolveRoot(person.id)
    let index = rootIndex.get(root)
    if (index === undefined) {
      const partner = (spousesOf.get(person.id) ?? []).find((s) => rootIndex.has(resolveRoot(s)))
      index = partner ? rootIndex.get(resolveRoot(partner))! : 0
    }
    result[person.id] = index
  }
  return result
}
