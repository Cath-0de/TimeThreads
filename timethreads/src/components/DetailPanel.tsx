import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState, type FormEvent } from 'react'
import { castVote, proposeEdge, recordVisit, setStar } from '../actions'
import { db } from '../firebase'
import type { Graph, GraphEdge, GraphNode } from '../graphData'
import { COL, PROMOTE_AT, voteId } from '../schema'
import type { Selection } from './GraphView'
import { messageOf } from '../messages'
import Thread, { VoteButtons } from './Thread'

type DetailPanelProps = {
  graph: Graph
  selected: NonNullable<Selection>
  uid: string
  canWrite: boolean
  onSelect: (selection: Selection) => void
  onGraphChanged: () => Promise<void>
}

export default function DetailPanel(props: DetailPanelProps) {
  const { graph, selected } = props
  if (selected.type === 'node') {
    const node = graph.nodes.find((n) => n.id === selected.id)
    return node ? <NodeDetails key={node.id} node={node} {...props} /> : null
  }
  const edge = graph.edges.find((e) => e.id === selected.id)
  return edge ? <EdgeDetails key={edge.id} edge={edge} {...props} /> : null
}

function NodeDetails({ node, graph, uid, canWrite, onSelect, onGraphChanged }: DetailPanelProps & { node: GraphNode }) {
  const [starred, setStarred] = useState(false)
  const [starCount, setStarCount] = useState(node.starCount)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!canWrite) return
    recordVisit(db, uid, node.id).catch(() => {}) // history is best-effort
    getDoc(doc(db, COL.users, uid, COL.stars, node.id))
      .then((snap) => setStarred(snap.exists()))
      .catch(() => {})
  }, [canWrite, uid, node.id])

  const nameOf = (id: string) => graph.nodes.find((n) => n.id === id)?.name ?? id
  const links = graph.edges.filter((e) => e.source === node.id || e.target === node.id)

  async function toggleStar() {
    setBusy(true)
    setError('')
    try {
      await setStar(db, uid, 'node', node.id, !starred)
      setStarCount((c) => c + (starred ? -1 : 1))
      setStarred(!starred)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  async function handlePropose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const targetName = String(data.get('target')).trim()
    const target = graph.nodes.find((n) => n.name === targetName)
    if (!target) {
      setError(`Pick a node from the list. "${targetName}" isn't in the graph.`)
      return
    }
    setBusy(true)
    setError('')
    try {
      const { edgeId } = await proposeEdge(db, uid, {
        source: node.id,
        target: target.id,
        type: data.get('type') as 'claim' | 'parallel',
        body: String(data.get('body')).trim(),
      })
      form.reset()
      await onGraphChanged()
      onSelect({ type: 'edge', id: edgeId })
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="detail-panel">
      {node.image && <img src={node.image} alt="" className="detail-image" />}
      <h2>{node.name}</h2>
      <p className="detail-dates">{formatDates(node.dateStart, node.dateEnd)}</p>
      <p className="detail-tags">{node.tags.join(' · ')}</p>
      {node.summary && <p>{node.summary}</p>}
      <p className="detail-links">
        {node.wikiUrl && <a href={node.wikiUrl} target="_blank" rel="noreferrer">Wikipedia</a>}
        <a href={`https://www.wikidata.org/wiki/${node.id}`} target="_blank" rel="noreferrer">Wikidata</a>
      </p>

      {canWrite && (
        <button type="button" className="small-button" onClick={() => void toggleStar()} disabled={busy}>
          {starred ? '★ Following' : '☆ Follow'} ({starCount})
        </button>
      )}
      {error && <p className="auth-error" role="alert">{error}</p>}

      <section>
        <h3>Connections ({links.length})</h3>
        {links.length === 0 && <p>No connections yet.</p>}
        <ul className="link-list">
          {links.map((e) => {
            const other = e.source === node.id ? e.target : e.source
            return (
              <li key={e.id}>
                <button type="button" className="link-button" onClick={() => onSelect({ type: 'edge', id: e.id })}>
                  {e.relation ?? e.type ?? 'linked'}
                </button>{' '}
                <button type="button" className="link-button" onClick={() => onSelect({ type: 'node', id: other })}>
                  {nameOf(other)}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {canWrite && (
        <section>
          <h3>Propose a connection</h3>
          <form className="stack-form" onSubmit={(e) => void handlePropose(e)}>
            <input name="target" list="node-names" placeholder="Connect to… (type a name)" required />
            <select name="type" defaultValue="claim" aria-label="Connection type">
              <option value="claim">Claim: one influenced the other</option>
              <option value="parallel">Parallel: they are alike</option>
            </select>
            <textarea name="body" rows={2} maxLength={5000} placeholder="Make the case for this link" required />
            <button type="submit" className="small-button" disabled={busy}>Propose</button>
          </form>
        </section>
      )}

      <Thread targetType="node" targetId={node.id} uid={uid} canWrite={canWrite} />
    </aside>
  )
}

function EdgeDetails({ edge, graph, uid, canWrite, onSelect, onGraphChanged }: DetailPanelProps & { edge: GraphEdge }) {
  const [myVote, setMyVote] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const nameOf = (id: string) => graph.nodes.find((n) => n.id === id)?.name ?? id
  const votable = canWrite && edge.kind === 'community' && edge.proposedBy !== uid

  useEffect(() => {
    if (!votable) return
    getDoc(doc(db, COL.votes, voteId(uid, edge.id)))
      .then((snap) => setMyVote(snap.exists() ? snap.data().value : 0))
      .catch(() => {})
  }, [votable, uid, edge.id])

  async function vote(value: 1 | -1 | 0) {
    setBusy(true)
    setError('')
    try {
      await castVote(db, uid, 'edge', edge.id, value)
      setMyVote(value)
      await onGraphChanged()
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="detail-panel">
      <p className="eyebrow">CONNECTION</p>
      <h2>
        <button type="button" className="link-button" onClick={() => onSelect({ type: 'node', id: edge.source })}>
          {nameOf(edge.source)}
        </button>
        {' → '}
        <button type="button" className="link-button" onClick={() => onSelect({ type: 'node', id: edge.target })}>
          {nameOf(edge.target)}
        </button>
      </h2>
      <p>
        {edge.kind === 'community'
          ? `Community ${edge.type} · ${edge.promoted ? 'promoted' : `needs a score of ${PROMOTE_AT} to be promoted`}`
          : `From ${edge.kind}${edge.relation ? ` · ${edge.relation}` : ''}`}
      </p>
      {edge.kind === 'community' && (
        votable ? (
          <VoteButtons score={edge.score} myVote={myVote} disabled={busy} onVote={(v) => void vote(v)} />
        ) : (
          <p>Score {edge.score}{edge.proposedBy === uid ? ' (you proposed this)' : ''}</p>
        )
      )}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <Thread targetType="edge" targetId={edge.id} uid={uid} canWrite={canWrite} />
    </aside>
  )
}

function formatDates(start: string | null, end: string | null) {
  const fmt = (d: string | null) => (d ? (d.startsWith('-') ? `${Number(d.slice(1, 5))} BCE` : d) : '?')
  if (!start && !end) return 'Dates unknown'
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}
