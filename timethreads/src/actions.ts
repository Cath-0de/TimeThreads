// Every write the app makes to Firestore goes through these helpers.
// firestore.rules only accepts writes shaped exactly like these (for example,
// a vote must change the target's counters in the same transaction), so
// writing to Firestore some other way will fail with "Missing or
// insufficient permissions". Each function takes `db` so tests can pass an
// emulator instance; in the app pass `db` from './firebase'.

import {
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import {
  COL,
  PROMOTE_AT,
  dayKey,
  voteId,
  type CommunityType,
  type InterestTag,
  type PostKind,
  type TargetType,
  type UserDoc,
  type VoteTargetType,
} from './schema'

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const ADJECTIVES = ['Amber', 'Gilded', 'Quiet', 'Wandering', 'Ashen', 'Ivory', 'Crimson', 'Lantern']
const NOUNS = ['Cartographer', 'Archivist', 'Scribe', 'Chronicler', 'Herald', 'Pilgrim', 'Scholar', 'Navigator']

function randomPseudonym(): string {
  const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)]
  return `${pick(ADJECTIVES)} ${pick(NOUNS)} ${Math.floor(100 + Math.random() * 900)}`
}

/** Creates the user doc on first sign-in. Safe to call on every sign-in. */
export async function ensureUser(db: Firestore, uid: string): Promise<UserDoc> {
  const ref = doc(db, COL.users, uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data() as UserDoc
  const fresh = { pseudonym: randomPseudonym(), interests: [], createdAt: serverTimestamp() }
  await writeBatch(db).set(ref, fresh).commit()
  return (await getDoc(ref)).data() as UserDoc
}

export async function setInterests(db: Firestore, uid: string, interests: InterestTag[]) {
  const batch = writeBatch(db)
  batch.update(doc(db, COL.users, uid), { interests })
  await batch.commit()
}

// ---------------------------------------------------------------------------
// Visits: Personal view history + Popular view daily bucket
// ---------------------------------------------------------------------------

export async function recordVisit(db: Firestore, uid: string, nodeId: string) {
  const batch = writeBatch(db)
  batch.set(
    doc(db, COL.users, uid, COL.history, nodeId),
    { nodeId, count: increment(1), lastViewedAt: serverTimestamp() },
    { merge: true },
  )
  batch.set(
    doc(db, COL.activity, dayKey(), COL.nodes, nodeId),
    { nodeId, visits: increment(1) },
    { merge: true },
  )
  await batch.commit()
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export interface NewPost {
  targetType: TargetType
  targetId: string
  body: string
  kind: Exclude<PostKind, 'propose_edge'>
  replyToPostId?: string | null
  citations?: string[]
}

function postFields(uid: string, pseudonym: string, p: NewPost | (Omit<NewPost, 'kind'> & { kind: PostKind })) {
  return {
    targetType: p.targetType,
    targetId: p.targetId,
    author: uid,
    pseudonym,
    body: p.body,
    kind: p.kind,
    replyToPostId: p.replyToPostId ?? null,
    proposedEdgeId: null as string | null,
    citations: p.citations ?? [],
    upvotes: 0,
    downvotes: 0,
    score: 0,
    createdAt: serverTimestamp(),
  }
}

async function pseudonymOf(db: Firestore, uid: string): Promise<string> {
  const snap = await getDoc(doc(db, COL.users, uid))
  if (!snap.exists()) throw new Error('Call ensureUser() after sign-in before posting.')
  return (snap.data() as UserDoc).pseudonym
}

/** Adds a post to a node's or edge's thread and bumps that target's activity. */
export async function createPost(db: Firestore, uid: string, p: NewPost): Promise<string> {
  const pseudonym = await pseudonymOf(db, uid)
  const postRef = doc(collection(db, COL.posts))
  const targetRef = doc(db, p.targetType === 'node' ? COL.nodes : COL.edges, p.targetId)
  const batch = writeBatch(db)
  batch.set(postRef, postFields(uid, pseudonym, p))
  batch.update(targetRef, { postCount: increment(1), lastActivityAt: serverTimestamp() })
  await batch.commit()
  return postRef.id
}

/** Deletes your own post. Counters on the target are left alone. */
export async function deletePost(db: Firestore, postId: string) {
  const batch = writeBatch(db)
  batch.delete(doc(db, COL.posts, postId))
  await batch.commit()
}

// ---------------------------------------------------------------------------
// Community edges: a claim or parallel, proposed together with its post
// ---------------------------------------------------------------------------

export interface NewEdge {
  source: string
  target: string
  type: CommunityType
  body: string // the post making the case
  citations?: string[]
}

export async function proposeEdge(db: Firestore, uid: string, e: NewEdge): Promise<{ edgeId: string; postId: string }> {
  if (e.source === e.target) throw new Error('An edge needs two different nodes.')
  const pseudonym = await pseudonymOf(db, uid)
  const edgeRef = doc(collection(db, COL.edges))
  const postRef = doc(collection(db, COL.posts))
  const batch = writeBatch(db)
  batch.set(edgeRef, {
    source: e.source,
    target: e.target,
    nodeIds: [e.source, e.target],
    kind: 'community',
    relation: null,
    type: e.type,
    proposedBy: uid,
    originPostId: postRef.id,
    promoted: false,
    upvotes: 0,
    downvotes: 0,
    score: 0,
    postCount: 1,
    lastActivityAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  })
  batch.set(postRef, {
    ...postFields(uid, pseudonym, {
      targetType: 'edge',
      targetId: edgeRef.id,
      body: e.body,
      kind: 'propose_edge',
      citations: e.citations,
    }),
    proposedEdgeId: edgeRef.id,
  })
  await batch.commit()
  return { edgeId: edgeRef.id, postId: postRef.id }
}

// ---------------------------------------------------------------------------
// Votes. value: 1 = upvote, -1 = downvote, 0 = remove my vote.
// Clicking the same arrow twice should call this with 0.
// ---------------------------------------------------------------------------

export async function castVote(
  db: Firestore,
  uid: string,
  targetType: VoteTargetType,
  targetId: string,
  value: 1 | -1 | 0,
) {
  const voteRef = doc(db, COL.votes, voteId(uid, targetId))
  const targetRef = doc(db, targetType === 'post' ? COL.posts : COL.edges, targetId)

  await runTransaction(db, async (tx) => {
    const [voteSnap, targetSnap] = await Promise.all([tx.get(voteRef), tx.get(targetRef)])
    if (!targetSnap.exists()) throw new Error(`No ${targetType} ${targetId}`)
    const before: number = voteSnap.exists() ? voteSnap.data().value : 0
    if (before === value) return // nothing to change

    const t = targetSnap.data()
    const upvotes = t.upvotes + (value === 1 ? 1 : 0) - (before === 1 ? 1 : 0)
    const downvotes = t.downvotes + (value === -1 ? 1 : 0) - (before === -1 ? 1 : 0)
    const score = t.score + value - before

    if (value === 0) tx.delete(voteRef)
    else tx.set(voteRef, { uid, targetType, targetId, value })

    const counters: Record<string, unknown> = { upvotes, downvotes, score }
    if (targetType === 'edge' && t.kind === 'community') counters.promoted = score >= PROMOTE_AT
    tx.update(targetRef, counters)
  })
}

// ---------------------------------------------------------------------------
// Stars (Follow tab). Nodes also keep a public starCount.
// ---------------------------------------------------------------------------

export async function setStar(db: Firestore, uid: string, targetType: TargetType, targetId: string, starred: boolean) {
  const starRef = doc(db, COL.users, uid, COL.stars, targetId)
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(starRef)
    if (existing.exists() === starred) return
    if (starred) tx.set(starRef, { targetType, targetId, createdAt: serverTimestamp() })
    else tx.delete(starRef)
    if (targetType === 'node') {
      tx.update(doc(db, COL.nodes, targetId), { starCount: increment(starred ? 1 : -1) })
    }
  })
}
