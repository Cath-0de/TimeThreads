"""Uploads the graph data in src/data and src/nodes to Firestore.

Writes nodes/{qid} and sourced edges in the shapes defined in src/schema.ts.
src/graphData.ts does the same conversion for the app's offline fallback, so
change the two together.

Needs the Admin SDK key (see "DATA PIPELINE" in SETUP.txt):

    pip install firebase-admin
    python timethreads/scripts/upload_graph.py path/to/serviceAccount.json

Safe to re-run: documents are overwritten in place, and star / post counters
that users have already built up are kept.
"""

import json
import sys
from pathlib import Path
from urllib.parse import quote

import firebase_admin
from firebase_admin import credentials, firestore

SRC = Path(__file__).resolve().parent.parent / "src"
WARS = SRC / "nodes" / "cyto.json"
SENATORS = SRC / "data" / "historicalsenators300.json"
SENATOR_EDGES = SRC / "data" / "historicalsenators300_edges.json"

BATCH_SIZE = 400  # Firestore allows 500 writes per batch


def qid(entity):
    """'http://www.wikidata.org/entity/Q24217' -> 'Q24217'"""
    return entity.rstrip("/").split("/")[-1]


def day(date):
    return date[:10] if date else None


def wiki_url(name):
    return "https://en.wikipedia.org/wiki/" + quote(name.replace(" ", "_"))


def node(name, start, end, tag, summary="", image=None):
    return {
        "name": name,
        "dateStart": day(start),
        "dateEnd": day(end),
        "tags": [tag],
        "summary": summary or "",
        "wikiUrl": wiki_url(name),
        "externalLinks": [],
        "image": image,
        # Increment(0) creates the counter at 0 but leaves an existing one alone.
        "starCount": firestore.Increment(0),
    }


def load_nodes():
    nodes = {}
    wars = json.loads(WARS.read_text(encoding="utf-8"))
    for item in wars["nodes"]:
        w = item["data"]
        nodes[w["id"]] = node(w["label"], w.get("startDate"), w.get("endDate"), "Wars & Conflicts")

    for s in json.loads(SENATORS.read_text(encoding="utf-8")):
        nodes.setdefault(qid(s["id"]), node(
            s["label"], s.get("birthDate"), s.get("deathDate"), "Politics & Government",
            s.get("wikiIntro"), s.get("image"),
        ))
    return nodes, wars["edges"]


def load_edges(nodes, war_edges):
    links = [e["data"] for e in war_edges]
    links += json.loads(SENATOR_EDGES.read_text(encoding="utf-8"))
    edges = {}
    for link in links:
        source, target = qid(link["source"]), qid(link["target"])
        if source == target or source not in nodes or target not in nodes:
            continue
        # Same ID as sourcedEdgeId() in src/schema.ts
        edges[f"{source}_link_{target}"] = {
            "source": source,
            "target": target,
            "nodeIds": [source, target],
            "kind": "wikipedia",
            "relation": None,
            "type": None,
            "proposedBy": None,
            "originPostId": None,
            "promoted": False,
            "upvotes": 0,
            "downvotes": 0,
            "score": 0,
            "postCount": firestore.Increment(0),
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
    return edges


def write_all(db, collection, docs):
    items = list(docs.items())
    for i in range(0, len(items), BATCH_SIZE):
        batch = db.batch()
        for doc_id, data in items[i:i + BATCH_SIZE]:
            batch.set(db.collection(collection).document(doc_id), data, merge=True)
        batch.commit()
    print(f"Wrote {len(items)} {collection}")


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: python timethreads/scripts/upload_graph.py path/to/serviceAccount.json")
    firebase_admin.initialize_app(credentials.Certificate(sys.argv[1]))
    db = firestore.client()

    nodes, war_edges = load_nodes()
    edges = load_edges(nodes, war_edges)
    write_all(db, "nodes", nodes)
    write_all(db, "edges", edges)


if __name__ == "__main__":
    main()
