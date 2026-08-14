import { hierarchy } from 'd3-hierarchy'
import type {
  BranchLink,
  Junction,
  LayoutResult,
  NodePosition,
  Person,
  Relationship,
} from '../types'

export type LayoutMetrics = {
  /** Horizontal footprint of one person (portrait + name plate). */
  nodeSlot: number
  /** Extra gap between two partners inside a couple. */
  spouseGap: number
  /** Extra gap between adjacent family units in the same generation. */
  siblingGap: number
  /** Vertical distance between generations. */
  rowHeight: number
}

export const DEFAULT_METRICS: LayoutMetrics = {
  // Kept tight on purpose: the narrower the tree, the larger it can be drawn
  // before it has to fit a phone's width, which is what keeps names readable.
  nodeSlot: 122,
  spouseGap: 20,
  siblingGap: 30,
  rowHeight: 208,
}

/**
 * A "union" is one couple (or a single unpartnered person) plus the children
 * that hang beneath them. The whole tree is laid out as a forest of unions,
 * which is what gives the mockups their look: partners sit side by side, and
 * their children fan out from a single junction below the pair.
 */
type Union = {
  id: string
  partners: string[]
  childUnionIds: string[]
  /**
   * Every union the partners descend from — up to two, one per partner. A
   * married couple belongs to *both* their families, which is exactly what a
   * strict tree cannot express and why the layout below is layered rather than
   * a plain d3.tree() pass.
   */
  parentUnionIds: string[]
  /** The single parent kept for the spanning tree used to seed row ordering. */
  parentUnionId: string | null
  depth: number
  width: number
}

type Graph = {
  parentsOf: Map<string, string[]>
  childrenOf: Map<string, string[]>
  spousesOf: Map<string, string[]>
  siblingsOf: Map<string, string[]>
}

/** Stable ordering for records that arrive from Firestore in id order. */
export function byCreation<T extends { id: string; createdAt?: number }>(a: T, b: T) {
  return (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id)
}

function push(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key)
  if (list) {
    if (!list.includes(value)) list.push(value)
  } else {
    map.set(key, [value])
  }
}

function buildGraph(relationships: Relationship[]): Graph {
  const g: Graph = {
    parentsOf: new Map(),
    childrenOf: new Map(),
    spousesOf: new Map(),
    siblingsOf: new Map(),
  }
  for (const r of relationships) {
    if (r.type === 'parent') {
      push(g.parentsOf, r.toPersonId, r.fromPersonId)
      push(g.childrenOf, r.fromPersonId, r.toPersonId)
    } else if (r.type === 'spouse') {
      push(g.spousesOf, r.fromPersonId, r.toPersonId)
      push(g.spousesOf, r.toPersonId, r.fromPersonId)
    } else {
      push(g.siblingsOf, r.fromPersonId, r.toPersonId)
      push(g.siblingsOf, r.toPersonId, r.fromPersonId)
    }
  }
  return g
}

/**
 * Generations are derived, never stored: depth(child) = max(depth(parents)) + 1,
 * with spouses and siblings pulled onto a shared row. Relaxed to a fixpoint so
 * people added out of order still land on the right row.
 */
function computeDepths(people: Person[], relationships: Relationship[]): Map<string, number> {
  const depth = new Map<string, number>()
  for (const p of people) depth.set(p.id, 0)

  const parentRels = relationships.filter((r) => r.type === 'parent')
  const peerRels = relationships.filter((r) => r.type !== 'parent')
  const maxIterations = Math.min(people.length * 2 + 4, 240)

  for (let i = 0; i < maxIterations; i++) {
    let changed = false
    for (const r of parentRels) {
      const from = depth.get(r.fromPersonId)
      const to = depth.get(r.toPersonId)
      if (from === undefined || to === undefined) continue
      if (to < from + 1) {
        depth.set(r.toPersonId, from + 1)
        changed = true
      }
    }
    for (const r of peerRels) {
      const a = depth.get(r.fromPersonId)
      const b = depth.get(r.toPersonId)
      if (a === undefined || b === undefined) continue
      const m = Math.max(a, b)
      if (a !== m) {
        depth.set(r.fromPersonId, m)
        changed = true
      }
      if (b !== m) {
        depth.set(r.toPersonId, m)
        changed = true
      }
    }
    if (!changed) break
  }
  return depth
}

