
import wikipedia
import json
import requests
import time

processed=0
total=0

wikipedia.set_user_agent(
    "TimeThreads (Educational History Project)"
)

path = "timethreads/src/data/historicalsenatorsSK.json"

with open(path, "r", encoding="utf-8") as myfile:
    data = json.load(myfile)


for node in data:
    tosearch = node.get("label")
    total=total+1
    if not tosearch:
        continue

    try:
        print(total)
        print(f"Searching: {tosearch}")

        page = wikipedia.page(tosearch)

        node["links"] = page.references

        #node["links"] = page.links
        print(f"Successfully processed: {tosearch}")
        processed=processed+1
        time.sleep(1)

    except wikipedia.exceptions.DisambiguationError:
        print(f"DisambiguationError {tosearch}")

    except wikipedia.exceptions.PageError:
        print(f"PageError {tosearch}")

    except requests.exceptions.JSONDecodeError:
        print(f"JSONDecodeError {tosearch}")
        time.sleep(5)

    except requests.exceptions.RequestException as e:
        print(f"RequestException {tosearch}: {e}")
        time.sleep(1)

    except wikipedia.exceptions.WikipediaException as e:
        print(f"WikipediaException {tosearch}: {e}")

    with open(path, "w", encoding="utf-8") as myfile:
        json.dump(data, myfile, indent=4, ensure_ascii=False)


print(f"Percent complete={(processed/total) *100}")
      
#table of all the values
label_to_id = {
    node["label"]: node["id"]
    for node in data
    if node.get("label") and node.get("id")
}

edges=[]
processed=processed/300
print(f"Percent processed: {processed}")

# to look up ids
label_to_id = {
    node["label"]: node["id"]
    for node in data
    if node.get("label") and node.get("id")
}

# Add edges
edges = []

for node in data:
    source_id = node.get("id")

    if not source_id:
        continue

    for link in node.get("links", []):
        if link in label_to_id:
            target_id = label_to_id[link]

            edges.append({
                "source": source_id,
                "target": target_id
            })


with open(path, "w", encoding="utf-8") as myfile:
    json.dump(data, myfile, indent=4, ensure_ascii=False)

with open("timethreads/src/data/historicalsenators300_edges.json", "w", encoding="utf-8") as myfile:
    json.dump(edges, myfile, indent=4, ensure_ascii=False)

print(f"Created {len(edges)} edges")