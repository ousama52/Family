import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { getDb, isFirebaseConfigured } from './firebase'
import type { Person, Relationship, TreeMeta } from '../types'

export type TreeSnapshot = {
  meta: TreeMeta
  people: Person[]
  relationships: Relationship[]
}

export interface TreeRepository {
  readonly kind: 'firestore' | 'local'
  createTree(snapshot: TreeSnapshot): Promise<void>
  loadTree(treeId: string): Promise<TreeSnapshot | null>
  subscribe(treeId: string, onChange: (snapshot: TreeSnapshot) => void): () => void
  updateTree(treeId: string, patch: Partial<TreeMeta>): Promise<void>
  savePerson(treeId: string, person: Person): Promise<void>
  deletePerson(treeId: string, personId: string): Promise<void>
  saveRelationship(treeId: string, relationship: Relationship): Promise<void>
  deleteRelationship(treeId: string, relationshipId: string): Promise<void>
}

/** Firestore rejects `undefined`, so optional fields are dropped rather than sent. */
function clean<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

// ---------------------------------------------------------------------------
// Firestore — trees/{treeId} with people/ and relationships/ subcollections
// ---------------------------------------------------------------------------

class FirestoreRepository implements TreeRepository {
  readonly kind = 'firestore' as const

  async createTree(snapshot: TreeSnapshot) {
    const db = getDb()!
    const { id, ...meta } = snapshot.meta
    await setDoc(doc(db, 'trees', id), clean(meta))
    await Promise.all([
      ...snapshot.people.map((p) => this.savePerson(id, p)),
      ...snapshot.relationships.map((r) => this.saveRelationship(id, r)),
    ])
  }

  async loadTree(treeId: string): Promise<TreeSnapshot | null> {
    const db = getDb()!
    const treeDoc = await getDoc(doc(db, 'trees', treeId))
    if (!treeDoc.exists()) return null
    const [peopleSnap, relSnap] = await Promise.all([
      getDocs(collection(db, 'trees', treeId, 'people')),
      getDocs(collection(db, 'trees', treeId, 'relationships')),
    ])
    return {
      meta: { id: treeId, ...(treeDoc.data() as Omit<TreeMeta, 'id'>) },
      people: peopleSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Person),
      relationships: relSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Relationship),
    }
  }

  subscribe(treeId: string, onChange: (snapshot: TreeSnapshot) => void) {
    const db = getDb()!
    let meta: TreeMeta | null = null
    let people: Person[] = []
    let relationships: Relationship[] = []
    const emit = () => {
      if (meta) onChange({ meta, people, relationships })
    }
    const unsubs = [
      onSnapshot(doc(db, 'trees', treeId), (d) => {
        if (d.exists()) meta = { id: treeId, ...(d.data() as Omit<TreeMeta, 'id'>) }
        emit()
      }),
      onSnapshot(collection(db, 'trees', treeId, 'people'), (s) => {
        people = s.docs.map((d) => ({ id: d.id, ...d.data() }) as Person)
        emit()
      }),
      onSnapshot(collection(db, 'trees', treeId, 'relationships'), (s) => {
        relationships = s.docs.map((d) => ({ id: d.id, ...d.data() }) as Relationship)
        emit()
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }

  async updateTree(treeId: string, patch: Partial<TreeMeta>) {
    await updateDoc(doc(getDb()!, 'trees', treeId), clean(patch))
  }

  async savePerson(treeId: string, person: Person) {
    const { id, ...rest } = person
    await setDoc(doc(getDb()!, 'trees', treeId, 'people', id), clean(rest))
  }

  async deletePerson(treeId: string, personId: string) {
    await deleteDoc(doc(getDb()!, 'trees', treeId, 'people', personId))
  }

  async saveRelationship(treeId: string, relationship: Relationship) {
    const { id, ...rest } = relationship
    await setDoc(doc(getDb()!, 'trees', treeId, 'relationships', id), clean(rest))
  }

  async deleteRelationship(treeId: string, relationshipId: string) {
    await deleteDoc(doc(getDb()!, 'trees', treeId, 'relationships', relationshipId))
  }
}

// ---------------------------------------------------------------------------
// localStorage fallback — keeps the app fully usable before Firebase is wired
// up, and lets the demo tree run with no backend at all.
// ---------------------------------------------------------------------------

const LOCAL_PREFIX = 'family-tree:'

class LocalRepository implements TreeRepository {
  readonly kind = 'local' as const
  private listeners = new Map<string, Set<(s: TreeSnapshot) => void>>()

  constructor() {
    // Keep multiple tabs of the same tree in sync.
    window.addEventListener('storage', (e) => {
      if (!e.key?.startsWith(LOCAL_PREFIX)) return
      const treeId = e.key.slice(LOCAL_PREFIX.length)
      const snapshot = this.read(treeId)
      if (snapshot) this.listeners.get(treeId)?.forEach((cb) => cb(snapshot))
    })
  }

  private read(treeId: string): TreeSnapshot | null {
    const raw = localStorage.getItem(LOCAL_PREFIX + treeId)
    if (!raw) return null
    try {
      return JSON.parse(raw) as TreeSnapshot
    } catch {
      return null
    }
  }

  private write(treeId: string, snapshot: TreeSnapshot) {
    localStorage.setItem(LOCAL_PREFIX + treeId, JSON.stringify(snapshot))
    this.listeners.get(treeId)?.forEach((cb) => cb(snapshot))
  }

  private mutate(treeId: string, fn: (s: TreeSnapshot) => TreeSnapshot) {
    const current = this.read(treeId)
    if (!current) return
    this.write(treeId, fn(current))
  }

  async createTree(snapshot: TreeSnapshot) {
    this.write(snapshot.meta.id, snapshot)
  }

  async loadTree(treeId: string) {
    return this.read(treeId)
  }

  subscribe(treeId: string, onChange: (snapshot: TreeSnapshot) => void) {
    const set = this.listeners.get(treeId) ?? new Set()
    set.add(onChange)
    this.listeners.set(treeId, set)
    const current = this.read(treeId)
    if (current) onChange(current)
    return () => set.delete(onChange)
  }

  async updateTree(treeId: string, patch: Partial<TreeMeta>) {
    this.mutate(treeId, (s) => ({ ...s, meta: { ...s.meta, ...patch } }))
  }

  async savePerson(treeId: string, person: Person) {
    this.mutate(treeId, (s) => ({
      ...s,
      people: [...s.people.filter((p) => p.id !== person.id), person],
    }))
  }

  async deletePerson(treeId: string, personId: string) {
    this.mutate(treeId, (s) => ({ ...s, people: s.people.filter((p) => p.id !== personId) }))
  }

  async saveRelationship(treeId: string, relationship: Relationship) {
    this.mutate(treeId, (s) => ({
      ...s,
      relationships: [...s.relationships.filter((r) => r.id !== relationship.id), relationship],
    }))
  }

  async deleteRelationship(treeId: string, relationshipId: string) {
    this.mutate(treeId, (s) => ({
      ...s,
      relationships: s.relationships.filter((r) => r.id !== relationshipId),
    }))
  }
}

let repository: TreeRepository | null = null

export function getRepository(): TreeRepository {
  if (!repository) {
    repository = isFirebaseConfigured ? new FirestoreRepository() : new LocalRepository()
  }
  return repository
}

/** Tree ids the browser has seen, so the landing page can offer them again. */
export function listLocalTreeIds(): string[] {
  const ids: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(LOCAL_PREFIX)) ids.push(key.slice(LOCAL_PREFIX.length))
  }
  return ids
}
