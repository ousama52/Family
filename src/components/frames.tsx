import { apertureRatio, asset } from '../themes/assets'
import type { Theme } from '../themes/themes'
import { defId } from './TreeDefs'

/**
 * Portrait frames are the supplied artwork, not drawn shapes. Each frame image
 * was sliced so its photo aperture sits dead centre, and `apertureRatio` records
 * how wide that aperture is relative to the image. Scaling by
 * `radius / apertureRatio` therefore lands the hole exactly on the node's
 * portrait, which is what lets frames with very different bezel widths — the
 * three medieval castings, the ensō — drop into the same slot.
 */
function frameBox(theme: Theme, name: string, radius: number, pad = 1) {
  const ratio = apertureRatio(theme.id, name, 0.55)
  const size = ((radius * 2) / ratio) * pad
  return { href: asset(theme.id, name), x: -size / 2, y: -size / 2, size }
}

export function pickFrameAsset(theme: Theme, variant: number | undefined) {
  const list = theme.node.frameAssets
  if (!list.length) return ''
  return list[(((variant ?? 0) % list.length) + list.length) % list.length]
}

// ---------------------------------------------------------------------------
// Celestial — one of three supplied glow rings, chosen by which side of the
// family the person descends from.
// ---------------------------------------------------------------------------

export function GlowRing({
  theme,
  radius,
  frameName,
  emphasised,
  greyed,
}: {
  theme: Theme
  radius: number
  frameName: string
  emphasised: boolean
  greyed: boolean
}) {
  // The supplied rings carry their own glow halo, so the artwork is drawn a
  // little wider than the aperture to let that halo sit outside the portrait.
  const box = frameBox(theme, frameName, radius, emphasised ? 1.16 : 1.08)
  if (!box.href) return null
  return (
    <image
      className="frame frame--glow"
      href={box.href}
      x={box.x}
      y={box.y}
      width={box.size}
      height={box.size}
      preserveAspectRatio="xMidYMid meet"
      // A removed relative keeps a visible ring — drained to grey rather than
      // faded away, so the gap they leave still reads as a person.
      opacity={greyed ? 0.7 : 1}
      filter={greyed ? `url(#${defId(theme, 'desaturate')})` : undefined}
      pointerEvents="none"
    />
  )
}

// ---------------------------------------------------------------------------
// Medieval — three ornate cast-metal frames, alternating per person.
// ---------------------------------------------------------------------------

export function MetalFrame({
  theme,
  radius,
  frameName,
  greyed,
}: {
  theme: Theme
  radius: number
  frameName: string
  greyed: boolean
}) {
  const box = frameBox(theme, frameName, radius)
  if (!box.href) return null
  return (
    <image
      className="frame frame--metal"
      href={box.href}
      x={box.x}
      y={box.y}
      width={box.size}
      height={box.size}
      preserveAspectRatio="xMidYMid meet"
      opacity={greyed ? 0.6 : 1}
      filter={greyed ? `url(#${defId(theme, 'desaturate')})` : undefined}
      pointerEvents="none"
    />
  )
}

// ---------------------------------------------------------------------------
// Wuxia — the supplied ensō, rotated per person so no two rings look alike.
// ---------------------------------------------------------------------------

export function BrushCircle({
  theme,
  radius,
  frameName,
  seed,
  greyed,
}: {
  theme: Theme
  radius: number
  frameName: string
  seed: number
  greyed: boolean
}) {
  const box = frameBox(theme, frameName, radius, 1.02)
  if (!box.href) return null
  const rotation = (seed % 8) * 45
  return (
    <image
      className="frame frame--brush"
      href={box.href}
      x={box.x}
      y={box.y}
      width={box.size}
      height={box.size}
      preserveAspectRatio="xMidYMid meet"
      transform={`rotate(${rotation})`}
      opacity={greyed ? 0.42 : 1}
      pointerEvents="none"
    />
  )
}
