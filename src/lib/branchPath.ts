import type { BranchLink } from '../types'

export type Point = { x: number; y: number }

/**
 * How the stroke width varies along the branch:
 *  - 'taper' : thick at the trunk end, thin at the tip (Celestial / Medieval)
 *  - 'brush' : fine at both ends, full-bodied through the middle, like a loaded
 *              ink brush lifted off the paper (Wuxia)
 */
export type WidthProfile = 'taper' | 'brush'

export type BranchGeometry = {
  /** Filled outline of the tapered branch body. */
  outline: string
  /** Centre line — used for the growth mask, glow strokes and dot placement. */
  center: string
  /** Sampled centre-line points, for scattering stars / leaves along the path. */
  samples: Point[]
  /** Approximate arc length, so growth animations can be duration-matched. */
  length: number
}

const SAMPLES = 56

function cubicAt(t: number, p0: Point, c0: Point, c1: Point, p1: Point): Point {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * c0.x + c * c1.x + d * p1.x,
    y: a * p0.y + b * c0.y + c * c1.y + d * p1.y,
  }
}

/**
 * Control points chosen so branches leave a node heading away from it and
 * arrive at the next one head-on — the "reaching" shape of a real branch
 * rather than a straight connector.
 */
export function controlPoints(link: Pick<BranchLink, 'from' | 'to' | 'kind' | 'bend'>) {
  const { from, to, kind, bend } = link
  const dx = to.x - from.x
  const dy = to.y - from.y

  if (kind === 'spouse' || kind === 'sibling') {
    // Horizontal ties bow downward, so they read as a branch swinging between
    // two nodes rather than a ruled line.
    const span = Math.abs(dx) || 1
    const sag = Math.min(span * 0.28, 46) * (kind === 'sibling' ? 1.35 : 1) * (0.5 + bend)
    return {
      c0: { x: from.x + dx * 0.28, y: from.y + sag },
      c1: { x: to.x - dx * 0.28, y: to.y + sag },
    }
  }

  // Vertical growth: leave the source heading down, arrive heading down, with a
  // sideways lean proportional to how far the branch has to reach.
  const lean = bend * Math.min(Math.abs(dx) * 0.5, 90)
  return {
    c0: { x: from.x + lean * 0.5, y: from.y + dy * 0.48 },
    c1: { x: to.x - lean * 0.35, y: to.y - dy * 0.42 },
  }
}

function widthAt(t: number, profile: WidthProfile, start: number, end: number) {
  if (profile === 'brush') {
    // sin gives a full belly with hairline entry and exit.
    const belly = Math.sin(Math.PI * Math.min(1, Math.max(0, t)))
    const body = Math.max(start, end)
    return 0.14 * body + 0.86 * body * Math.pow(belly, 0.7)
  }
  // Ease the taper so the thickness falls away fastest near the tip.
  const eased = t * t * (3 - 2 * t)
  return start + (end - start) * eased
}

function polyline(points: Point[]) {
  if (points.length === 0) return ''
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`
  }
  return d
}

/** Walks the sampled polyline and drops the first/last `trim` pixels, so a
 *  branch tucks behind the portrait frames instead of crossing over them. */
function trimPolyline(points: Point[], trimStart: number, trimEnd: number) {
  if (points.length < 2) return points
  const segments: number[] = [0]
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    segments.push(total)
  }
  const from = Math.min(trimStart, total * 0.45)
  const to = Math.max(total - trimEnd, total * 0.55)

  const at = (distance: number): Point => {
    for (let i = 1; i < segments.length; i++) {
      if (segments[i] >= distance) {
        const span = segments[i] - segments[i - 1] || 1
        const k = (distance - segments[i - 1]) / span
        return {
          x: points[i - 1].x + (points[i].x - points[i - 1].x) * k,
          y: points[i - 1].y + (points[i].y - points[i - 1].y) * k,
        }
      }
    }
    return points[points.length - 1]
  }

  const out: Point[] = [at(from)]
  for (let i = 0; i < points.length; i++) {
    if (segments[i] > from && segments[i] < to) out.push(points[i])
  }
  out.push(at(to))
  return out
}

export type BranchOptions = {
  widthStart: number
  widthEnd: number
  profile: WidthProfile
  trimStart?: number
  trimEnd?: number
}

/**
 * Builds a tapered branch as a *filled outline* rather than a stroked line:
 * the centre line is sampled, offset along its normals by half the local width,
 * and closed back on itself. That is what lets one branch be thick where it
 * leaves the trunk and hairline-thin where it meets a leaf node.
 */
export function branchGeometry(
  link: Pick<BranchLink, 'from' | 'to' | 'kind' | 'bend'>,
  options: BranchOptions,
): BranchGeometry {
  const { c0, c1 } = controlPoints(link)
  const raw: Point[] = []
  for (let i = 0; i <= SAMPLES; i++) {
    raw.push(cubicAt(i / SAMPLES, link.from, c0, c1, link.to))
  }

  const points = trimPolyline(raw, options.trimStart ?? 0, options.trimEnd ?? 0)

  let length = 0
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }

  const left: Point[] = []
  const right: Point[] = []
  const last = points.length - 1

  for (let i = 0; i <= last; i++) {
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(last, i + 1)]
    let tx = next.x - prev.x
    let ty = next.y - prev.y
    const mag = Math.hypot(tx, ty) || 1
    tx /= mag
    ty /= mag
    // Normal is the tangent rotated a quarter turn.
    const nx = -ty
    const ny = tx
    const half = widthAt(i / last, options.profile, options.widthStart, options.widthEnd) / 2
    left.push({ x: points[i].x + nx * half, y: points[i].y + ny * half })
    right.push({ x: points[i].x - nx * half, y: points[i].y - ny * half })
  }

  const outline = `${polyline(left)} ${polyline(right.reverse()).replace('M', 'L')} Z`

  return { outline, center: polyline(points), samples: points, length }
}

/** Evenly spaced points along a branch, used for star-points and leaf sprites. */
export function pointsAlong(samples: Point[], count: number, inset = 0.18): Point[] {
  if (samples.length < 2 || count <= 0) return []
  const out: Point[] = []
  for (let i = 0; i < count; i++) {
    const t = inset + ((1 - inset * 2) * (count === 1 ? 0.5 : i / (count - 1)))
    const idx = Math.round(t * (samples.length - 1))
    out.push(samples[idx])
  }
  return out
}

/** Angle of the branch at a sampled index, in degrees — for rotating leaf sprites. */
export function angleAt(samples: Point[], point: Point): number {
  let bestIndex = 0
  let best = Infinity
  for (let i = 0; i < samples.length; i++) {
    const d = Math.hypot(samples[i].x - point.x, samples[i].y - point.y)
    if (d < best) {
      best = d
      bestIndex = i
    }
  }
  const a = samples[Math.max(0, bestIndex - 1)]
  const b = samples[Math.min(samples.length - 1, bestIndex + 1)]
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

/**
 * Stroke width for a branch at a given generation depth. Branches leaving the
 * oldest generation are the trunk and carry the most weight; each generation
 * out sheds a fixed proportion, bottoming out so tips stay visible.
 */
export function widthForDepth(depth: number, base: number, falloff = 0.78, min = 1.6) {
  return Math.max(min, base * Math.pow(falloff, depth))
}
