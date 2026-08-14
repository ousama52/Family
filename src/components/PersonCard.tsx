import { useRef, useState } from 'react'
import { readPortrait } from '../lib/photo'
import type { Theme } from '../themes/themes'
import type { Person } from '../types'
import { Modal } from './Modal'

type Props = {
  theme: Theme
  person: Person
  removed: boolean
  canEdit: boolean
  onClose: () => void
  onAddRelative: () => void
  onSave: (patch: Partial<Person>) => Promise<void>
  onSoftRemove: () => Promise<void>
  onRestore: () => Promise<void>
  onHardPrune: () => Promise<void>
}

const REMOVAL_COPY: Record<Theme['removal'], { verb: string; blurb: string }> = {
  shatter: {
    verb: 'shatter',
    blurb: 'Their node fragments into drifting shards and the branch turns grey — nothing is deleted.',
  },
  'crack-shatter': {
    verb: 'crack',
    blurb: 'Their frame cracks and falls away and the branch below splinters — nothing is deleted.',
  },
  'ink-slash': {
    verb: 'strike through',
    blurb: 'A red ink slash is drawn across their portrait — nothing is deleted.',
  },
}

export function PersonCard({
  theme,
  person,
  removed,
  canEdit,
  onClose,
  onAddRelative,
  onSave,
  onSoftRemove,
  onRestore,
  onHardPrune,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmPrune, setConfirmPrune] = useState(false)
  const [draft, setDraft] = useState<Person>(person)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const copy = REMOVAL_COPY[theme.removal]

  const lifespan = person.deathDate
    ? `${person.birthDate ?? '?'} – ${person.deathDate}`
    : person.birthDate
      ? `${person.birthDate} –`
      : ''

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return
    try {
      setDraft({ ...draft, photoUrl: await readPortrait(file) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that photo.')
    }
  }

  return (
    <Modal theme={theme} title={editing ? `Edit ${person.name}` : person.name} onClose={onClose}>
      {!editing ? (
        <div className="person-card">
          <div className="person-card__hero">
            <div className={`person-card__portrait${removed ? ' is-removed' : ''}`}>
              {person.photoUrl ? (
                <img src={person.photoUrl} alt={person.name} />
              ) : (
                <span>{person.name.trim()[0] ?? '?'}</span>
              )}
            </div>
            <div>
              <h3 className="person-card__name">{person.name}</h3>
              {lifespan && <p className="person-card__dates">{lifespan}</p>}
              <div className="person-card__tags">
                {removed && <span className="tag tag--removed">Removed</span>}
                {person.deathDate && !removed && <span className="tag">Passed</span>}
                {person.isSelf && <span className="tag tag--accent">You</span>}
              </div>
            </div>
          </div>

          {person.notes && <p className="person-card__notes">{person.notes}</p>}

          {!canEdit && (
            <p className="form__hint">
              You are viewing this tree. Enter the edit passcode in Settings to make changes.
            </p>
          )}

          {error && <p className="form__error" role="alert">{error}</p>}

          {canEdit && (
            <div className="person-card__actions">
              <button className="btn btn--primary" onClick={onAddRelative}>
                Add a relative here
              </button>
              <button className="btn btn--ghost" onClick={() => { setDraft(person); setEditing(true) }}>
                Edit
              </button>

              {removed ? (
                <button className="btn btn--ghost" disabled={busy} onClick={() => run(onRestore)}>
                  Regrow this branch
                </button>
              ) : (
                <button className="btn btn--warn" disabled={busy} onClick={() => run(onSoftRemove)}>
                  Remove this relative
                </button>
              )}

              {!removed && <p className="form__hint">{copy.blurb}</p>}

              {removed &&
                (confirmPrune ? (
                  <div className="danger-zone">
                    <p>
                      Prune <strong>{person.name}</strong> for good? The branch crumbles away and
                      their record is deleted. This cannot be undone.
                    </p>
                    <div className="form__actions">
                      <button className="btn btn--ghost" onClick={() => setConfirmPrune(false)}>
                        Keep them
                      </button>
                      <button className="btn btn--danger" disabled={busy} onClick={() => run(onHardPrune)}>
                        Prune permanently
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="btn btn--danger-ghost" onClick={() => setConfirmPrune(true)}>
                    Prune permanently…
                  </button>
                ))}
            </div>
          )}
        </div>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              await onSave({
                name: draft.name.trim() || person.name,
                birthDate: draft.birthDate?.trim() || undefined,
                deathDate: draft.deathDate?.trim() || undefined,
                notes: draft.notes?.trim() || undefined,
                photoUrl: draft.photoUrl,
              })
              setEditing(false)
            })
          }}
        >
          <label className="field">
            <span className="field__label">Name</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <div className="field-row">
            <label className="field">
              <span className="field__label">Born</span>
              <input
                value={draft.birthDate ?? ''}
                onChange={(e) => setDraft({ ...draft, birthDate: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">Died</span>
              <input
                value={draft.deathDate ?? ''}
                onChange={(e) => setDraft({ ...draft, deathDate: e.target.value })}
              />
            </label>
          </div>
          <div className="field">
            <span className="field__label">Portrait</span>
            <div className="photo-row">
              <div className="photo-preview" aria-hidden="true">
                {draft.photoUrl ? <img src={draft.photoUrl} alt="" /> : <span className="photo-preview__empty">Photo</span>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => handlePhoto(e.target.files?.[0])} />
              <button type="button" className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
                {draft.photoUrl ? 'Change' : 'Choose photo'}
              </button>
              {draft.photoUrl && (
                <button type="button" className="btn btn--ghost" onClick={() => setDraft({ ...draft, photoUrl: undefined })}>
                  Remove
                </button>
              )}
            </div>
          </div>
          <label className="field">
            <span className="field__label">Notes</span>
            <textarea
              rows={3}
              value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
          {error && <p className="form__error" role="alert">{error}</p>}
          <div className="form__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              Save
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
