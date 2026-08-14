import { asset, hasAsset } from '../themes/assets'
import type { ThemeId } from '../types'

/**
 * UI icons come from the supplied per-theme icon sheets, so each theme keeps its
 * own drawn language: glowing gold linework for Celestial, carved wood and brass
 * for Medieval, brushed ink ensō for Wuxia.
 *
 * The sheets do not all carry the same symbols, so a few names fall back to the
 * nearest supplied icon for that theme (noted below). Anything with no sensible
 * stand-in renders nothing rather than a broken image.
 */
export type IconName =
  | 'back'
  | 'menu'
  | 'settings'
  | 'zoom-in'
  | 'zoom-out'
  | 'fit'
  | 'search'
  | 'share'
  | 'tree'
  | 'people'
  | 'timeline'
  | 'memories'
  | 'skills'
  | 'more'

/**
 * Stand-ins where a theme's sheet is missing a symbol but another supplied icon
 * carries the same meaning. Only near-synonyms are mapped — where nothing fits,
 * the button falls back to a typographic glyph rather than a misleading picture.
 */
const FALLBACKS: Record<ThemeId, Partial<Record<IconName, IconName>>> = {
  celestial: { settings: 'menu', skills: 'memories' },
  medieval: { menu: 'settings', skills: 'memories' },
  wuxia: { settings: 'menu', memories: 'skills' },
}

/** Typographic stand-ins for the zoom/search/share controls. Only the Celestial
 *  sheet includes those symbols; the reference mockups only show that rail on
 *  the Celestial screen anyway. */
const GLYPHS: Partial<Record<IconName, string>> = {
  'zoom-in': '+',
  'zoom-out': '−',
  fit: '⊙',
  search: '⌕',
  share: '⁂',
}

function resolve(theme: ThemeId, name: IconName): string {
  if (hasAsset(theme, name)) return asset(theme, name)
  const fallback = FALLBACKS[theme]?.[name]
  if (fallback && hasAsset(theme, fallback)) return asset(theme, fallback)
  return ''
}

type Props = {
  name: IconName
  theme: ThemeId
  size?: number
  className?: string
}

export function Icon({ name, theme, size = 24, className }: Props) {
  const src = resolve(theme, name)
  if (!src) {
    const glyph = GLYPHS[name]
    if (!glyph) return null
    return (
      <span
        className={['icon icon--glyph', className].filter(Boolean).join(' ')}
        style={{ fontSize: size * 0.86, lineHeight: 1, width: size, height: size }}
        aria-hidden="true"
      >
        {glyph}
      </span>
    )
  }
  return (
    <img
      className={['icon', className].filter(Boolean).join(' ')}
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  )
}

/** True when this theme has real artwork for a symbol (not a glyph fallback). */
export function iconExists(theme: ThemeId, name: IconName) {
  return Boolean(resolve(theme, name))
}
