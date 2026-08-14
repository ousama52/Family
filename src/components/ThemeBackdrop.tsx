import type { Theme } from '../themes/themes'

/**
 * The supplied background plate for the active theme — the nebula field, the
 * aged parchment sheet, or the ink-wash mountains — plus, for Medieval, the
 * carved-wood border that frames the whole page.
 */
export function ThemeBackdrop({ theme }: { theme: Theme }) {
  return (
    <div className="backdrop" aria-hidden="true" style={{ background: theme.background.base }}>
      <div
        className="backdrop__photo"
        style={{
          backgroundImage: `url(${theme.background.image})`,
          backgroundSize: theme.background.size,
          backgroundRepeat: theme.background.size === 'cover' ? 'no-repeat' : 'repeat',
          filter: theme.background.filter,
        }}
      />
      <div className="backdrop__wash" style={{ background: theme.background.overlay }} />
      {theme.background.borderImage && (
        <img className="backdrop__border" src={theme.background.borderImage} alt="" />
      )}
    </div>
  )
}