function buildUnions(
  people: Person[],
  g: Graph,
  depth: Map<string, number>,
  metrics: LayoutMetrics,
) {
  const unions = new Map<string, Union>()
  /** personId -> the union they are a partner in (their "home"). */
  const homeUnion = new Map<string, string>()

  const order = [...people].sort(
    (a, b) => (depth.get(a.id) ?? 0) - (depth.get(b.id) ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0),
  )

  // Couples first, so partners share a union before singletons are created.
  for (const person of order) {
    if (homeUnion.has(person.id)) continue
    const partner = (g.spousesOf.get(person.id) ?? []).find((id) => !homeUnion.has(id))
    const partners = partner ? [person.id, partner] : [person.id]
    const id = `u:${partners.join('+')}`
    unions.set(id, {
      id,
      partners,
      childUnionIds: [],
      parentUnionIds: [],
      parentUnionId: null,
      depth: Math.max(...partners.map((p) => depth.get(p) ?? 0)),
      width: partners.length * metrics.nodeSlot + (partners.length - 1) * metrics.spouseGap,
    })
    for (const p of partners) homeUnion.set(p, id)
  }

  // Connect each union to the families its partners came from. Both are kept:
  // the layout pass below uses them all to decide ordering, while
  // `parentUnionId` keeps a single spanning-tree edge for the initial DFS order.
  const parentsOfPerson = (personId: string) => {
    const direct = g.parentsOf.get(personId) ?? []
    if (direct.length) return direct
    // A sibling with no recorded parents inherits its sibling's parents so it
    // still grows out of the right branch instead of floating as a new root.
    for (const sib of g.siblingsOf.get(personId) ?? []) {
      const sibParents = g.parentsOf.get(sib) ?? []
      if (sibParents.length) return sibParents
    }
    return []
  }

  for (const union of unions.values()) {
    for (const partner of union.partners) {
      for (const parentId of parentsOfPerson(partner)) {
        const parentUnionId = homeUnion.get(parentId)
        if (!parentUnionId || parentUnionId === union.id) continue
        if (!union.parentUnionIds.includes(parentUnionId)) {
          union.parentUnionIds.push(parentUnionId)
        }
        break
      }
    }
    // The first partner's family carries the spanning-tree edge.
    union.parentUnionId = union.parentUnionIds[0] ?? null
    if (union.parentUnionId) {
      unions.get(union.parentUnionId)!.childUnionIds.push(union.id)
    }
  }

  // Break any parent-cycle so the hierarchy pass cannot recurse forever.
  for (const union of unions.values()) {
    const seen = new Set<string>([union.id])
    let cursor = union.parentUnionId
    while (cursor) {
      if (seen.has(cursor)) {
        const parent = unions.get(union.parentUnionId!)
        if (parent) parent.childUnionIds = parent.childUnionIds.filter((c) => c !== union.id)
        union.parentUnionId = null
        break
      }
      seen.add(cursor)
      cursor = unions.get(cursor)?.parentUnionId ?? null
    }
  }

  return { unions, homeUnion }
}

/** Children read left-to-right in the order they were added. */
function sortChildUnions(unions: Map<string, Union>, people: Map<string, Person>) {
  for (const union of unions.values()) {
    union.childUnionIds.sort((a, b) => {
      const pa = people.get(unions.get(a)!.partners[0])
      const pb = people.get(unions.get(b)!.partners[0])
      return (pa?.createdAt ?? 0) - (pb?.createdAt ?? 0)
    })
  }
}

