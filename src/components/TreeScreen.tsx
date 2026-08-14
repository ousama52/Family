import { useCallback, useMemo, useRef, useState } from 'react'
import { computeRemovedPeople } from '../lib/layout'
import { getRepository } from '../lib/storage'
import { useTreeStore } from '../state/useTreeStore'
import { getTheme } from '../themes/themes'
import type { FilterMode } from '../types'
import { AddRelativeModal } from './AddRelativeModal'
import { Icon, type IconName } from './icons'
import { PersonCard } from './PersonCard'
import { SettingsPanel } from './SettingsPanel'
import { ThemeBackdrop } from './ThemeBackdrop'
import { TreeCanvas, type CanvasHandle } from './TreeCanvas'

const NAV_ICONS: Record<string, IconName> = {
  tree: 'tree',
  people: 'people',
  timeline: 'timeline',
  memories: 'memories',
  skills: 'skills',
  more: 'more',
}

export function TreeScreen() {
  const {
    meta,
    people,
    relationships,
    themeId,
    filter,
    selectedPersonId,
    canEdit,
    growing,
    popping,
    removing,
    pruning,
    setFilter,
    setTheme,
    select,
    addRelative,
    updatePerson,
    softRemovePerson,
    restorePerson,
    hardPrunePerson,
    unlock,
    leaveTree,
  } = useTreeStore()

  const theme = getTheme(themeId)
  const canvas = useRef<CanvasHandle | null>(null)
  const onReady = useCallback((handle: CanvasHandle) => {
    canvas.current = handle
  }, [])

  const [showSettings, setShowSettings] = useState(false)
  const [addAnchorId, setAddAnchorId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeNav, setActiveNav] = useState('tree')
  const [toast, setToast] = useState<string | null>(null)

  const removedPeople = useMemo(
    () => computeRemovedPeople(people, relationships),
    [people, relationships],
  )
  const selected = people.find((p) => p.id === selectedPersonId) ?? null
  const addAnchor = people.find((p) => p.id === addAnchorId) ?? null

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, people])

  const flashToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  const requireEdit = (action: () => void) => {
    if (!canEdit) {
      setShowSettings(true)
      flashToast('Enter the edit passcode to change this tree.')
      return
    }
    action()
  }

  if (!meta) return null

  const counts: Record<FilterMode, number> = {
    all: people.length,
    living: people.filter((p) => !p.deathDate && !removedPeople.has(p.id)).length,
    removed: removedPeople.size,
  }

  return (
    <div className={`screen screen--tree theme-${theme.id}`}>
      <ThemeBackdrop theme={theme} />

      <TreeCanvas
        people={people}
        relationships={relationships}
        theme={theme}
        filter={filter}
        selectedPersonId={selectedPersonId}
        rootPersonId={meta.rootPersonId}
        growing={growing}
        popping={popping}
        removing={removing}
        pruning={pruning}
        onSelect={select}
        onReady={onReady}
      />

      {/* ---------------------------------------------------------------- */}
      <header className="topbar">
        <button className="icon-btn" onClick={leaveTree} aria-label="Back to trees">
          <Icon name="back" theme={theme.id} size={26} />
          {theme.chrome.backLabel && <span className="icon-btn__caption">{theme.chrome.backLabel}</span>}
        </button>
        <h1 className="topbar__title">{meta.name}</h1>
        <button
          className="icon-btn"
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
        >
          <Icon name={theme.id === 'medieval' ? 'settings' : 'menu'} theme={theme.id} size={26} />
          {theme.chrome.menuLabel && <span className="icon-btn__caption">{theme.chrome.menuLabel}</span>}
          {!canEdit && <span className="icon-btn__dot" aria-hidden="true" />}
        </button>
      </header>

      <nav className={`filter-pills filter-pills--${theme.chrome.pillStyle}`} aria-label="Filter people">
        {(['all', 'living', 'removed'] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            className={`pill${filter === mode ? ' is-active' : ''}`}
            onClick={() => setFilter(mode)}
            aria-pressed={filter === mode}
          >
            <span className={`pill__dot pill__dot--${mode}`} aria-hidden="true" />
            {theme.chrome.pills[mode]}
            <span className="pill__count">{counts[mode]}</span>
          </button>
        ))}
      </nav>

      {/* ---------------------------------------------------------------- */}
      <div className="side-controls side-controls--left">
        <button className="icon-btn icon-btn--round" onClick={() => canvas.current?.fit()} aria-label="Fit tree to screen">
          <Icon name="fit" theme={theme.id} size={24} />
        </button>
        <button className="icon-btn icon-btn--round" onClick={() => canvas.current?.zoomBy(1.35)} aria-label="Zoom in">
          <Icon name="zoom-in" theme={theme.id} size={24} />
        </button>
        <button className="icon-btn icon-btn--round" onClick={() => canvas.current?.zoomBy(1 / 1.35)} aria-label="Zoom out">
          <Icon name="zoom-out" theme={theme.id} size={24} />
        </button>
      </div>

      <div className="side-controls side-controls--right">
        <button
          className="icon-btn icon-btn--round"
          onClick={() => {
            const root = meta.rootPersonId ?? people[0]?.id
            if (root) canvas.current?.centerOn(root)
          }}
          aria-label="Go to root ancestor"
        >
          <Icon name="tree" theme={theme.id} size={24} />
        </button>
        <button className="icon-btn icon-btn--round" onClick={() => setSearchOpen((v) => !v)} aria-label="Search people">
          <Icon name="search" theme={theme.id} size={24} />
        </button>
        <button className="icon-btn icon-btn--round" onClick={() => setShowSettings(true)} aria-label="Share this tree">
          <Icon name="share" theme={theme.id} size={24} />
        </button>
      </div>

      {searchOpen && (
        <div className="search-panel">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find someone…"
            aria-label="Find someone in this tree"
          />
          <ul>
            {matches.map((person) => (
              <li key={person.id}>
                <button
                  onClick={() => {
                    canvas.current?.centerOn(person.id)
                    select(person.id)
                    setSearchOpen(false)
                    setQuery('')
                  }}
                >
                  <span>{person.name}</span>
                  <span className="search-panel__dates">
                    {person.birthDate}
                    {person.deathDate ? `–${person.deathDate}` : person.birthDate ? '–' : ''}
                  </span>
                </button>
              </li>
            ))}
            {query.trim() && matches.length === 0 && <li className="search-panel__empty">No one by that name.</li>}
          </ul>
        </div>
      )}

      <button
        className="fab"
        onClick={() =>
          requireEdit(() => {
            const anchor = selectedPersonId ?? meta.rootPersonId ?? people[0]?.id
            if (!anchor) {
              flashToast('Add the first person from the landing screen.')
              return
            }
            setAddAnchorId(anchor)
          })
        }
      >
        <span className="fab__plus" aria-hidden="true">+</span>
        <span>Add relative</span>
      </button>

      <nav className="bottom-nav" aria-label="Sections">
        {theme.chrome.nav.map((item) => (
          <button
            key={item.key}
            className={`bottom-nav__item${activeNav === item.key ? ' is-active' : ''}`}
            onClick={() => {
              setActiveNav(item.key)
              if (item.key === 'tree') canvas.current?.fit()
              if (item.key === 'people') setSearchOpen(true)
              if (item.key === 'more') setShowSettings(true)
            }}
            aria-current={activeNav === item.key ? 'page' : undefined}
          >
            <Icon name={NAV_ICONS[item.key] ?? 'more'} theme={theme.id} size={30} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {toast && <div className="toast" role="status">{toast}</div>}

      {/* ---------------------------------------------------------------- */}
      {selected && (
        <PersonCard
          theme={theme}
          person={selected}
          removed={removedPeople.has(selected.id)}
          canEdit={canEdit}
          onClose={() => select(null)}
          onAddRelative={() => {
            // Hand over to the add modal rather than stacking it on top of the
            // card, which would otherwise stay open behind it and swallow clicks.
            setAddAnchorId(selected.id)
            select(null)
          }}
          onSave={(patch) => updatePerson(selected.id, patch)}
          onSoftRemove={() => softRemovePerson(selected.id)}
          onRestore={() => restorePerson(selected.id)}
          onHardPrune={() => hardPrunePerson(selected.id)}
        />
      )}

      {addAnchor && (
        <AddRelativeModal
          theme={theme}
          anchor={addAnchor}
          onClose={() => setAddAnchorId(null)}
          onSubmit={async (relation, input) => {
            const personId = await addRelative(addAnchor.id, relation, input)
            // Follow the new branch so its growth animation is actually seen —
            // a relative added at the edge of a wide tree is otherwise off-screen.
            window.setTimeout(() => canvas.current?.centerOn(personId), 120)
          }}
        />
      )}

      {showSettings && (
        <SettingsPanel
          theme={theme}
          meta={meta}
          canEdit={canEdit}
          storageKind={getRepository().kind}
          onClose={() => setShowSettings(false)}
          onPickTheme={setTheme}
          onUnlock={unlock}
          onLeave={leaveTree}
        />
      )}
    </div>
  )
}
