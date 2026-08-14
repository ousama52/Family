import { useEffect, useRef } from 'react'
import type { Theme } from '../themes/themes'

type Props = {
  theme: Theme
  title: string
  onClose: () => void
  children: React.ReactNode
  /** Slides up from the bottom edge instead of centring — used for the settings panel. */
  variant?: 'center' | 'sheet'
}

export function Modal({ title, onClose, children, variant = 'center' }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={`modal modal--${variant}`} onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className="modal__panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button type="button" className="icon-btn icon-btn--bare" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}
