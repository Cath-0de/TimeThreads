// Security rules tests. Run from the timethreads folder with:
//   npm run test:rules
// This starts a local Firestore emulator (needs Java 11+ and the Firebase
// CLI), runs these tests against firestore.rules, and shuts it down.
// Nothing touches the real database.

import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import { castVote, createPost, deletePost, ensureUser, proposeEdge, recordVisit, setStar } from '../src/actions'
import { PROMOTE_AT, dayKey, voteId } from '../src/schema'

let env: RulesTestEnvironment

const asUser = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore
const anon = () => env.unauthenticatedContext().firestore() as unknown as Firestore

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-timethreads',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
})

afterAll(() => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  // Seed two nodes and one sourced edge the way the pipeline would.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    const node = { name: '', dateStart: null, dateEnd: null, tags: [], summary: '', wikiUrl: '', externalLinks: [], starCount: 0, lastActivityAt: null }
    await setDoc(doc(db, 'nodes/Q1'), { ...node, name: 'Napoleon' })
    await setDoc(doc(db, 'nodes/Q2'), { ...node, name: 'Battle of Waterloo' })
    await setDoc(doc(db, 'edges/Q2_defeated_Q1'), {
      source: 'Q2', target: 'Q1', nodeIds: ['Q2', 'Q1'], kind: 'wikidata', relation: 'defeated',
      type: null, proposedBy: null, originPostId: null, promoted: false,
      upvotes: 0, downvotes: 0, score: 0, postCount: 0, lastActivityAt: null, createdAt: new Date(),
    })
  })
})

describe('users', () => {
  it('lets a user create and read their own profile, not someone else’s', async () => {
    const alice = asUser('alice')
    await assertSucceeds(ensureUser(alice, 'alice'))
    await assertFails(getDoc(doc(asUser('bob'), 'users/alice')))
  })

  it('blocks signed-out reads of the graph', async () => {
    await assertFails(getDoc(doc(anon(), 'nodes/Q1')))
  })

    it('gives an Adjective Animal pseudonym with no number', async () => {
    const { pseudonym } = await ensureUser(asUser('alice'), 'alice')
    expect(pseudonym).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
  })

  it('keeps the same pseudonym on later sign-ins', async () => {
    const alice = asUser('alice')
    const first = await ensureUser(alice, 'alice')
    const again = await ensureUser(alice, 'alice')
    expect(again.pseudonym).toBe(first.pseudonym)
  })

  it('never gives two users the same pseudonym', async () => {
    const { pseudonym } = await ensureUser(asUser('alice'), 'alice')
    const bob = asUser('bob')
    const batch = writeBatch(bob)
    batch.set(doc(bob, 'pseudonyms', pseudonym), { claimedAt: serverTimestamp() })
    batch.set(doc(bob, 'users/bob'), { pseudonym, interests: [], createdAt: serverTimestamp() })
    await assertFails(batch.commit())
  })

  it('rejects a pseudonym that was not claimed', async () => {
    const bob = asUser('bob')
    await assertFails(setDoc(doc(bob, 'users/bob'), { pseudonym: 'Amber Otter', interests: [], createdAt: serverTimestamp() }))
  })

  it('does not let a user claim names for someone else or release them', async () => {
    const { pseudonym } = await ensureUser(asUser('alice'), 'alice')
    await assertFails(setDoc(doc(asUser('bob'), 'pseudonyms', 'Quiet Fox'), { claimedAt: serverTimestamp() }))
    await assertFails(deleteDoc(doc(asUser('alice'), 'pseudonyms', pseudonym)))
  })

  it('does not let a user rename their pseudonym', async () => {
    const alice = asUser('alice')
    await ensureUser(alice, 'alice')
    await assertFails(updateDoc(doc(alice, 'users/alice'), { pseudonym: 'Someone Else' }))
  })
})

