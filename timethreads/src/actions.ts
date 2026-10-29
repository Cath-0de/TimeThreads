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
  Timestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'

import { ADJECTIVES, ANIMALS } from './pseudonymWords.ts'

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

function randomPseudonym(): string {
  const pick = (list: readonly string[]) => list[Math.floor(Math.random() * list.length)]
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`
}

// How many random names to try before giving up. With 24,000 combinations
// this only matters once most names are taken.
const PSEUDONYM_ATTEMPTS = 20

/**
 * Creates the user doc on first sign-in with a unique "Adjective Animal"
 * pseudonym. Safe to call on every sign-in: an existing user keeps theirs.
 *
 * Uniqueness: each name is claimed by a doc at pseudonyms/{name}, written in
 * the same transaction as the user doc. The rules refuse a claim on a name
 * that already has one, so two users can never end up with the same name.
 */
export async function ensureUser(db: Firestore, uid: string): Promise<UserDoc> {
  const userRef = doc(db, COL.users, uid)
  return runTransaction(db, async (tx) => {
    const existing = await tx.get(userRef)
    if (existing.exists()) return existing.data() as UserDoc

    for (let i = 0; i < PSEUDONYM_ATTEMPTS; i++) {
      const pseudonym = randomPseudonym()
      const claimRef = doc(db, COL.pseudonyms, pseudonym)
      if ((await tx.get(claimRef)).exists()) continue // taken, try another

      tx.set(claimRef, { claimedAt: serverTimestamp() })
      tx.set(userRef, { pseudonym, interests: [], createdAt: serverTimestamp() })
      return { pseudonym, interests: [], createdAt: Timestamp.now() }
    }
    throw new Error('Could not find a free pseudonym. Add more words to src/pseudonymWords.ts.')
  })
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

/* Adds a post to a node's or edge's thread and marks the target as active.
 * Edges also count their posts; nodes do not keep a post count.
 */
export async function createPost(db: Firestore, uid: string, p: NewPost): Promise<string> {
  const pseudonym = await pseudonymOf(db, uid)
  const postRef = doc(collection(db, COL.posts))
  const batch = writeBatch(db)
  batch.set(postRef, postFields(uid, pseudonym, p))
  if (p.targetType === 'node') {
    batch.update(doc(db, COL.nodes, p.targetId), { lastActivityAt: serverTimestamp() })
  } else {
    batch.update(doc(db, COL.edges, p.targetId), { postCount: increment(1), lastActivityAt: serverTimestamp() })
  }
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
    if (targetType === 'edge' && targetSnap.data().proposedBy === uid) {
      throw new Error('You can’t vote on an edge you proposed.')
    }
    if (targetType === 'post' && targetSnap.data().author === uid) {
      throw new Error('You can’t vote on your own post.')
    }
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
