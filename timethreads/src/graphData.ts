// Loads the graph the Home page draws. Nodes and edges come from Firestore
// (written by scripts/upload_graph.py). Until that script has been run the
// database has no nodes, so the app falls back to the local JSON files in
// src/data and src/nodes. That local graph is read-only: posts, stars and
// votes need the nodes to exist in Firestore.

import { collection, getDocs, limit, query, type Firestore } from 'firebase/firestore'
import senators from './data/historicalsenators300.json'
import senatorEdges from './data/historicalsenators300_edges.json'
import wars from './nodes/cyto.json'
import { COL, sourcedEdgeId, type EdgeDoc, type InterestTag, type NodeDoc } from './schema'

export interface GraphNode {
  id: string // Wikidata QID
  name: string
  dateStart: string | null
  dateEnd: string | null
  tags: InterestTag[]
  summary: string
  wikiUrl: string
  image: string | null
  starCount: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  kind: EdgeDoc['kind']
  relation: string | null
  type: EdgeDoc['type']
  proposedBy: string | null
  promoted: boolean
  score: number
}

export interface Graph {
  source: 'firestore' | 'local'
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// Free plan: keep a page load well under the daily read quota.
const MAX_DOCS = 1000

export async function loadGraph(db: Firestore): Promise<Graph> {
  const [nodeSnap, edgeSnap] = await Promise.all([
    getDocs(query(collection(db, COL.nodes), limit(MAX_DOCS))),
    getDocs(query(collection(db, COL.edges), limit(MAX_DOCS))),
  ])
  if (nodeSnap.empty) return localGraph()

  const nodes = nodeSnap.docs.map((d) => {
    const n = d.data() as NodeDoc
    return {
      id: d.id,
      name: n.name,
      dateStart: n.dateStart,
      dateEnd: n.dateEnd,
      tags: n.tags ?? [],
      summary: n.summary ?? '',
      wikiUrl: n.wikiUrl ?? '',
      image: n.image ?? null,
      starCount: n.starCount ?? 0,
    }
  })
  const ids = new Set(nodes.map((n) => n.id))
  const edges = edgeSnap.docs
    .map((d) => {
      const e = d.data() as EdgeDoc
      return {
        id: d.id,
        source: e.source,
        target: e.target,
        kind: e.kind,
        relation: e.relation,
        type: e.type,
        proposedBy: e.proposedBy,
        promoted: e.promoted,
        score: e.score,
      }
    })
    .filter((e) => ids.has(e.source) && ids.has(e.target))
  return { source: 'firestore', nodes, edges }
}

// --------------------------------------------------------------------------
// Local fallback. scripts/upload_graph.py does the same conversion in Python.
// --------------------------------------------------------------------------

const qid = (id: string) => id.split('/').pop() ?? id
const day = (date: string | undefined) => (date ? date.slice(0, 10) : null)
const wikiUrl = (name: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replaceAll(' ', '_'))}`

export function localGraph(): Graph {
  const nodes = new Map<string, GraphNode>()

  for (const { data: w } of wars.nodes) {
    nodes.set(w.id, {
      id: w.id,
      name: w.label,
      dateStart: day(w.startDate),
      dateEnd: day(w.endDate),
      tags: ['Wars & Conflicts'],
      summary: '',
      wikiUrl: wikiUrl(w.label),
      image: null,
      starCount: 0,
    })
  }
  for (const s of senators) {
    const id = qid(s.id)
    if (nodes.has(id)) continue
    nodes.set(id, {
      id,
      name: s.label,
      dateStart: day(s.birthDate),
      dateEnd: day(s.deathDate),
      tags: ['Politics & Government'],
      summary: s.wikiIntro ?? '',
      wikiUrl: wikiUrl(s.label),
      image: s.image ?? null,
      starCount: 0,
    })
  }

  const links = [
    ...wars.edges.map((e) => e.data),
    ...(senatorEdges as Array<{ source: string; target: string }>),
  ]
  const edges = new Map<string, GraphEdge>()
  for (const l of links) {
    const source = qid(l.source)
    const target = qid(l.target)
    if (!nodes.has(source) || !nodes.has(target) || source === target) continue
    const id = sourcedEdgeId(source, null, target)
    edges.set(id, {
      id, source, target, kind: 'wikipedia', relation: null, type: null,
      proposedBy: null, promoted: false, score: 0,
    })
  }

  return { source: 'local', nodes: [...nodes.values()], edges: [...edges.values()] }
}