describe('posts', () => {
    it('creates a post and marks the node active, without a post count', async () => {
    const alice = asUser('alice')
    await ensureUser(alice, 'alice')
    await assertSucceeds(createPost(alice, 'alice', { targetType: 'node', targetId: 'Q1', body: 'Hi', kind: 'viewpoint' }))
    const node = (await getDoc(doc(alice, 'nodes/Q1'))).data()!
    expect(node.lastActivityAt).not.toBeNull()
    expect(node.postCount).toBeUndefined()
  })

  it('does not let anyone add a post count to a node', async () => {
    await assertFails(updateDoc(doc(asUser('alice'), 'nodes/Q1'), { postCount: 1 }))
  })

  it('rejects a post under someone else’s pseudonym or author', async () => {
    const alice = asUser('alice')
    await ensureUser(alice, 'alice')
    await ensureUser(asUser('bob'), 'bob')
    const base = {
      targetType: 'node', targetId: 'Q1', body: 'x', kind: 'support', replyToPostId: null,
      proposedEdgeId: null, citations: [], upvotes: 0, downvotes: 0, score: 0,
    }
    await assertFails(setDoc(doc(alice, 'posts/p1'), { ...base, author: 'bob', pseudonym: 'Fake', createdAt: new Date() }))
  })

  it('lets only the author edit or delete a post', async () => {
    const alice = asUser('alice')
    const bob = asUser('bob')
    await ensureUser(alice, 'alice')
    const postId = await createPost(alice, 'alice', { targetType: 'node', targetId: 'Q1', body: 'Hi', kind: 'viewpoint' })

    await assertFails(updateDoc(doc(bob, 'posts', postId), { body: 'Edited by Bob' }))
    await assertFails(deletePost(bob, postId))
    await assertFails(updateDoc(doc(alice, 'posts', postId), { author: 'bob' }))

    await assertSucceeds(updateDoc(doc(alice, 'posts', postId), { body: 'Edited', citations: ['https://example.com'] }))
    await assertSucceeds(deletePost(alice, postId))
  })

  it('rejects a post that starts with a fake score', async () => {
    const alice = asUser('alice')
    const { pseudonym } = await ensureUser(alice, 'alice')
    const batch = writeBatch(alice)
    batch.set(doc(alice, 'posts/p1'), {
      targetType: 'node', targetId: 'Q1', author: 'alice', pseudonym, body: 'x', kind: 'support',
      replyToPostId: null, proposedEdgeId: null, citations: [], upvotes: 99, downvotes: 0, score: 99,
      createdAt: new Date(),
    })
    await assertFails(batch.commit())
  })
})

