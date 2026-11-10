import cytoscape, { type Core } from 'cytoscape'
import { useEffect, useRef } from 'react'
import type { GraphEdge, GraphNode } from '../graphData'
import type { InterestTag } from '../schema'

export type Selection = { type: 'node' | 'edge'; id: string } | null

const TAG_COLORS: Record<InterestTag, string> = {
  'Wars & Conflicts': '#ef4444',
  'Politics & Government': '#3b82f6',
  'Science & Technology': '#22c55e',
  'Art & Culture': '#eab308',
  'Religion & Philosophy': '#a855f7',
  'Exploration & Migration': '#14b8a6',
  'Economics & Trade': '#f97316',
}
const DEFAULT_COLOR = '#9ca3af'

type GraphViewProps = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selected: Selection
  onSelect: (selection: Selection) => void
}

export default function GraphView({ nodes, edges, selected, onSelect }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  })

  // Rebuild the graph only when the data changes.
  useEffect(() => {
    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map((n) => ({
          data: { id: n.id, label: n.name, color: TAG_COLORS[n.tags[0]] ?? DEFAULT_COLOR },
        })),
        ...edges.map((e) => ({
          data: { id: e.id, source: e.source, target: e.target, label: e.relation ?? '' },
          classes: e.kind === 'community' ? (e.promoted ? 'community' : 'community pending') : '',
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'background-color': 'data(color)',
            color: '#e5e7eb',
            'font-size': 10,
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'min-zoomed-font-size': 8,
            width: 18,
            height: 18,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#4b5563',
            'target-arrow-color': '#4b5563',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': 8,
            color: '#9ca3af',
          },
        },
        { selector: 'edge.community', style: { 'line-color': '#eab308', 'target-arrow-color': '#eab308' } },
        { selector: 'edge.pending', style: { 'line-style': 'dashed', opacity: 0.7 } },
        { selector: ':selected', style: { 'border-width': 3, 'border-color': '#fff', 'line-color': '#fff' } },
      ],
      layout: { name: 'cose', animate: false },
    })

    cy.on('tap', 'node', (event) => onSelectRef.current({ type: 'node', id: event.target.id() }))
    cy.on('tap', 'edge', (event) => onSelectRef.current({ type: 'edge', id: event.target.id() }))
    cy.on('tap', (event) => {
      if (event.target === cy) onSelectRef.current(null)
    })

    cyRef.current = cy
    return () => cy.destroy()
  }, [nodes, edges])

  // Keep Cytoscape's highlight in step with the selection (e.g. from search).
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().unselect()
    if (!selected) return
    const el = cy.getElementById(selected.id)
    if (el.nonempty()) {
      el.select()
      if (selected.type === 'node') cy.animate({ center: { eles: el }, duration: 300 })
    }
  }, [selected, nodes, edges])

  return <div ref={containerRef} className="graph-canvas" />
}
