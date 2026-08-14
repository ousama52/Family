import { create } from 'zustand'
import { newId, newTreeId } from '../lib/id'
import { hashPasscode, verifyPasscode } from '../lib/passcode'
import { buildSeedTree } from '../lib/seed'
import { getRepository } from '../lib/storage'
import { findDanglingPeople } from '../lib/layout'
import { getTheme } from '../themes/themes'
import type {
  AddRelation,
  FilterMode,
  Person,
  Relationship,
  ThemeId,
  TreeMeta,
} from '../types'

export type Screen = 'landing' | 'tree'

type NewPersonInput = {
  name: string
  birthDate?: string
  deathDate?: string
  photoUrl?: string
  notes?: string
}

type TreeState = {
  screen: Screen
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null

  treeId: string | null
  meta: TreeMeta | null
  people: Person[]
  relationships: Relationship[]

  themeId: ThemeId
  filter: FilterMode
  selectedPersonId: string | null
  canEdit: boolean

  /** Relationship ids currently playing the branch-growth animation. */
  growing: string[]
  /** Person ids currently playing the pop-in animation. */
  popping: string[]
  /** Person ids currently playing the theme's removal effect. */
  removing: string[]
  /** Person ids fading out ahead of a hard prune. */
  pruning: string[]

  createTree: (name: string, passcode: string, themeId: ThemeId, withDemo: boolean) => Promise<string>
  openTree: (treeId: string) => Promise<boolean>
  unlock: (passcode: string) => Promise<boolean>
  leaveTree: () => void

  setTheme: (themeId: ThemeId) => void
  setFilter: (filter: FilterMode) => void
  select: (personId: string | null) => void

  /** Resolves with the new person's id, so the canvas can pan to them. */
  addRelative: (anchorId: string, relation: AddRelation, input: NewPersonInput) => Promise<string>
  updatePerson: (personId: string, patch: Partial<Person>) => Promise<void>
  softRemovePerson: (personId: string) => Promise<void>
  restorePerson: (personId: string) => Promise<void>
  hardPrunePerson: (personId: string) => Promise<void>
}

let unsubscribe: (() => void) | null = null

const GROWTH_MS = 1100
const POP_MS = 900
const SHATTER_MS = 1400
const PRUNE_MS = 900

