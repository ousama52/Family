import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { select } from 'd3-selection'
// Registers selection.transition(), used for the smooth fit / centre-on moves.
import 'd3-transition'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import { computeLayout, DEFAULT_METRICS } from '../lib/layout'
import { assignLineage } from '../lib/lineage'
import type { Theme } from '../themes/themes'
import type { FilterMode, Person, Relationship } from '../types'
import { Branch } from './Branch'
import { PersonNode } from './PersonNode'
import { TreeDefs, defId } from './TreeDefs'

export type CanvasHandle = {
  zoomBy: (factor: number) => void
  fit: () => void
  /** Pans to a person, keeping the current zoom unless a scale is given. */
  centerOn: (personId: string, scale?: number) => void
}

type Props = {
  people: Person[]
  relationships: Relationship[]
  theme: Theme
  filter: FilterMode
  selectedPersonId: string | null
  rootPersonId?: string
  growing: string[]
  popping: string[]
  removing: string[]
  pruning: string[]
  onSelect: (personId: string | null) => void
  onReady: (handle: CanvasHandle) => void
}

export function TreeCanvas({
  people,
  relationships,
  theme,
  filter,
  selectedPersonId,
  rootPersonId,
  growing,
  popping,
  removing,
  pruning,
  onSelect,
  onReady,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const viewRef = useRef<SVGGElement | null>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  /** Latest zoom level, so panning to a person can preserve it. */
  const currentScale = useRef(1)
  const [size, setSize] = useState({ width: 1, height: 1 })

  const metrics = useMemo(
    () => ({
      ...DEFAULT_METRICS,
      // Medieval plaques and Wuxia seals need more room under each portrait.
      nodeSlot: theme.node.frame === 'metal' ? 142 : 126,
      rowHeight: theme.node.frame === 'metal' ? 224 : 208,
    }),
    [theme],
  )

  const layout = useMemo(
    () => computeLayout(people, relationships, metrics),
    [people, relationships, metrics],
  )
  const lineage = useMemo(() => assignLineage(people, relationships), [people, relationships])
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  /** Filter dims rather than removes, so the tree never reflows under you. */
  const isDimmed = useCallback(
    (personId: string) => {
      if (filter === 'all') return false
      const node = layout.byId[personId]
      const person = peopleById.get(personId)
      if (!node || !person) return false
      if (filter === 'removed') return !node.removed
      return node.removed || Boolean(person.deathDate)
    },
    [filter, layout.byId, peopleById],
  )

  // ---------------------------------------------------------------------------
  // Pan & zoom
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const svg = svgRef.current
    const view = viewRef.current
    if (!svg || !view) return

    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3])
      .filter((event: Event) => {
        // Let clicks through to nodes; drag and wheel drive the camera.
        if ((event as WheelEvent).type === 'wheel') return true
        return !(event as MouseEvent).button
      })
      .on('zoom', (event: { transform: ZoomTransform }) => {
        view.setAttribute('transform', event.transform.toString())
        currentScale.current = event.transform.k
      })

    zoomRef.current = behavior
    select(svg).call(behavior).on('dblclick.zoom', null)
    return () => {
      select(svg).on('.zoom', null)
    }
  }, [])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.max(1, width), height: Math.max(1, height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const transformFor = useCallback(
    (focus?: { x: number; y: number }, scaleOverride?: number) => {
      const { bounds } = layout
      const w = bounds.maxX - bounds.minX
      const h = bounds.maxY - bounds.minY
      if (w <= 0 || h <= 0) return zoomIdentity
      const scale =
        scaleOverride ?? Math.min(3, Math.max(0.15, Math.min(size.width / w, size.height / h) * 0.92))
      const cx = focus ? focus.x : bounds.minX + w / 2
      const cy = focus ? focus.y : bounds.minY + h / 2
      return zoomIdentity
        .translate(size.width / 2 - cx * scale, size.height / 2 - cy * scale)
        .scale(scale)
    },
    [layout, size],
  )

  useEffect(() => {
    const svg = svgRef.current
    const behavior = zoomRef.current
    if (!svg || !behavior) return
    onReady({
      zoomBy: (factor) => {
        select(svg).transition().duration(240).call(behavior.scaleBy, factor)
      },
      fit: () => {
        select(svg).transition().duration(520).call(behavior.transform, transformFor())
      },
      centerOn: (personId, scale) => {
        const node = layout.byId[personId]
        if (!node) return
        select(svg)
          .transition()
          .duration(520)
          .call(behavior.transform, transformFor(node, scale ?? currentScale.current))
      },
    })
  }, [onReady, transformFor, layout.byId])

  // Frame the whole tree once it has been measured and laid out.
  const framed = useRef(false)
  useEffect(() => {
    const svg = svgRef.current
    const behavior = zoomRef.current
    if (!svg || !behavior || framed.current) return
    if (size.width <= 1 || layout.nodes.length === 0) return
    framed.current = true
    select(svg).call(behavior.transform, transformFor())
  }, [size, layout.nodes.length, transformFor])

  // Each theme sizes its portraits and rows differently, so a theme switch
  // reflows the tree — reframe it, or the wider themes end up clipped.
  const lastTheme = useRef(theme.id)
  useEffect(() => {
    if (lastTheme.current === theme.id) return
    lastTheme.current = theme.id
    const svg = svgRef.current
    const behavior = zoomRef.current
    if (!svg || !behavior || !framed.current) return
    select(svg).transition().duration(420).call(behavior.transform, transformFor())
  }, [theme.id, transformFor])

  const growingSet = useMemo(() => new Set(growing), [growing])

  return (
    <svg
      ref={svgRef}
      className="tree-canvas"
      onClick={() => onSelect(null)}
      role="application"
      aria-label="Family tree canvas — drag to pan, scroll to zoom"
    >
      <TreeDefs theme={theme} />
      <g ref={viewRef}>
        <g className="tree-canvas__branches">
          {layout.links.map((link) => (
            <Branch
              key={link.id}
              link={link}
              theme={theme}
              nodeRadius={theme.node.radius}
              growing={Boolean(link.relationshipId && growingSet.has(link.relationshipId))}
              dimmed={link.endpoints.length > 0 && link.endpoints.every(isDimmed)}
            />
          ))}
        </g>

        {/* The knot where a couple's branches merge before fanning to children. */}
        <g className="tree-canvas__junctions">
          {layout.junctions.map((junction) =>
            junction.status === 'removed' ? null : theme.branch.starPoints ? (
              <g key={junction.id}>
                <circle cx={junction.x} cy={junction.y} r={16} fill={`url(#${defId(theme, 'junction')})`} opacity={0.9} />
                <circle cx={junction.x} cy={junction.y} r={2.6} fill="#ffffff" />
              </g>
            ) : (
              <circle
                key={junction.id}
                cx={junction.x}
                cy={junction.y}
                r={Math.max(2.5, theme.branch.baseWidth * 0.42)}
                fill={theme.palette.branch}
                opacity={theme.id === 'wuxia' ? 0.9 : 1}
              />
            ),
          )}
        </g>

        <g className="tree-canvas__nodes">
          {layout.nodes.map((node) => {
            const person = peopleById.get(node.personId)
            if (!person) return null
            return (
              <PersonNode
                key={node.personId}
                person={person}
                node={node}
                theme={theme}
                lineage={lineage[node.personId] ?? 0}
                selected={selectedPersonId === node.personId}
                dimmed={isDimmed(node.personId)}
                isRoot={rootPersonId === node.personId}
                popping={popping.includes(node.personId)}
                removingNow={removing.includes(node.personId)}
                pruning={pruning.includes(node.personId)}
                onSelect={onSelect}
              />
            )
          })}
        </g>
      </g>
    </svg>
  )
}
