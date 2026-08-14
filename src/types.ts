export type Person = {
  id: string
  name: string
  birthDate?: string
  deathDate?: string
  photoUrl?: string
  notes?: string
  /** Index into the theme's frame-variant list, chosen at creation for visual variety. */
  frameVariant?: number
  /** Marks the "you" node — rendered with the theme's accent ring. */
  isSelf?: boolean
  createdAt?: number
}

export type RelationshipType = 'parent' | 'spouse' | 'sibling'

/** 'removed' = soft-removed: still rendered, using the active theme's removal effect. */
export type RelationshipStatus = 'active' | 'removed'

export type Relationship = {
  id: string
  /** For 'parent': fromPersonId is the parent, toPersonId is the child. */
  fromPersonId: string
  toPersonId: string
  type: RelationshipType
  status: RelationshipStatus
  createdAt: number
}

export type TreeMeta = {
  id: string
  name: string
  passcodeHash: string
  themeId: ThemeId
  rootPersonId?: string
  createdAt: number
}

export type ThemeId = 'celestial' | 'medieval' | 'wuxia'

export type FilterMode = 'all' | 'living' | 'removed'

/** Relation the user picks in the Add Relative modal, expressed relative to an anchor person. */
export type AddRelation = 'parent' | 'child' | 'spouse' | 'sibling'

// ---------------------------------------------------------------------------
// Layout output
// ---------------------------------------------------------------------------

export type NodePosition = {
  personId: string
  x: number
  y: number
  depth: number
  /** Radius scale factor: trunk-side generations render slightly larger. */
  scale: number
  /** True when every relationship touching this person is soft-removed. */
  removed: boolean
}

/** A drawn connector. `junction` links are the little star/knot where a couple's
 *  branches merge before fanning out to their children. */
export type BranchLink = {
  id: string
  relationshipId: string | null
  kind: 'parent' | 'spouse' | 'sibling' | 'stem'
  from: { x: number; y: number }
  to: { x: number; y: number }
  /** People this branch connects, so filters can dim it with its endpoints. */
  endpoints: string[]
  /** Generation depth used to taper stroke width — lower = closer to the trunk. */
  depth: number
  status: RelationshipStatus
  /** Sideways bias for the bezier control points, -1..1. */
  bend: number
}

export type Junction = {
  id: string
  x: number
  y: number
  depth: number
  status: RelationshipStatus
}

export type LayoutResult = {
  nodes: NodePosition[]
  links: BranchLink[]
  junctions: Junction[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  /** personId -> node, for quick lookup by consumers. */
  byId: Record<string, NodePosition>
}
