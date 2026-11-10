import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { castVote, createPost, deletePost } from '../actions'
import { db } from '../firebase'
import { messageOf } from '../messages'
import { COL, voteId, type PostDoc, type PostKind, type TargetType } from '../schema'

type Post = PostDoc & { id: string; myVote: number }

type ThreadProps = {
  targetType: TargetType
  targetId: string
  uid: string
  canWrite: boolean
}

const KIND_LABELS: Record<PostKind, string> = {
  support: 'Support',
  counter: 'Counter',
  viewpoint: 'Viewpoint',
  propose_edge: 'Proposed this link',
}

export default function Thread({ targetType, targetId, uid, canWrite }: ThreadProps) {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      // Sorted here rather than with orderBy, so no composite index is needed.
      const snap = await getDocs(query(collection(db, COL.posts), where('targetId', '==', targetId)))
      const list = await Promise.all(
        snap.docs.map(async (d) => {
          const vote = await getDoc(doc(db, COL.votes, voteId(uid, d.id)))
          return { ...(d.data() as PostDoc), id: d.id, myVote: vote.exists() ? vote.data().value : 0 }
        }),
      )
      list.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      setPosts(list)
    } catch (err) {
      setError(messageOf(err))
      setPosts([])
    }
  }, [targetId, uid])

  // The parent remounts this per target (key), so state starts fresh.
  useEffect(() => {
    if (canWrite) void load()
  }, [load, canWrite])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      await load()
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const body = String(data.get('body')).trim()
    const citation = String(data.get('citation')).trim()
    if (!body) return
    void run(async () => {
      await createPost(db, uid, {
        targetType,
        targetId,
        body,
        kind: data.get('kind') as 'support' | 'counter' | 'viewpoint',
        citations: citation ? [citation] : [],
      })
      form.reset()
    })
  }

  if (!canWrite) return null

  return (
    <section className="thread">
      <h3>Discussion</h3>
      {error && <p className="auth-error" role="alert">{error}</p>}

      <form className="stack-form" onSubmit={handleSubmit}>
        <select name="kind" defaultValue="viewpoint" aria-label="Post type">
          <option value="viewpoint">Viewpoint</option>
          <option value="support">Support</option>
          <option value="counter">Counter</option>
        </select>
        <textarea name="body" rows={3} maxLength={5000} placeholder="Add to the discussion…" required />
        <input name="citation" type="url" placeholder="Source link (optional)" />
        <button type="submit" className="small-button" disabled={busy}>Post</button>
      </form>

      {posts === null ? (
        <p role="status">Loading posts…</p>
      ) : posts.length === 0 ? (
        <p>No posts yet. Start the discussion.</p>
      ) : (
        <ul className="post-list">
          {posts.map((p) => (
            <li key={p.id} className="post">
              <p className="post-meta">
                <strong>{p.pseudonym}</strong> · {KIND_LABELS[p.kind]}
              </p>
              <p className="post-body">{p.body}</p>
              {p.citations.map((c) => (
                <a key={c} href={c} target="_blank" rel="noreferrer" className="citation">{c}</a>
              ))}
              <div className="post-actions">
                {p.author === uid ? (
                  <>
                    <span>Score {p.score}</span>
                    <button type="button" className="link-button" disabled={busy}
                      onClick={() => void run(() => deletePost(db, p.id))}>Delete</button>
                  </>
                ) : (
                  <VoteButtons score={p.score} myVote={p.myVote} disabled={busy}
                    onVote={(v) => void run(() => castVote(db, uid, 'post', p.id, v))} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

type VoteButtonsProps = {
  score: number
  myVote: number
  disabled: boolean
  onVote: (value: 1 | -1 | 0) => void
}

/** Clicking the arrow you already chose removes your vote. */
export function VoteButtons({ score, myVote, disabled, onVote }: VoteButtonsProps) {
  return (
    <span className="votes">
      <button type="button" aria-label="Upvote" aria-pressed={myVote === 1} disabled={disabled}
        onClick={() => onVote(myVote === 1 ? 0 : 1)}>▲</button>
      <span>{score}</span>
      <button type="button" aria-label="Downvote" aria-pressed={myVote === -1} disabled={disabled}
        onClick={() => onVote(myVote === -1 ? 0 : -1)}>▼</button>
    </span>
  )
}
