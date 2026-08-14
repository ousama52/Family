import type { Theme } from '../themes/themes'

/**
 * Per-theme SVG filters, gradients and patterns. Ids are namespaced by theme so
 * swapping themes never collides with a filter left over from the last one.
 */
export function defId(theme: Theme, name: string) {
  return `${theme.id}-${name}`
}

export function TreeDefs({ theme }: { theme: Theme }) {
  const id = (n: string) => defId(theme, n)

  return (
    <defs>
      {/* Soft outer glow for branches and rings (Celestial). */}
      <filter id={id('glow')} x="-70%" y="-70%" width="240%" height="240%">
        <feGaussianBlur stdDeviation="4.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id={id('glow-strong')} x="-140%" y="-140%" width="380%" height="380%">
        <feGaussianBlur stdDeviation="9" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Carved-wood grain: turbulence nudges the branch edge so it reads as
          bark rather than a vector shape (Medieval). */}
      <filter id={id('bark')} x="-15%" y="-15%" width="130%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9 0.06" numOctaves={3} seed={7} result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      {/* Dry-brush edge: coarse noise eats into the stroke so ink strokes look
          dragged across textured paper (Wuxia). */}
      <filter id={id('drybrush')} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.06 0.5" numOctaves={4} seed={19} result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="4.2" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      <filter id={id('inkbleed')} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="0.7" />
      </filter>

      {/* Portrait treatment for soft-removed people: drained of colour. */}
      <filter id={id('desaturate')}>
        <feColorMatrix
          type="matrix"
          values="0.32 0.36 0.12 0 0.04
                  0.32 0.36 0.12 0 0.04
                  0.32 0.36 0.12 0 0.06
                  0    0    0    1 0"
        />
      </filter>

      {/* Branch bodies. */}
      <linearGradient id={id('branch-fill')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={theme.palette.branchHighlight} />
        <stop offset="55%" stopColor={theme.palette.branch} />
        <stop offset="100%" stopColor={theme.palette.branch} />
      </linearGradient>

      <radialGradient id={id('star')} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
        <stop offset="35%" stopColor={theme.palette.branchGlow} stopOpacity="0.85" />
        <stop offset="100%" stopColor={theme.palette.branchGlow} stopOpacity="0" />
      </radialGradient>

      <radialGradient id={id('junction')} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="45%" stopColor={theme.palette.branchGlow} stopOpacity="0.7" />
        <stop offset="100%" stopColor={theme.palette.branchGlow} stopOpacity="0" />
      </radialGradient>

      {/* Metal frame shading (Medieval). */}
      <linearGradient id={id('metal')} x1="0.15" y1="0" x2="0.85" y2="1">
        <stop offset="0%" stopColor="#d9cbb0" />
        <stop offset="22%" stopColor="#8e7c5f" />
        <stop offset="48%" stopColor="#5d4c33" />
        <stop offset="70%" stopColor="#a28d68" />
        <stop offset="100%" stopColor="#4a3a24" />
      </linearGradient>
      <linearGradient id={id('metal-alt')} x1="0.8" y1="0.1" x2="0.2" y2="0.9">
        <stop offset="0%" stopColor="#c9b892" />
        <stop offset="30%" stopColor="#6f5c3d" />
        <stop offset="62%" stopColor="#9c8560" />
        <stop offset="100%" stopColor="#3f3120" />
      </linearGradient>
      <linearGradient id={id('plaque')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f0e0b8" />
        <stop offset="55%" stopColor="#e2cd9e" />
        <stop offset="100%" stopColor="#c6ab7a" />
      </linearGradient>

      {/* Stand-in fill for people with no portrait yet, toned per theme. */}
      <radialGradient id={id('portrait-empty')} cx="50%" cy="35%" r="75%">
        <stop
          offset="0%"
          stopColor={
            theme.id === 'celestial' ? '#2b2450' : theme.id === 'wuxia' ? '#eae7e0' : '#8a7654'
          }
        />
        <stop
          offset="100%"
          stopColor={
            theme.id === 'celestial' ? '#0b0820' : theme.id === 'wuxia' ? '#cbc7bd' : '#4a3b26'
          }
        />
      </radialGradient>

      {/* Vignette behind the ink-wash mountains (Wuxia). */}
      <radialGradient id={id('paper-wash')} cx="50%" cy="45%" r="70%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
  )
}