/**
 * Places the union forest as generation rows.
 *
 * A plain `d3.tree()` cannot express this graph: a married couple descends from
 * *two* families at once, and a tree can only hang them off one — which is what
 * leaves one set of grandparents stranded off to the side. So d3-hierarchy is
 * used for what it is good at here, walking the spanning tree to get a sensible
 * left-to-right starting order, and the horizontal packing is then refined by
 * repeated barycentre sweeps: each union slides toward the average position of
 * the families above and the children below it, and overlaps within a row are
 * pushed apart. A couple therefore settles between both sets of their parents,
 * and parents settle centred over their children.
 */
function layoutUnions(unions: Map<string, Union>, metrics: LayoutMetrics) {
  const roots = [...unions.values()].filter((u) => !u.parentUnionId)
  type Datum = { union: Union | null }

  // Depth-first walk of the spanning tree gives the initial ordering.
  const order: Union[] = []
  hierarchy<Datum>({ union: null }, (d) =>
    (d.union ? d.union.childUnionIds.map((id) => unions.get(id)!) : roots).map((u) => ({ union: u })),
  ).each((n) => {
    if (n.data.union) order.push(n.data.union)
  })
  // Anything unreachable through the spanning tree (a cycle we broke) still gets a slot.
  for (const union of unions.values()) if (!order.includes(union)) order.push(union)

  const rows = new Map<number, Union[]>()
  for (const union of order) {
    const row = rows.get(union.depth) ?? []
    row.push(union)
    rows.set(union.depth, row)
  }
  const depths = [...rows.keys()].sort((a, b) => a - b)

  const x = new Map<string, number>()
  for (const row of rows.values()) {
    let cursor = 0
    for (const union of row) {
      x.set(union.id, cursor + union.width / 2)
      cursor += union.width + metrics.siblingGap
    }
  }

  const meanOf = (ids: string[]) => {
    const values = ids.map((id) => x.get(id)).filter((v): v is number => v !== undefined)
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  }

  /** Pushes a row apart in place, preserving its order. */
  const separate = (row: Union[]) => {
    row.sort((a, b) => x.get(a.id)! - x.get(b.id)!)
    for (let i = 1; i < row.length; i++) {
      const min =
        x.get(row[i - 1].id)! + row[i - 1].width / 2 + row[i].width / 2 + metrics.siblingGap
      if (x.get(row[i].id)! < min) x.set(row[i].id, min)
    }
    for (let i = row.length - 2; i >= 0; i--) {
      const max = x.get(row[i + 1].id)! - row[i + 1].width / 2 - row[i].width / 2 - metrics.siblingGap
      if (x.get(row[i].id)! > max) x.set(row[i].id, max)
    }
  }

  for (let pass = 0; pass < 14; pass++) {
    // Upward: pull parents over the middle of their children.
    for (let i = depths.length - 1; i >= 0; i--) {
      for (const union of rows.get(depths[i])!) {
        const target = meanOf(union.childUnionIds)
        if (target !== null) x.set(union.id, target)
      }
      separate(rows.get(depths[i])!)
    }
    // Downward: pull each couple between the families they both came from.
    for (let i = 0; i < depths.length; i++) {
      for (const union of rows.get(depths[i])!) {
        const target = meanOf(union.parentUnionIds)
        if (target !== null) x.set(union.id, target)
      }
      separate(rows.get(depths[i])!)
    }
  }

  const positions = new Map<string, { x: number; y: number }>()
  for (const union of unions.values()) {
    positions.set(union.id, {
      x: x.get(union.id) ?? 0,
      // Generation from the relationship graph decides the row, so people added
      // out of order (a grandparent added last) still land where they belong.
      y: union.depth * metrics.rowHeight,
    })
  }
  return positions
}