describe('community edges and votes', () => {
  async function setup() {
    const alice = asUser('alice')
    await ensureUser(alice, 'alice')
    const { edgeId, postId } = await proposeEdge(alice, 'alice', { source: 'Q1', target: 'Q2', type: 'parallel', body: 'These echo each other' })
    return { alice, edgeId, postId }
  }

  it('lets a user propose a claim or parallel with its post', async () => {
    const { alice, edgeId } = await setup()
    const edge = await getDoc(doc(alice, 'edges', edgeId))
    expect(edge.data()?.kind).toBe('community')
    expect(edge.data()?.promoted).toBe(false)
  })

  it('blocks proposing an already-promoted edge', async () => {
    const alice = asUser('alice')
    await ensureUser(alice, 'alice')
    await assertFails(setDoc(doc(alice, 'edges/e1'), {
      source: 'Q1', target: 'Q2', nodeIds: ['Q1', 'Q2'], kind: 'community', relation: null, type: 'claim',
      proposedBy: 'alice', originPostId: 'p1', promoted: true, upvotes: 0, downvotes: 0, score: 0,
      postCount: 1, lastActivityAt: new Date(), createdAt: new Date(),
    }))
  })

  it('counts one vote per user, and switching or removing a vote stays consistent', async () => {
    const { alice, edgeId } = await setup()
    const bob = asUser('bob')
    await assertSucceeds(castVote(bob, 'bob', 'edge', edgeId, 1))
    await assertSucceeds(castVote(bob, 'bob', 'edge', edgeId, 1)) // no-op, not a second vote
    let e = (await getDoc(doc(alice, 'edges', edgeId))).data()!
    expect([e.upvotes, e.downvotes, e.score]).toEqual([1, 0, 1])

    await assertSucceeds(castVote(bob, 'bob', 'edge', edgeId, -1))
    e = (await getDoc(doc(alice, 'edges', edgeId))).data()!
    expect([e.upvotes, e.downvotes, e.score]).toEqual([0, 1, -1])

    await assertSucceeds(castVote(bob, 'bob', 'edge', edgeId, 0))
    e = (await getDoc(doc(alice, 'edges', edgeId))).data()!
    expect([e.upvotes, e.downvotes, e.score]).toEqual([0, 0, 0])
  })

  it('rejects changing the score without a matching vote', async () => {
    const { edgeId } = await setup()
    const bob = asUser('bob')
    await assertFails(updateDoc(doc(bob, 'edges', edgeId), { score: 10, upvotes: 10, promoted: true }))
  })

  it('rejects a vote that moves the score by more than one', async () => {
    const { edgeId } = await setup()
    const bob = asUser('bob')
    const batch = writeBatch(bob)
    batch.set(doc(bob, 'votes', voteId('bob', edgeId)), { uid: 'bob', targetType: 'edge', targetId: edgeId, value: 1 })
    batch.update(doc(bob, 'edges', edgeId), { upvotes: 5, score: 5, promoted: true })
    await assertFails(batch.commit())
  })

  it('rejects voting on behalf of someone else', async () => {
    const { edgeId } = await setup()
    const bob = asUser('bob')
    const batch = writeBatch(bob)
    batch.set(doc(bob, 'votes', voteId('carol', edgeId)), { uid: 'carol', targetType: 'edge', targetId: edgeId, value: 1 })
    batch.update(doc(bob, 'edges', edgeId), { upvotes: 1, score: 1 })
    await assertFails(batch.commit())
  })

  it(`promotes at a score of ${PROMOTE_AT}, not before`, async () => {
    const { alice, edgeId } = await setup()
    for (let i = 1; i <= PROMOTE_AT; i++) {
      await castVote(asUser(`voter${i}`), `voter${i}`, 'edge', edgeId, 1)
      const e = (await getDoc(doc(alice, 'edges', edgeId))).data()!
      expect(e.promoted).toBe(i >= PROMOTE_AT)
    }
  })

  it('does not allow voting on sourced (Wikidata) edges', async () => {
    await assertFails(castVote(asUser('bob'), 'bob', 'edge', 'Q2_defeated_Q1', 1))
  })

  it('does not let the proposer vote on their own edge', async () => {
    const { alice, edgeId } = await setup()
    await expect(castVote(alice, 'alice', 'edge', edgeId, 1)).rejects.toThrow()
    // Bypassing castVote's check still hits the rule.
    const batch = writeBatch(alice)
    batch.set(doc(alice, 'votes', voteId('alice', edgeId)), { uid: 'alice', targetType: 'edge', targetId: edgeId, value: 1 })
    batch.update(doc(alice, 'edges', edgeId), { upvotes: 1, score: 1 })
    await assertFails(batch.commit())
  })

  it('does not let an author vote on their own post', async () => {
    const { alice, postId } = await setup()
    await expect(castVote(alice, 'alice', 'post', postId, 1)).rejects.toThrow()
    // Bypassing castVote's check still hits the rule.
    const batch = writeBatch(alice)
    batch.set(doc(alice, 'votes', voteId('alice', postId)), { uid: 'alice', targetType: 'post', targetId: postId, value: 1 })
    batch.update(doc(alice, 'posts', postId), { upvotes: 1, score: 1 })
    await assertFails(batch.commit())
  })

  it('lets users vote on posts the same way', async () => {
    const { postId } = await setup()
    await assertSucceeds(castVote(asUser('bob'), 'bob', 'post', postId, 1))
  })
})

describe('stars, history and popularity', () => {
  it('keeps stars private and moves starCount only with a real star', async () => {
    const alice = asUser('alice')
    await assertSucceeds(setStar(alice, 'alice', 'node', 'Q1', true))
    await assertSucceeds(setStar(alice, 'alice', 'node', 'Q1', true)) // already starred: no change
    expect((await getDoc(doc(alice, 'nodes/Q1'))).data()?.starCount).toBe(1)
    await assertFails(getDoc(doc(asUser('bob'), 'users/alice/stars/Q1')))
    await assertFails(updateDoc(doc(asUser('bob'), 'nodes/Q1'), { starCount: 50 }))
  })

  it('records visits to history and to today’s activity bucket', async () => {
    const alice = asUser('alice')
    await assertSucceeds(recordVisit(alice, 'alice', 'Q1'))
    await assertSucceeds(recordVisit(alice, 'alice', 'Q1'))
    expect((await getDoc(doc(alice, 'users/alice/history/Q1'))).data()?.count).toBe(2)
    expect((await getDoc(doc(alice, 'activity', dayKey(), 'nodes', 'Q1'))).data()?.visits).toBe(2)
    await assertFails(updateDoc(doc(alice, 'activity', dayKey(), 'nodes', 'Q1'), { visits: 1000 }))
  })
})
