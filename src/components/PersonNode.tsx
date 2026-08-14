import { memo } from 'react'
import { asset } from '../themes/assets'
import type { Theme } from '../themes/themes'
import type { NodePosition, Person } from '../types'
import { BrushCircle, GlowRing, MetalFrame, pickFrameAsset } from './frames'
import { RemovalEffect } from './RemovalEffect'
import { defId } from './TreeDefs'

type Props = {
  person: Person
  node: NodePosition
  theme: Theme
  /** Which ancestral line this person belongs to — drives the Celestial ring colour. */
  lineage: number
  selected: boolean
  dimmed: boolean
  /** The tree's designated root ancestor gets a caption under their name. */
  isRoot: boolean
  popping: boolean
  removingNow: boolean
  pruning: boolean
  onSelect: (personId: string) => void
}

function lifespan(person: Person) {
  if (!person.birthDate && !person.deathDate) return ''
  const birth = person.birthDate ?? ''
  return person.deathDate ? `${birth}–${person.deathDate}` : `${birth}–`
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (!parts[0]) return '?'
  // CJK names read better as the single surname character.
  if (/[㐀-鿿]/.test(parts[0])) return parts[0][0]
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : parts[0][0].toUpperCase()
}

function seedFrom(id: string) {
  let hash = 7
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 100000
  return hash
}