export function computeLayout(
  people: Person[],
  relationships: Relationship[],
  metrics: LayoutMetrics = DEFAULT_METRICS,
): LayoutResult {
  const empty: LayoutResult = {
    nodes: [],
    links: [],
    junctions: [],
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    byId: {},
  }
  if (people.length === 0) return empty

  const peopleById = new Map(people.map((p) => [p.id, p]))
  const known = new Set(peopleById.keys())
  // Ignore relationships pointing at people who no longer exist.
  const rels = relationships
    .filter(
      (r) => known.has(r.fromPersonId) && known.has(r.toPersonId) && r.fromPersonId !== r.toPersonId,
    )
    // Firestore hands collections back ordered by document id, so the array
    // arrives in a different order than it was written. Several decisions below
    // read "the first parent", so sort into a stable order first — otherwise the
    // same tree could lay itself out differently after a reload.
    .sort(byCreation)

  const g = buildGraph(rels)
  const depth = computeDepths(people, rels)
  const { unions, homeUnion } = buildUnions(people, g, depth, metrics)
  sortChildUnions(unions, peopleById)

  const unionPos = layoutUnions(unions, metrics)

  // -------------------------------------------------------------------------
  // Person positions
  // -------------------------------------------------------------------------
  const removedByPerson = computeRemovedPeople(people, rels)
  const maxDepth = Math.max(1, ...[...depth.values()])
  const nodes: NodePosition[] = []
  const posOf = new Map<string, { x: number; y: number }>()

  for (const union of unions.values()) {
    const at = unionPos.get(union.id)
    if (!at) continue
    const step = metrics.nodeSlot + metrics.spouseGap
    const startX = at.x - union.width / 2 + metrics.nodeSlot / 2
    union.partners.forEach((personId, i) => {
      const d = depth.get(personId) ?? union.depth
      const x = startX + i * step
      const y = d * metrics.rowHeight
      posOf.set(personId, { x, y })
      nodes.push({
        personId,
        x,
        y,
        depth: d,
        // Nodes nearer the trunk read slightly heavier, like a real tree.
        scale: 1 - 0.1 * (d / maxDepth),
        removed: removedByPerson.has(personId),
      })
    })
  }

  // -------------------------------------------------------------------------
  // Branches
  // -------------------------------------------------------------------------
  const links: BranchLink[] = []
  const junctions: Junction[] = []
  const bend = (dx: number) => Math.max(-1, Math.min(1, dx / metrics.rowHeight))

  for (const union of unions.values()) {
    const at = unionPos.get(union.id)
    if (!at) continue

    const childRels = rels.filter(
      (r) => r.type === 'parent' && union.partners.includes(r.fromPersonId) && posOf.has(r.toPersonId),
    )
    if (childRels.length === 0) continue

    const junctionY = union.depth * metrics.rowHeight + metrics.rowHeight * 0.42
    const junctionId = `j:${union.id}`
    const allChildLinksRemoved = childRels.every((r) => r.status === 'removed')

    junctions.push({
      id: junctionId,
      x: at.x,
      y: junctionY,
      depth: union.depth,
      status: allChildLinksRemoved ? 'removed' : 'active',
    })

    // Short stem from each partner down into the shared junction.
    for (const partnerId of union.partners) {
      const from = posOf.get(partnerId)
      if (!from) continue
      const partnerHasActiveChild = childRels.some(
        (r) => r.fromPersonId === partnerId && r.status === 'active',
      )
      const partnerHasAnyChild = childRels.some((r) => r.fromPersonId === partnerId)
      // A partner with no children of their own still gets a stem when they are
      // half of the couple the children hang from.
      links.push({
        id: `stem:${union.id}:${partnerId}`,
        relationshipId: null,
        kind: 'stem',
        from,
        to: { x: at.x, y: junctionY },
        endpoints: [partnerId],
        depth: union.depth,
        status: partnerHasAnyChild && !partnerHasActiveChild ? 'removed' : 'active',
        bend: bend(at.x - from.x) * 0.35,
      })
    }

    for (const r of childRels) {
      const to = posOf.get(r.toPersonId)!
      links.push({
        id: `branch:${r.id}`,
        relationshipId: r.id,
        kind: 'parent',
        from: { x: at.x, y: junctionY },
        to,
        endpoints: [r.fromPersonId, r.toPersonId],
        depth: union.depth,
        status: r.status,
        bend: bend(to.x - at.x),
      })
    }
  }

  // Spouse links that the union packing did not already place side by side
  // (second marriages, or partners whose union slots were taken).
  for (const r of rels) {
    if (r.type !== 'spouse') continue
    const a = posOf.get(r.fromPersonId)
    const b = posOf.get(r.toPersonId)
    if (!a || !b) continue
    const sameUnion =
      homeUnion.get(r.fromPersonId) === homeUnion.get(r.toPersonId) &&
      homeUnion.has(r.fromPersonId)
    links.push({
      id: `spouse:${r.id}`,
      relationshipId: r.id,
      kind: 'spouse',
      from: a,
      to: b,
      endpoints: [r.fromPersonId, r.toPersonId],
      depth: depth.get(r.fromPersonId) ?? 0,
      status: r.status,
      // Partners sharing a union sit adjacent, so their tie is a near-flat
      // connector; distant partners get a deeper arc to clear other nodes.
      bend: sameUnion ? 0.12 : 0.5,
    })
  }

  for (const r of rels) {
    if (r.type !== 'sibling') continue
    const a = posOf.get(r.fromPersonId)
    const b = posOf.get(r.toPersonId)
    if (!a || !b) continue
    // Siblings that already share a parent junction are connected through it;
    // only draw the direct tie when there is no shared parent branch.
    const shareParent = (g.parentsOf.get(r.fromPersonId) ?? []).some((p) =>
      (g.parentsOf.get(r.toPersonId) ?? []).includes(p),
    )
    if (shareParent) continue
    links.push({
      id: `sibling:${r.id}`,
      relationshipId: r.id,
      kind: 'sibling',
      from: a,
      to: b,
      endpoints: [r.fromPersonId, r.toPersonId],
      depth: depth.get(r.fromPersonId) ?? 0,
      status: r.status,
      bend: 0.3,
    })
  }

  // Bounds have to clear the *drawn* node, not just its centre: name plates and
  // glow haloes reach well past the portrait, and clipping them looks broken.
  const xs = nodes.map((n) => n.x)
  const ys = nodes.map((n) => n.y)
  const padX = metrics.nodeSlot * 0.9
  const padY = metrics.nodeSlot * 0.75
  const bounds = {
    minX: Math.min(...xs) - padX,
    maxX: Math.max(...xs) + padX,
    minY: Math.min(...ys) - padY,
    // Extra room below the last row for the name and dates under each portrait.
    maxY: Math.max(...ys) + padY + 110,
  }

  const byId: Record<string, NodePosition> = {}
  for (const n of nodes) byId[n.personId] = n

  return { nodes, links, junctions, bounds, byId }
}

/**
 * A person reads as soft-removed once every relationship touching them is
 * removed — that is what "remove this relative" does, and it is why an isolated
 * person (no relationships at all) is never treated as removed.
 */
export function computeRemovedPeople(people: Person[], relationships: Relationship[]) {
  const touched = new Map<string, { total: number; removed: number }>()
  for (const r of relationships) {
    for (const id of [r.fromPersonId, r.toPersonId]) {
      const entry = touched.get(id) ?? { total: 0, removed: 0 }
      entry.total += 1
      if (r.status === 'removed') entry.removed += 1
      touched.set(id, entry)
    }
  }
  const removed = new Set<string>()
  for (const p of people) {
    const entry = touched.get(p.id)
    if (entry && entry.total > 0 && entry.removed === entry.total) removed.add(p.id)
  }
  return removed
}

/** People left with no relationships at all — candidates for hard pruning. */
export function findDanglingPeople(people: Person[], relationships: Relationship[]) {
  const connected = new Set<string>()
  for (const r of relationships) {
    connected.add(r.fromPersonId)
    connected.add(r.toPersonId)
  }
  return people.filter((p) => !connected.has(p.id)).map((p) => p.id)
}
