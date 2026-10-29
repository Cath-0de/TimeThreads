
import json
import time
import requests
from pathlib import Path

# Paths relative to this script
BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "historicalsenators300.json"
BACKUP_FILE = BASE_DIR / "data" / "historicalsenators300_backup.json"

# Wikipedia API
API_URL = "https://en.wikipedia.org/w/api.php"
HEADERS = {
    "User-Agent": "TimeThreads/1.0 (Educational History Project)"
}

session = requests.Session()
session.headers.update(HEADERS)


def get_intro(name):
    """Return the first four sentences of a Wikipedia article."""

    params = {
        "action": "query",
        "format": "json",
        "formatversion": 2,
        "prop": "extracts",
        "exintro": 1,
        "explaintext": 1,
        "exsentences": 4,
        "redirects": 1,
        "titles": name,
    }

    response = session.get(API_URL, params=params, timeout=30)

    if response.status_code == 429:
        raise requests.exceptions.HTTPError(
        "Wikipedia rate limit reached. Try again later."
    )

    response.raise_for_status()
    result = response.json()

    pages = result["query"]["pages"]
    if not pages or pages[0].get("missing"):
        return None

    intro = pages[0].get("extract", "").strip()
    return intro or None


# Load the dataset
with open(DATA_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

print("Number of records:", len(data))
print("First record:")
print(json.dumps(data[0], indent=2)[:3000])

# Create a backup only if one doesn't already exist
if not BACKUP_FILE.exists():
    with open(BACKUP_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Backup created: {BACKUP_FILE}")

saved = 0
failed = []

for i, senator in enumerate(data):
    name = senator.get("label")

    if not name:
        failed.append("(missing senatorLabel)")
        continue

    # Keep existing successful results when rerunning
    if senator.get("wikiIntro"):
        continue

    try:
        intro = get_intro(name)

        if intro:
            senator["wikiIntro"] = intro
            saved += 1
            print(f"[{i + 1}/{len(data)}] Saved: {name}")
        else:
            failed.append(name)
            print(f"[{i + 1}/{len(data)}] No article found: {name}")

    except (requests.RequestException, ValueError, KeyError) as e:
        failed.append(name)
        print(f"[{i + 1}/{len(data)}] Error for {name}: {e}")

    # Save progress periodically so work isn't lost
    if (i + 1) % 10 == 0:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    # Avoid sending requests too rapidly
    time.sleep(0.2)

# Final save
with open(DATA_FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

# Report results
with_intros = sum(bool(s.get("wikiIntro")) for s in data)

print("\nDone!")
print(f"New intros saved: {saved}")
print(f"Total senators with intros: {with_intros}/{len(data)}")
print(f"Could not retrieve: {len(failed)}")

if data:
    first_with_intro = next(
        (s for s in data if s.get("wikiIntro")), None
    )
    if first_with_intro:
        print("\nExample:", first_with_intro["label"])
        print(first_with_intro["wikiIntro"][:500])

if failed:
    print("\nFirst 20 failures:")
    print(failed[:20])

print(f"\nSaved to: {DATA_FILE}")
