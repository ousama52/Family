import { useState } from 'react'
import { THEME_LIST, type Theme } from '../themes/themes'
import type { ThemeId, TreeMeta } from '../types'
import { Modal } from './Modal'

type Props = {
  theme: Theme
  meta: TreeMeta
  canEdit: boolean
  storageKind: 'firestore' | 'local'
  onClose: () => void
  onPickTheme: (id: ThemeId) => void
  onUnlock: (passcode: string) => Promise<boolean>
  onLeave: () => void
}

const SWATCHES: Record<ThemeId, string[]> = {
  celestial: ['#0a0620', '#6f9dff', '#f2d492'],
  medieval: ['#c8ad82', '#5b4025', '#8a6224'],
  wuxia: ['#f2efe8', '#2b2b2e', '#a8322a'],
}

export function SettingsPanel({
  theme,
  meta,
  canEdit,
  storageKind,
  onClose,
  onPickTheme,
  onUnlock,
  onLeave,
}: Props) {
  const [passcode, setPasscode] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const shareLink = `${window.location.origin}${window.location.pathname}#/tree/${meta.id}`

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      setCopied(null)
    }
  }

  return (
    <Modal theme={theme} title="Settings" onClose={onClose} variant="sheet">
      <section className="settings-section">
        <h3 className="settings-heading">Theme</h3>
        <p className="form__hint">
          Switching theme only swaps how the tree is drawn — the family itself is untouched.
        </p>
        <div className="theme-grid">
          {THEME_LIST.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`theme-card${option.id === theme.id ? ' is-active' : ''}`}
              onClick={() => onPickTheme(option.id)}
              aria-pressed={option.id === theme.id}
            >
              <span className="theme-card__swatches" aria-hidden="true">
                {SWATCHES[option.id].map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </span>
              <span className="theme-card__name">{option.name}</span>
              <span className="theme-card__tagline">{option.tagline}</span>
            </button>
          ))}
        </div>
        {!canEdit && (
          <p className="form__hint">
            You are previewing this theme locally. Unlock the tree to set it for everyone.
          </p>
        )}
      </section>

      <section className="settings-section">
        <h3 className="settings-heading">Share this tree</h3>
        <label className="field">
          <span className="field__label">Tree code</span>
          <div className="copy-row">
            <input readOnly value={meta.id} />
            <button type="button" className="btn btn--ghost" onClick={() => copy(meta.id, 'code')}>
              Copy
            </button>
          </div>
        </label>
        <label className="field">
          <span className="field__label">Link</span>
          <div className="copy-row">
            <input readOnly value={shareLink} />
            <button type="button" className="btn btn--ghost" onClick={() => copy(shareLink, 'link')}>
              Copy
            </button>
          </div>
        </label>
        {copied && <p className="form__hint">Copied the {copied} to your clipboard.</p>}
        <p className="form__hint">
          Anyone with the link can view the tree. Only people who know the edit passcode can add,
          edit or remove relatives.
        </p>
      </section>

      <section className="settings-section">
        <h3 className="settings-heading">Edit access</h3>
        {canEdit ? (
          <p className="form__hint">
            This tree is unlocked for editing on this device.
          </p>
        ) : (
          <form
            className="copy-row"
            onSubmit={async (e) => {
              e.preventDefault()
              const ok = await onUnlock(passcode)
              setUnlockError(ok ? null : 'That passcode does not match.')
              if (ok) setPasscode('')
            }}
          >
            <input
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Edit passcode"
              aria-label="Edit passcode"
            />
            <button type="submit" className="btn btn--primary">
              Unlock
            </button>
          </form>
        )}
        {unlockError && <p className="form__error" role="alert">{unlockError}</p>}
      </section>

      <section className="settings-section">
        <h3 className="settings-heading">Storage</h3>
        <p className="form__hint">
          {storageKind === 'firestore'
            ? 'Saved to Firebase Firestore and shared live with everyone holding the link.'
            : 'Firebase is not configured, so this tree is saved in this browser only. Set the VITE_FIREBASE_* variables to sync it across devices.'}
        </p>
        <button type="button" className="btn btn--ghost" onClick={onLeave}>
          Close this tree
        </button>
      </section>
    </Modal>
  )
}
