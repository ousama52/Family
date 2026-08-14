import { useMemo } from 'react'
import { asset } from '../themes/assets'
import type { Theme } from '../themes/themes'

/**
 * Each theme plugs its own "this relative was removed" visual into the same
 * slot, built from the supplied overlay art:
 *   Celestial     — the crystal shard sprites, flung outward and left drifting
 *   Medieval      — the cracked-frame fragment overlay, plus the same shards
 *   Wuxia / Murim — the red ink-slash PNG, rotated across the portrait
 *
 * All three are persistent states rather than one-shot animations: the effect
 * stays drawn while the relationship is soft-removed, and only *plays* on the
 * transition (`animating`).
 */

function rand(seed: number) {
  let state = (seed % 2147483646) + 1
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

type Props = {
  theme: Theme
  radius: number
  seed: number
  /** True while the removal is being played out, right after the user confirms. */
  animating: boolean
}

export function RemovalEffect({ theme, radius, seed, animating }: Props) {
  const shards = useMemo(() => {
    const names = theme.effects.shards
    if (!names?.length) return []
    const next = rand(seed + 5)
    // Ring the node with shards so the burst reads as the portrait coming apart
    // rather than sprites scattered at random.
    const count = theme.removal === 'crack-shatter' ? 7 : 10
    return Array.from({ length: count }, (_, i) => {
      const angle = ((i + next() * 0.6) / count) * Math.PI * 2
      const distance = radius * (0.62 + next() * 0.72)
      const size = radius * (0.34 + next() * 0.42)
      return {
        href: asset(theme.id, names[i % names.length]),
        size,
        x: Math.cos(angle) * distance - size / 2,
        y: Math.sin(angle) * distance - size / 2,
        dx: Math.cos(angle) * radius * (0.5 + next() * 0.9),
        dy: Math.sin(angle) * radius * (0.5 + next() * 0.9) - radius * 0.12,
        rotate: next() * 360,
        spin: (next() - 0.5) * 170,
        delay: next() * 300,
      }
    })
  }, [theme, radius, seed])

  // -------------------------------------------------------------------------
  // Wuxia: the red ink slash dragged across the portrait, with its drip trail.
  // -------------------------------------------------------------------------
  if (theme.removal === 'ink-slash') {
    const href = asset(theme.id, theme.effects.inkSlash ?? '')
    if (!href) return null
    // The supplied slash runs top-left to bottom-right down a tall canvas; sized
    // past the node and nudged up so its drip hangs below the portrait.
    const w = radius * 3.1
    const h = radius * 4.6
    const angle = -18 + (seed % 5) * 7
    return (
      <g className={`removal removal--ink${animating ? ' is-animating' : ''}`} pointerEvents="none">
        <image
          href={href}
          x={-w / 2}
          y={-h * 0.42}
          width={w}
          height={h}
          preserveAspectRatio="xMidYMid meet"
          transform={`rotate(${angle})`}
        />
      </g>
    )
  }

  // -------------------------------------------------------------------------
  // Celestial + Medieval: the node fragments. Medieval lays the supplied crack
  // overlay across the frame before the pieces let go.
  // -------------------------------------------------------------------------
  const crackHref = theme.effects.crack ? asset(theme.id, theme.effects.crack) : ''

  return (
    <g className={`removal removal--shatter${animating ? ' is-animating' : ''}`} pointerEvents="none">
      {crackHref && (
        <image
          href={crackHref}
          x={-radius * 1.5}
          y={-radius * 1.5}
          width={radius * 3}
          height={radius * 3}
          preserveAspectRatio="xMidYMid meet"
          opacity={0.95}
        />
      )}
      {shards.map((shard, i) => (
        <image
          key={i}
          className="shard"
          href={shard.href}
          x={shard.x}
          y={shard.y}
          width={shard.size}
          height={shard.size}
          preserveAspectRatio="xMidYMid meet"
          transform={`rotate(${shard.rotate.toFixed(0)} ${(shard.x + shard.size / 2).toFixed(1)} ${(shard.y + shard.size / 2).toFixed(1)})`}
          style={
            {
              '--shard-dx': `${shard.dx.toFixed(1)}px`,
              '--shard-dy': `${shard.dy.toFixed(1)}px`,
              '--shard-rotate': `${shard.spin.toFixed(0)}deg`,
              '--shard-delay': `${shard.delay.toFixed(0)}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </g>
  )
}
