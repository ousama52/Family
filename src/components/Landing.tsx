import { useState } from 'react'
import { suggestPasscode } from '../lib/passcode'
import { listLocalTreeIds } from '../lib/storage'
import { useTreeStore } from '../state/useTreeStore'
import { THEME_LIST, getTheme } from '../themes/themes'
import type { ThemeId } from '../types'
import { ThemeBackdrop } from './ThemeBackdrop'

export function Landing() {
  const { createTree, openTree, unlock, status, error } = useTreeStore()
  const [mode, setMode] = useState<'create' | 'open'>('create')
  const [name, setName] = useState('')
  const [themeId, setThemeId] = useState<ThemeId>('celestial')
  const [passcode, setPasscode] = useState(() => suggestPasscode())
  const [withDemo, setWithDemo] = useState(true)
  const [openCode, setOpenCode] = useState('')
  const [openPass, setOpenPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const theme = getTheme(themeId)
  const recent = listLocalTreeIds()

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passcode.trim().length < 4) {
      setLocalError('Use a passcode of at least 4 characters.')
      return
    }
    setBusy(true)
    setLocalError(null)
    try {
      await createTree(name, passcode, themeId, withDemo)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not create that tree.')
    } finally {
      setBusy(false)
    }
  }

  const submitOpen = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setLocalError(null)
    try {
      const found = await openTree(openCode.trim())
      // The passcode is optional here: without it you get a read-only view.
      if (found && openPass.trim()) {
        const ok = await unlock(openPass)
        if (!ok) setLocalError('Opened read-only — that passcode did not match.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`screen screen--landing theme-${theme.id}`}>
      <ThemeBackdrop theme={theme} />

      <div className="landing">
        <header className="landing__head">
          <h1 className="landing__title">{theme.chrome.defaultTreeName}</h1>
          <p className="landing__tagline">{theme.tagline}</p>
        </header>

        <div className="landing__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'create'}
            className={mode === 'create' ? 'is-active' : ''}
            onClick={() => setMode('create')}
          >
            Create a tree
          </button>
          <button
            role="tab"
            aria-selected={mode === 'open'}
            className={mode === 'open' ? 'is-active' : ''}
            onClick={() => setMode('open')}
          >
            Open existing
          </button>
        </div>

        {mode === 'create' ? (
          <form className="form landing__form" onSubmit={submitCreate}>
            <label className="field">
              <span className="field__label">Tree name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={theme.chrome.defaultTreeName}
              />
            </label>

            <div className="field">
              <span className="field__label">Theme</span>
              <div className="landing__themes">
                {THEME_LIST.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`theme-chip${option.id === themeId ? ' is-active' : ''}`}
                    onClick={() => setThemeId(option.id)}
                    aria-pressed={option.id === themeId}
                  >
                    <img src={option.background.image} alt="" aria-hidden="true" />
                    <span>{option.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span className="field__label">Edit passcode</span>
              <div className="copy-row">
                <input value={passcode} onChange={(e) => setPasscode(e.target.value)} />
                <button type="button" className="btn btn--ghost" onClick={() => setPasscode(suggestPasscode())}>
                  New code
                </button>
              </div>
              <span className="form__hint">
                Anyone with the link can look. Only people with this passcode can change the tree —
                write it down, it cannot be recovered.
              </span>
            </label>

            <label className="checkbox">
              <input type="checkbox" checked={withDemo} onChange={(e) => setWithDemo(e.target.checked)} />
              <span>Start with the example family, so there is something to explore</span>
            </label>

            {(localError || error) && <p className="form__error" role="alert">{localError ?? error}</p>}

            <button type="submit" className="btn btn--primary btn--wide" disabled={busy}>
              {busy ? 'Planting…' : 'Plant this tree'}
            </button>
          </form>
        ) : (
          <form className="form landing__form" onSubmit={submitOpen}>
            <label className="field">
              <span className="field__label">Tree code</span>
              <input
                value={openCode}
                onChange={(e) => setOpenCode(e.target.value)}
                placeholder="abcd-efgh"
                autoFocus
              />
            </label>
            <label className="field">
              <span className="field__label">Edit passcode (optional)</span>
              <input
                value={openPass}
                onChange={(e) => setOpenPass(e.target.value)}
                placeholder="Leave blank to just look"
              />
            </label>

            {(localError || error) && <p className="form__error" role="alert">{localError ?? error}</p>}

            <button type="submit" className="btn btn--primary btn--wide" disabled={busy || status === 'loading'}>
              {status === 'loading' ? 'Opening…' : 'Open tree'}
            </button>

            {recent.length > 0 && (
              <div className="landing__recent">
                <span className="field__label">On this device</span>
                <ul>
                  {recent.map((id) => (
                    <li key={id}>
                      <button type="button" onClick={() => void openTree(id)}>
                        {id}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
