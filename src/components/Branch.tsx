import { memo, useMemo } from 'react'
import { angleAt, branchGeometry, pointsAlong, widthForDepth } from '../lib/branchPath'
import { asset } from '../themes/assets'
import type { Theme } from '../themes/themes'
import { defId } from './TreeDefs'
import type { BranchLink } from '../types'

type Props = {
  link: BranchLink
  theme: Theme
  nodeRadius: number
  /** Plays the grow-from-nothing animation when a relative is added. */
  growing: boolean
  dimmed: boolean
}

/** The supplied ivy sprite, dropped along the Medieval theme's wooden branches. */
function Leaf({
  href,
  x,
  y,
  angle,
  size,
  flip,
}: {
  href: string
  x: number
  y: number
  angle: number
  size: number
  flip: boolean
}) {
  return (
    <image
      href={href}
      x={-size / 2}
      y={-size / 2}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      transform={`translate(${x} ${y}) rotate(${angle + (flip ? 208 : 28)})`}
      opacity={0.94}
    />
  )
}

function BranchImpl({ link, theme, nodeRadius, growing, dimmed }: Props) {
  const removed = link.status === 'removed'

  const geometry = useMemo(() => {
    const start = widthForDepth(link.depth, theme.branch.baseWidth, theme.branch.falloff)
    // Each branch thins toward its far end, so a run of generations reads as one
    // continuously tapering limb rather than a stack of equal-weight lines.
    const end = widthForDepth(link.depth + 1, theme.branch.baseWidth, theme.branch.falloff)

    const isPeer = link.kind === 'spouse' || link.kind === 'sibling'
    const trimEnd = link.kind === 'parent' ? nodeRadius * 0.98 : isPeer ? nodeRadius * 0.98 : 0
    const trimStart = isPeer ? nodeRadius * 0.98 : link.kind === 'stem' ? nodeRadius * 0.96 : 0

    return branchGeometry(link, {
      widthStart: link.kind === 'stem' ? start : start * 0.9,
      widthEnd: isPeer ? start * 0.62 : end,
      profile: theme.branch.profile,
      trimStart,
      trimEnd,
    })
  }, [link, theme, nodeRadius])

  const id = (n: string) => defId(theme, n)
  const maskId = `grow-${link.id.replace(/[^a-z0-9]/gi, '-')}`

  const stars = useMemo(
    () =>
      theme.branch.starPoints && !removed
        ? pointsAlong(geometry.samples, link.kind === 'stem' ? 1 : 3)
        : [],
    [geometry.samples, theme.branch.starPoints, removed, link.kind],
  )

  const leaves = useMemo(() => {
    if (!theme.branch.leaves || removed || link.kind === 'stem') return []
    return pointsAlong(geometry.samples, 2, 0.3).map((p) => ({
      ...p,
      angle: angleAt(geometry.samples, p),
    }))
  }, [geometry.samples, theme.branch.leaves, removed, link.kind])

  const leafHref = theme.effects.leaf ? asset(theme.id, theme.effects.leaf) : ''
  const starHref = theme.effects.star ? asset(theme.id, theme.effects.star) : ''

  const bodyFilter = theme.branch.glow
    ? `url(#${id('glow')})`
    : theme.branch.drybrush
      ? `url(#${id('drybrush')})`
      : theme.branch.leaves
        ? `url(#${id('bark')})`
        : undefined

  // Withered branches keep their shape but drain to grey and go dotted, so the
  // gap a removed relative leaves is still legible in the tree.
  if (removed) {
    return (
      <g className="branch branch--removed" opacity={dimmed ? 0.25 : 1}>
        <path d={geometry.outline} fill={theme.palette.removedBranch} opacity={0.28} />
        <path
          d={geometry.center}
          fill="none"
          stroke={theme.palette.removedBranch}
          strokeWidth={Math.max(1.2, widthForDepth(link.depth, theme.branch.baseWidth, theme.branch.falloff) * 0.3)}
          strokeDasharray="5 7"
          strokeLinecap="round"
        />
      </g>
    )
  }

  return (
    <g className="branch" opacity={dimmed ? 0.22 : 1}>
      {growing && (
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect x={-99999} y={-99999} width={999999} height={999999} fill="black" />
          <path
            className="branch-grow-stroke"
            d={geometry.center}
            fill="none"
            stroke="#fff"
            strokeWidth={theme.branch.baseWidth * 3 + 12}
            strokeLinecap="round"
            style={{
              strokeDasharray: geometry.length,
              strokeDashoffset: geometry.length,
            }}
          />
        </mask>
      )}

      <g mask={growing ? `url(#${maskId})` : undefined}>
        {theme.branch.glow && (
          <path
            d={geometry.center}
            fill="none"
            stroke={theme.palette.branchGlow}
            strokeWidth={widthForDepth(link.depth, theme.branch.baseWidth, theme.branch.falloff) * 2.4}
            strokeLinecap="round"
            opacity={0.28}
            filter={`url(#${id('glow-strong')})`}
          />
        )}

        <path d={geometry.outline} fill={`url(#${id('branch-fill')})`} filter={bodyFilter} />

        {/* A thin lit edge along the top of the limb gives it roundness. */}
        {!theme.branch.drybrush && (
          <path
            d={geometry.center}
            fill="none"
            stroke={theme.palette.branchHighlight}
            strokeWidth={Math.max(0.7, widthForDepth(link.depth, theme.branch.baseWidth, theme.branch.falloff) * 0.16)}
            strokeLinecap="round"
            opacity={theme.branch.glow ? 0.9 : 0.35}
            transform={theme.branch.glow ? undefined : 'translate(0 -1.4)'}
          />
        )}

        {leafHref &&
          leaves.map((leaf, i) => (
            <Leaf
              key={i}
              href={leafHref}
              x={leaf.x}
              y={leaf.y}
              angle={leaf.angle}
              size={22 + (i % 2) * 6}
              flip={i % 2 === 1}
            />
          ))}

        {stars.map((star, i) =>
          starHref ? (
            <image
              key={i}
              href={starHref}
              x={star.x - 13}
              y={star.y - 13}
              width={26}
              height={26}
              preserveAspectRatio="xMidYMid meet"
              opacity={0.95}
            />
          ) : (
            <g key={i}>
              <circle cx={star.x} cy={star.y} r={7} fill={`url(#${id('star')})`} opacity={0.75} />
              <circle cx={star.x} cy={star.y} r={1.5} fill="#ffffff" />
            </g>
          ),
        )}
      </g>
    </g>
  )
}

export const Branch = memo(BranchImpl)
