import { useRef, useState } from 'react'
import { readPortrait } from '../lib/photo'
import type { Theme } from '../themes/themes'
import type { AddRelation, Person } from '../types'
import { Modal } from './Modal'

const RELATIONS: { key: AddRelation; label: string; hint: (name: string) => string }[] = [
  { key: 'parent', label: 'Parent', hint: (n) => `A mother or father of ${n}` },
  { key: 'child', label: 'Child', hint: (n) => `A son or daughter of ${n}` },
  { key: 'spouse', label: 'Spouse', hint: (n) => `A partner of ${n}` },
  { key: 'sibling', label: 'Sibling', hint: (n) => `A brother or sister of ${n}` },
]

type Props = {
  theme: Theme
  anchor: Person
  onClose: () => void
  onSubmit: (relation: AddRelation, input: {
    name: string
    birthDate?: string
    deathDate?: string
    photoUrl?: string
    notes?: string
  }) => Promise<void>
}

export function AddRelativeModal({ theme, anchor, onClose, onSubmit }: Props) {
  const [relation, setRelation] = useState<AddRelation>('child')
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [deathDate, setDeathDate] = useState('')
  const [notes, setNotes] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return
    try {
      setPhotoUrl(await readPortrait(file))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that photo.')
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('A name is needed to grow the branch.')
      return
    }
    setBusy(true)
    try {
      await onSubmit(relation, {
        name,
        birthDate: birthDate.trim() || undefined,
        deathDate: deathDate.trim() || undefined,
        photoUrl,
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that relative.')
      setBusy(false)
    }
  }

  return (
    <Modal theme={theme} title="Add a relative" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="form__lead">
          Growing a new branch from <strong>{anchor.name}</strong>.
        </p>

        <fieldset className="relation-picker">
          <legend className="field__label">Relationship</legend>
          <div className="relation-picker__grid">
            {RELATIONS.map((option) => (
              <button
                type="button"
                key={option.key}
                className={`relation-chip${relation === option.key ? ' is-active' : ''}`}
                onClick={() => setRelation(option.key)}
                aria-pressed={relation === option.key}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="form__hint">{RELATIONS.find((r) => r.key === relation)!.hint(anchor.name)}</p>
        </fieldset>

        <label className="field">
          <span className="field__label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Full name" />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field__label">Born</span>
            <input value={birthDate} onChange={(e) => setBirthDate(e.target.value)} placeholder="1962" />
          </label>
          <label className="field">
            <span className="field__label">Died</span>
            <input value={deathDate} onChange={(e) => setDeathDate(e.target.value)} placeholder="—" />
          </label>
        </div>

        <div className="field">
          <span className="field__label">Portrait</span>
          <div className="photo-row">
            <div className="photo-preview" aria-hidden="true">
              {photoUrl ? <img src={photoUrl} alt="" /> : <span className="photo-preview__empty">Photo</span>}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handlePhoto(e.target.files?.[0])}
            />
            <button type="button" className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
              {photoUrl ? 'Change photo' : 'Choose photo'}
            </button>
            {photoUrl && (
              <button type="button" className="btn btn--ghost" onClick={() => setPhotoUrl(undefined)}>
                Remove
              </button>
            )}
          </div>
        </div>

        <label className="field">
          <span className="field__label">Notes</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering" />
        </label>

        {error && <p className="form__error" role="alert">{error}</p>}

        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Growing…' : 'Grow branch'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
