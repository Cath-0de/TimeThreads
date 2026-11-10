// Fills the local Firestore emulator with sample data so every collection in
// src/schema.ts shows up in the emulator UI (http://localhost:4000).
//
// From the timethreads folder, in one terminal:
//   npm run emulators
// and once it says "All emulators ready", in a second terminal:
//   npm run seed
//
// This only ever talks to the emulator: it uses the "demo-timethreads"
// project ID (demo- projects cannot reach real Firebase) and the emulator
// host below. It wipes the emulator's data first, so it is safe to rerun.

import { readFileSync } from 'node:fs'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, type Firestore } from 'firebase/firestore'
import { castVote, createPost, ensureUser, proposeEdge, recordVisit, setInterests, setStar } from '../src/actions'
import { COL, sourcedEdgeId, type EdgeDoc, type NodeDoc } from '../src/schema'

const PROJECT_ID = 'demo-timethreads'
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':')

// Nodes and sourced edges are written by the Python pipeline with the Admin
// SDK, so there is no client helper for them. The seed writes them with rules
// disabled, the same way the pipeline bypasses rules.
const NODES: Record<string, Partial<NodeDoc>> = {
  Q517: {
    name: 'Napoleon',
    dateStart: '1769-08-15',
    dateEnd: '1821-05-05',
    tags: ['Wars & Conflicts', 'Politics & Government'],
    summary: 'French military commander and political leader who rose to prominence during the French Revolution.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Napoleon',
  },
  Q48314: {
    name: 'Battle of Waterloo',
    dateStart: '1815-06-18',
    dateEnd: '1815-06-18',
    tags: ['Wars & Conflicts'],
    summary: 'Battle in present-day Belgium that ended the Napoleonic Wars.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Battle_of_Waterloo',
  },
  Q131691: {
    name: 'Arthur Wellesley, 1st Duke of Wellington',
    dateStart: '1769-05-01',
    dateEnd: '1852-09-14',
    tags: ['Wars & Conflicts', 'Politics & Government'],
    summary: 'British Army officer and statesman who defeated Napoleon at Waterloo.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Arthur_Wellesley,_1st_Duke_of_Wellington',
  },
  Q8409: {
    name: 'Alexander the Great',
    dateStart: '-0356',
    dateEnd: '-0323',
    tags: ['Wars & Conflicts', 'Exploration & Migration'],
    summary: 'King of Macedon whose campaigns built one of the largest empires of the ancient world.',
    wikiUrl: 'https://en.wikipedia.org/wiki/Alexander_the_Great',
  },
}

const SOURCED_EDGES: Array<Pick<EdgeDoc, 'source' | 'target' | 'kind' | 'relation'>> = [
  { source: 'Q131691', target: 'Q517', kind: 'wikidata', relation: 'defeated' },
  { source: 'Q48314', target: 'Q517', kind: 'wikidata', relation: 'participant' },
  { source: 'Q48314', target: 'Q131691', kind: 'wikipedia', relation: null },
]

async function main() {
  const env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port: Number(port),
      rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
  })
  const as = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore

  await env.clearFirestore()

  // nodes + sourced edges (pipeline data)
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    for (const [qid, node] of Object.entries(NODES)) {
      await setDoc(doc(db, COL.nodes, qid), {
        dateStart: null, dateEnd: null, tags: [], summary: '', wikiUrl: '', externalLinks: [],
        starCount: 0, lastActivityAt: null,
        ...node,
      })
    }
    for (const e of SOURCED_EDGES) {
      await setDoc(doc(db, COL.edges, sourcedEdgeId(e.source, e.relation, e.target)), {
        ...e,
        nodeIds: [e.source, e.target],
        type: null, proposedBy: null, originPostId: null, promoted: false,
        upvotes: 0, downvotes: 0, score: 0, postCount: 0, lastActivityAt: null, createdAt: new Date(),
      })
    }
  })

  // Everything below goes through src/actions.ts, so it is checked by the rules.
  const alice = as('alice')
  const bob = as('bob')
  const carol = as('carol')

  // users
  await ensureUser(alice, 'alice')
  await ensureUser(bob, 'bob')
  await ensureUser(carol, 'carol')
  await setInterests(alice, 'alice', ['Wars & Conflicts', 'Politics & Government'])
  await setInterests(bob, 'bob', ['Science & Technology', 'Exploration & Migration'])

  // posts on nodes and on a sourced edge
  const p1 = await createPost(alice, 'alice', {
    targetType: 'node', targetId: 'Q517', kind: 'viewpoint',
    body: 'His legal reforms outlasted every one of his conquests.',
    citations: ['https://en.wikipedia.org/wiki/Napoleonic_Code'],
  })
  const p2 = await createPost(bob, 'bob', {
    targetType: 'node', targetId: 'Q517', kind: 'counter', replyToPostId: p1,
    body: 'The Code also rolled back rights for women compared to the revolutionary period.',
  })
  await createPost(carol, 'carol', {
    targetType: 'edge', targetId: sourcedEdgeId('Q131691', 'defeated', 'Q517'), kind: 'support',
    body: 'Wellington held the ridge long enough for the Prussians to arrive.',
  })

  // community edge (with its proposing post)
  const { edgeId, postId: p3 } = await proposeEdge(carol, 'carol', {
    source: 'Q8409', target: 'Q517', type: 'parallel',
    body: 'Both built vast empires quickly that fragmented soon after them.',
  })

  // votes on posts and on the community edge
  await castVote(bob, 'bob', 'post', p1, 1)
  await castVote(carol, 'carol', 'post', p1, 1)
  await castVote(alice, 'alice', 'post', p2, -1)
  await castVote(alice, 'alice', 'post', p3, 1)
  await castVote(alice, 'alice', 'edge', edgeId, 1)
  await castVote(bob, 'bob', 'edge', edgeId, 1)

  // stars (users/{uid}/stars)
  await setStar(alice, 'alice', 'node', 'Q517', true)
  await setStar(bob, 'bob', 'node', 'Q517', true)
  await setStar(carol, 'carol', 'edge', edgeId, true)

  // visits (users/{uid}/history + activity/{day}/nodes)
  await recordVisit(alice, 'alice', 'Q517')
  await recordVisit(alice, 'alice', 'Q517')
  await recordVisit(alice, 'alice', 'Q48314')
  await recordVisit(bob, 'bob', 'Q8409')
  await recordVisit(carol, 'carol', 'Q517')

  await env.cleanup()
  console.log(`Seeded the Firestore emulator at ${host}:${port} (project ${PROJECT_ID}).`)
  console.log('Open http://localhost:4000/firestore to browse it.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
