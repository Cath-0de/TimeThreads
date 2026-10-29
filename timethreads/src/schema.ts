// TimeThreads Firestore schema: the single source of truth for collection
// names, document shapes and document IDs. The rules in /firestore.rules
// enforce exactly these shapes, and the Python pipeline must write the same
// field names. Change a field here, in firestore.rules and in the pipeline
// together.

import type { Timestamp } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// Collection paths
// ---------------------------------------------------------------------------

export const COL = {
  users: 'users',
  stars: 'stars', // subcollection: users/{uid}/stars/{targetId}
  history: 'history', // subcollection: users/{uid}/history/{nodeId}
  nodes: 'nodes',
  edges: 'edges',
  posts: 'posts',
  votes: 'votes',
  activity: 'activity', // activity/{yyyy-mm-dd}/nodes/{nodeId}
  pseudonyms: 'pseudonyms', // pseudonyms/{name}: one doc per taken name
} as const

// A community edge is promoted once its score reaches this. Must match
// PROMOTE_AT in firestore.rules.
export const PROMOTE_AT = 5

export const INTEREST_TAGS = [
  'Wars & Conflicts',
  'Politics & Government',
  'Science & Technology',
  'Art & Culture',
  'Religion & Philosophy',
  'Exploration & Migration',
  'Economics & Trade',
] as const
export type InterestTag = (typeof INTEREST_TAGS)[number]

// ---------------------------------------------------------------------------
// users/{uid} (private to the owner)
// ---------------------------------------------------------------------------

export interface UserDoc {
  pseudonym: string // "Adjective Animal", unique, generated once; copied onto every post
  interests: InterestTag[]
  createdAt: Timestamp
}

// pseudonyms/{name}  - claims a name so no two users share it. Written once,
// together with the user doc, and never changed or deleted. Holds no user ID
// so a name can't be traced back to an account.
export interface PseudonymDoc {
  claimedAt: Timestamp
}

// users/{uid}/stars/{targetId}  (Follow tab)
export interface StarDoc {
  targetType: TargetType
  targetId: string
  createdAt: Timestamp
}

// users/{uid}/history/{nodeId}  (Personal view)
export interface HistoryDoc {
  nodeId: string
  count: number
  lastViewedAt: Timestamp
}

// ---------------------------------------------------------------------------
// nodes/{qid}  - doc ID is the Wikidata QID, e.g. "Q362". Pipeline-written.
// ---------------------------------------------------------------------------

export interface NodeDoc {
  name: string
  dateStart: string | null // ISO-ish, e.g. "1939-09-01" or "-0490" for BCE
  dateEnd: string | null
  tags: InterestTag[]
  summary: string // Wikipedia intro, 3-4 sentences
  wikiUrl: string
  externalLinks: string[]
  // Kept up to date by the app: starCount moves with each star/unstar,
  // lastActivityAt is set when someone posts in the node's thread.
  starCount: number
  lastActivityAt: Timestamp | null
}

// ---------------------------------------------------------------------------
// edges/{edgeId}  - sourced (pipeline) and community edges in one collection
// ---------------------------------------------------------------------------

export type EdgeKind = 'wikidata' | 'wikipedia' | 'community'
export type CommunityType = 'claim' | 'parallel'

export interface EdgeDoc {
  source: string // node QID
  target: string // node QID
  nodeIds: [string, string] // [source, target]; query with array-contains
  kind: EdgeKind
  relation: string | null // "defeated", "succeeded"...; null = untyped link
  type: CommunityType | null // community edges only
  // Community edges only (sourced edges leave these at their defaults).
  proposedBy: string | null // uid
  originPostId: string | null
  promoted: boolean
  upvotes: number
  downvotes: number
  score: number
  postCount: number
  lastActivityAt: Timestamp | null
  createdAt: Timestamp
}

// ---------------------------------------------------------------------------
// posts/{postId}  - flat threads on nodes and edges
// ---------------------------------------------------------------------------

export type TargetType = 'node' | 'edge'
export type PostKind = 'support' | 'counter' | 'viewpoint' | 'propose_edge'

export interface PostDoc {
  targetType: TargetType
  targetId: string
  author: string // uid; never shown in the UI
  pseudonym: string // what the UI shows
  body: string
  kind: PostKind
  replyToPostId: string | null // the post this one argues against, if any
  proposedEdgeId: string | null // set when kind === 'propose_edge'
  citations: string[]
  upvotes: number
  downvotes: number
  score: number
  createdAt: Timestamp
}

// ---------------------------------------------------------------------------
// votes/{uid}_{targetId}  - one vote per user per post or edge
// ---------------------------------------------------------------------------

export type VoteTargetType = 'post' | 'edge'

export interface VoteDoc {
  uid: string
  targetType: VoteTargetType
  targetId: string
  value: 1 | -1
}

// ---------------------------------------------------------------------------
// activity/{yyyy-mm-dd}/nodes/{nodeId}  - daily buckets for the Popular view
// ---------------------------------------------------------------------------

export interface ActivityDoc {
  nodeId: string
  visits: number
}

// ---------------------------------------------------------------------------
// Document IDs
// ---------------------------------------------------------------------------

/** Sourced edge ID; re-running the pipeline overwrites instead of duplicating. */
export function sourcedEdgeId(source: string, relation: string | null, target: string): string {
  return `${source}_${relation ?? 'link'}_${target}`
}

export function voteId(uid: string, targetId: string): string {
  return `${uid}_${targetId}`
}

/** UTC day key for activity buckets, e.g. "2026-10-14". */
export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

/** The last `days` day keys, newest first (Popular view reads these). */
export function lastDayKeys(days = 7, from: Date = new Date()): string[] {
  return Array.from({ length: days }, (_, i) =>
    dayKey(new Date(from.getTime() - i * 86_400_000)),
  )
}