export const useTreeStore = create<TreeState>((set, get) => {
  /** Runs an animation flag for `ms`, then clears just the ids it added. */
  const flag = (key: 'growing' | 'popping' | 'removing' | 'pruning', ids: string[], ms: number) => {
    if (!ids.length) return
    set((s) => ({ [key]: [...s[key], ...ids] }) as Partial<TreeState>)
    window.setTimeout(() => {
      set((s) => ({ [key]: s[key].filter((id) => !ids.includes(id)) }) as Partial<TreeState>)
    }, ms)
  }

  const requireEdit = () => {
    if (!get().canEdit) throw new Error('This tree is locked. Enter the edit passcode to make changes.')
    const treeId = get().treeId
    if (!treeId) throw new Error('No tree is open.')
    return treeId
  }

  return {
    screen: 'landing',
    status: 'idle',
    error: null,
    treeId: null,
    meta: null,
    people: [],
    relationships: [],
    themeId: 'celestial',
    filter: 'all',
    selectedPersonId: null,
    canEdit: false,
    growing: [],
    popping: [],
    removing: [],
    pruning: [],

    async createTree(name, passcode, themeId, withDemo) {
      const repo = getRepository()
      const treeId = newTreeId()
      const passcodeHash = await hashPasscode(treeId, passcode)
      const seed = withDemo ? buildSeedTree(getTheme(themeId).node.frameAssets.length) : null

      const meta: TreeMeta = {
        id: treeId,
        name: name.trim() || getTheme(themeId).chrome.defaultTreeName,
        passcodeHash,
        themeId,
        rootPersonId: seed?.rootPersonId,
        createdAt: Date.now(),
      }

      await repo.createTree({
        meta,
        people: seed?.people ?? [],
        relationships: seed?.relationships ?? [],
      })

      set({
        treeId,
        meta,
        themeId,
        people: seed?.people ?? [],
        relationships: seed?.relationships ?? [],
        canEdit: true,
        screen: 'tree',
        status: 'ready',
        error: null,
        selectedPersonId: null,
      })

      unsubscribe?.()
      unsubscribe = repo.subscribe(treeId, (snapshot) => {
        set({
          meta: snapshot.meta,
          people: snapshot.people,
          relationships: snapshot.relationships,
          themeId: snapshot.meta.themeId ?? get().themeId,
        })
      })

      return treeId
    },

    async openTree(treeId) {
      set({ status: 'loading', error: null })
      const repo = getRepository()
      try {
        const snapshot = await repo.loadTree(treeId)
        if (!snapshot) {
          set({ status: 'error', error: `No tree found for code "${treeId}".` })
          return false
        }
        set({
          treeId,
          meta: snapshot.meta,
          people: snapshot.people,
          relationships: snapshot.relationships,
          themeId: snapshot.meta.themeId ?? 'celestial',
          canEdit: false,
          screen: 'tree',
          status: 'ready',
          selectedPersonId: null,
        })
        unsubscribe?.()
        unsubscribe = repo.subscribe(treeId, (next) => {
          set({
            meta: next.meta,
            people: next.people,
            relationships: next.relationships,
            themeId: next.meta.themeId ?? get().themeId,
          })
        })
        return true
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : 'Could not open tree.' })
        return false
      }
    },

    async unlock(passcode) {
      const { treeId, meta } = get()
      if (!treeId || !meta) return false
      const ok = await verifyPasscode(treeId, passcode, meta.passcodeHash)
      if (ok) set({ canEdit: true, error: null })
      return ok
    },

    leaveTree() {
      unsubscribe?.()
      unsubscribe = null
      set({
        screen: 'landing',
        treeId: null,
        meta: null,
        people: [],
        relationships: [],
        canEdit: false,
        selectedPersonId: null,
        status: 'idle',
        error: null,
      })
    },

    setTheme(themeId) {
      set({ themeId })
      const { treeId, canEdit } = get()
      // Viewers may preview a theme locally; only editors change it for everyone.
      if (treeId && canEdit) void getRepository().updateTree(treeId, { themeId })
    },

    setFilter(filter) {
      set({ filter })
    },

    select(personId) {
      set({ selectedPersonId: personId })
    },

    async addRelative(anchorId, relation, input) {
      const treeId = requireEdit()
      const repo = getRepository()
      const theme = getTheme(get().themeId)
      const now = Date.now()

      const person: Person = {
        id: newId(),
        name: input.name.trim(),
        birthDate: input.birthDate || undefined,
        deathDate: input.deathDate || undefined,
        photoUrl: input.photoUrl || undefined,
        notes: input.notes || undefined,
        frameVariant: Math.floor(Math.random() * theme.node.frameAssets.length),
        createdAt: now,
      }

      const rel = (from: string, to: string, type: Relationship['type']): Relationship => ({
        id: newId(),
        fromPersonId: from,
        toPersonId: to,
        type,
        status: 'active',
        createdAt: now,
      })

      const { relationships } = get()
      const created: Relationship[] = []

      if (relation === 'parent') {
        created.push(rel(person.id, anchorId, 'parent'))
        // A second parent joins the existing one as a couple, so the child keeps
        // hanging from a single shared junction.
        const otherParents = relationships
          .filter((r) => r.type === 'parent' && r.toPersonId === anchorId)
          .map((r) => r.fromPersonId)
        if (otherParents.length === 1) created.push(rel(otherParents[0], person.id, 'spouse'))
      } else if (relation === 'child') {
        created.push(rel(anchorId, person.id, 'parent'))
        // Children are born to a couple: give the anchor's spouse the same link.
        for (const r of relationships) {
          if (r.type !== 'spouse' || r.status !== 'active') continue
          if (r.fromPersonId === anchorId) created.push(rel(r.toPersonId, person.id, 'parent'))
          else if (r.toPersonId === anchorId) created.push(rel(r.fromPersonId, person.id, 'parent'))
        }
      } else if (relation === 'spouse') {
        created.push(rel(anchorId, person.id, 'spouse'))
      } else {
        created.push(rel(anchorId, person.id, 'sibling'))
        // Share the anchor's parents so the new sibling grows from the same branch.
        for (const r of relationships) {
          if (r.type === 'parent' && r.toPersonId === anchorId && r.status === 'active') {
            created.push(rel(r.fromPersonId, person.id, 'parent'))
          }
        }
      }

      set((s) => ({
        people: [...s.people, person],
        relationships: [...s.relationships, ...created],
      }))

      flag('growing', created.map((r) => r.id), GROWTH_MS)
      flag('popping', [person.id], POP_MS)

      await repo.savePerson(treeId, person)
      await Promise.all(created.map((r) => repo.saveRelationship(treeId, r)))
      return person.id
    },

    async updatePerson(personId, patch) {
      const treeId = requireEdit()
      const current = get().people.find((p) => p.id === personId)
      if (!current) return
      const next: Person = { ...current, ...patch }
      set((s) => ({ people: s.people.map((p) => (p.id === personId ? next : p)) }))
      await getRepository().savePerson(treeId, next)
    },

    /** Stage one of removal: every tie to this person goes dotted / withered,
     *  the node plays the theme's removal effect, and nothing is deleted. */
    async softRemovePerson(personId) {
      const treeId = requireEdit()
      const repo = getRepository()
      const touched = get().relationships.filter(
        (r) => (r.fromPersonId === personId || r.toPersonId === personId) && r.status === 'active',
      )
      const updated = touched.map((r) => ({ ...r, status: 'removed' as const }))
      set((s) => ({
        relationships: s.relationships.map(
          (r) => updated.find((u) => u.id === r.id) ?? r,
        ),
      }))
      flag('removing', [personId], SHATTER_MS)
      await Promise.all(updated.map((r) => repo.saveRelationship(treeId, r)))
    },

    async restorePerson(personId) {
      const treeId = requireEdit()
      const repo = getRepository()
      const touched = get().relationships.filter(
        (r) => (r.fromPersonId === personId || r.toPersonId === personId) && r.status === 'removed',
      )
      const updated = touched.map((r) => ({ ...r, status: 'active' as const }))
      set((s) => ({
        relationships: s.relationships.map((r) => updated.find((u) => u.id === r.id) ?? r),
      }))
      flag('growing', updated.map((r) => r.id), GROWTH_MS)
      flag('popping', [personId], POP_MS)
      await Promise.all(updated.map((r) => repo.saveRelationship(treeId, r)))
    },

    /** Stage two: the branch crumbles away and the records are deleted. Any
     *  person left with no connections at all goes with it. */
    async hardPrunePerson(personId) {
      const treeId = requireEdit()
      const repo = getRepository()
      const { people, relationships } = get()

      const doomedRels = relationships.filter(
        (r) => r.fromPersonId === personId || r.toPersonId === personId,
      )
      const remainingRels = relationships.filter(
        (r) => r.fromPersonId !== personId && r.toPersonId !== personId,
      )
      const remainingPeople = people.filter((p) => p.id !== personId)
      const dangling = findDanglingPeople(remainingPeople, remainingRels).filter((id) => {
        // Only sweep away people this prune actually orphaned.
        return doomedRels.some((r) => r.fromPersonId === id || r.toPersonId === id)
      })
      const doomedPeople = [personId, ...dangling]

      flag('pruning', doomedPeople, PRUNE_MS)
      set({ selectedPersonId: null })

      await new Promise((resolve) => window.setTimeout(resolve, PRUNE_MS - 100))

      set((s) => ({
        people: s.people.filter((p) => !doomedPeople.includes(p.id)),
        relationships: s.relationships.filter((r) => !doomedRels.some((d) => d.id === r.id)),
      }))

      await Promise.all([
        ...doomedRels.map((r) => repo.deleteRelationship(treeId, r.id)),
        ...doomedPeople.map((id) => repo.deletePerson(treeId, id)),
      ])
    },
  }
})