function PersonNodeImpl({
  person,
  node,
  theme,
  lineage,
  selected,
  dimmed,
  isRoot,
  popping,
  removingNow,
  pruning,
  onSelect,
}: Props) {
  const id = (n: string) => defId(theme, n)
  const radius = theme.node.radius * node.scale
  const clipId = `clip-${person.id}`
  const removed = node.removed
  const deceased = Boolean(person.deathDate)
  const seed = seedFrom(person.id)

  // Celestial picks its ring by lineage (blue side / gold side, purple for you);
  // the other themes alternate their frame variants per person.
  const frameName =
    theme.node.frame === 'glow-ring'
      ? person.isSelf
        ? 'ring-purple'
        : pickFrameAsset(theme, lineage)
      : pickFrameAsset(theme, person.frameVariant ?? seed)

  const classNames = [
    'person-node',
    popping && 'is-popping',
    pruning && 'is-pruning',
    removed && 'is-removed',
    selected && 'is-selected',
  ]
    .filter(Boolean)
    .join(' ')

  const plaqueHref = theme.effects.plaque ? asset(theme.id, theme.effects.plaque) : ''
  const sealHref = theme.effects.seal ? asset(theme.id, theme.effects.seal) : ''

  return (
    <g
      className={classNames}
      transform={`translate(${node.x} ${node.y})`}
      opacity={dimmed ? 0.16 : 1}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(person.id)
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(person.id)
        }
      }}
      aria-label={`${person.name}${lifespan(person) ? `, ${lifespan(person)}` : ''}${removed ? ', removed' : ''}`}
    >
      <clipPath id={clipId}>
        <circle r={radius} />
      </clipPath>

      {selected && (
        <circle
          className="selection-halo"
          r={radius + (theme.node.frame === 'metal' ? 24 : 16)}
          fill="none"
          stroke={theme.palette.accent}
          strokeWidth={2}
          opacity={0.85}
        />
      )}

      <g className="person-node__body">
        <g clipPath={`url(#${clipId})`} filter={removed ? `url(#${id('desaturate')})` : undefined}>
          {person.photoUrl ? (
            <image
              href={person.photoUrl}
              x={-radius}
              y={-radius}
              width={radius * 2}
              height={radius * 2}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <>
              <circle r={radius} fill={`url(#${id('portrait-empty')})`} />
              <text
                className="person-node__initials"
                y={radius * 0.24}
                textAnchor="middle"
                fontSize={radius * 0.76}
                fontFamily={theme.fonts.body}
                fill={theme.id === 'wuxia' ? 'rgba(40,40,44,0.7)' : 'rgba(244,238,222,0.8)'}
              >
                {initials(person.name)}
              </text>
            </>
          )}
          {/* Deceased people take a faint cool wash — a "passed" treatment kept
              clearly distinct from the removal effects. */}
          {deceased && !removed && (
            <circle r={radius} fill={theme.id === 'wuxia' ? '#f4f2ec' : '#101427'} opacity={0.18} />
          )}
        </g>

        {theme.node.frame === 'glow-ring' && (
          <GlowRing
            theme={theme}
            radius={radius}
            frameName={frameName}
            emphasised={Boolean(person.isSelf) || selected}
            greyed={removed}
          />
        )}
        {theme.node.frame === 'metal' && (
          <MetalFrame theme={theme} radius={radius} frameName={frameName} greyed={removed} />
        )}
        {theme.node.frame === 'brush' && (
          <BrushCircle theme={theme} radius={radius} frameName={frameName} seed={seed} greyed={removed} />
        )}

        {/* Wuxia surname seal, overlapping the bottom of the ink circle. */}
        {theme.node.seal && (
          <g transform={`translate(0 ${radius + 2})`} opacity={removed ? 0.5 : 1}>
            {sealHref ? (
              <image
                href={sealHref}
                x={-radius * 0.34}
                y={-radius * 0.34}
                width={radius * 0.68}
                height={radius * 0.68}
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <circle r={radius * 0.3} fill={theme.palette.branch} />
            )}
            <text
              y={radius * 0.12}
              textAnchor="middle"
              fontSize={radius * 0.32}
              fontFamily={theme.fonts.body}
              fill="#f7f5f0"
            >
              {initials(person.name)}
            </text>
          </g>
        )}

        {removed && <RemovalEffect theme={theme} radius={radius} seed={seed} animating={removingNow} />}
      </g>

      {/* Label */}
      {theme.node.plaque ? (
        <g transform={`translate(0 ${radius + 22})`} className="person-node__plaque">
          {plaqueHref && (
            <image
              href={plaqueHref}
              x={-78}
              y={-6}
              width={156}
              height={62}
              preserveAspectRatio="none"
              opacity={removed ? 0.6 : 1}
              filter={removed ? `url(#${id('desaturate')})` : undefined}
            />
          )}
          <text
            y={23}
            textAnchor="middle"
            fontSize={16}
            fontFamily={theme.fonts.body}
            fill={removed ? '#b9b2a4' : '#f3e2ba'}
          >
            {person.name}
          </text>
          <text
            y={40}
            textAnchor="middle"
            fontSize={13}
            fontFamily={theme.fonts.body}
            fill={removed ? '#a49c8e' : 'rgba(236,220,182,0.85)'}
          >
            {lifespan(person)}
          </text>
        </g>
      ) : (
        <g
          className="person-node__label"
          // Clear of the frame art: the Celestial rings carry a glow halo that
          // reaches well past the portrait, and the Wuxia seal hangs below it.
          transform={`translate(0 ${radius + (theme.node.seal ? 48 : 44)})`}
        >
          {/* A halo in the background colour, painted behind the glyphs, keeps
              names readable where they cross a branch or a ring's glow. */}
          <text
            textAnchor="middle"
            fontSize={19}
            fontFamily={theme.fonts.body}
            fill={removed ? theme.palette.removedInk : theme.palette.ink}
            stroke={theme.background.base}
            strokeWidth={3.4}
            strokeLinejoin="round"
            paintOrder="stroke"
            style={{ letterSpacing: '0.02em' }}
          >
            {person.name}
          </text>
          <text
            y={20}
            textAnchor="middle"
            fontSize={14}
            fontFamily={theme.fonts.body}
            fill={removed ? theme.palette.removedInk : theme.palette.inkSoft}
            stroke={theme.background.base}
            strokeWidth={3}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {lifespan(person)}
          </text>
          {isRoot && (
            <text
              y={40}
              textAnchor="middle"
              fontSize={13}
              fontFamily={theme.fonts.body}
              fill={theme.palette.accent}
              stroke={theme.background.base}
              strokeWidth={3}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {theme.id === 'wuxia' ? '始祖' : 'Our Root'}
            </text>
          )}
        </g>
      )}
    </g>
  )
}

export const PersonNode = memo(PersonNodeImpl)
