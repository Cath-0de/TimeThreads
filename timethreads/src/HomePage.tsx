import { useCallback, useEffect, useState, type FormEvent } from 'react'
import DetailPanel from './components/DetailPanel'
import GraphView, { type Selection } from './components/GraphView'
import { db } from './firebase'
import { loadGraph, localGraph, type Graph } from './graphData'
import { messageOf } from './messages'

type HomePageProps = {
  uid: string
  profileReady: boolean
}

export default function HomePage({ uid, profileReady }: HomePageProps) {
  const [graph, setGraph] = useState<Graph | null>(null)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<Selection>(null)

  const refresh = useCallback(async () => {
    try {
      setGraph(await loadGraph(db))
    } catch (err) {
      setLoadError(messageOf(err))
      setGraph(localGraph())
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!graph) {
    return <p role="status">Loading the graph…</p>
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('search')).trim().toLowerCase()
    const match = graph?.nodes.find((n) => n.name.toLowerCase() === name)
      ?? graph?.nodes.find((n) => n.name.toLowerCase().includes(name))
    if (match) setSelected({ type: 'node', id: match.id })
  }

  const canWrite = graph.source === 'firestore' && profileReady

  return (
    <div className="explorer">
      <div className="explorer-toolbar">
        <form onSubmit={handleSearch} className="search-form">
          <input name="search" list="node-names" placeholder="Search people and events…" aria-label="Search" />
          <button type="submit" className="small-button">Find</button>
        </form>
        <p>
          {graph.nodes.length} nodes · {graph.edges.length} connections
        </p>
      </div>

      {graph.source === 'local' && (
        <p className="notice" role="status">
          Showing sample data from the repo because the database has no nodes yet
          {loadError ? ` (${loadError})` : ''}. Posting, following and voting turn on once
          someone runs <code>scripts/upload_graph.py</code>.
        </p>
      )}
      {graph.source === 'firestore' && !profileReady && (
        <p className="notice" role="status">
          Your pseudonym isn't set up yet, so you can browse but not post. See the Profile page.
        </p>
      )}

      <datalist id="node-names">
        {graph.nodes.map((n) => <option key={n.id} value={n.name} />)}
      </datalist>

      <div className="explorer-body">
        <GraphView nodes={graph.nodes} edges={graph.edges} selected={selected} onSelect={setSelected} />
        {selected ? (
          <DetailPanel
            graph={graph}
            selected={selected}
            uid={uid}
            canWrite={canWrite}
            onSelect={setSelected}
            onGraphChanged={refresh}
          />
        ) : (
          <aside className="detail-panel">
            <h2>Explore history</h2>
            <p>Click a node to read about it, or a line to see how two things are connected.</p>
          </aside>
        )}
      </div>
    </div>
  )
}
