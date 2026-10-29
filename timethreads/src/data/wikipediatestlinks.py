import wikipedia
import json
import requests


#needs user agent so it doesn't block
wikipedia.set_user_agent(
    "TimeThreads (Educational History Project)"
)


def exists(title):
    try:
        wikipedia.page(title)
        return True
    except wikipedia.exceptions.PageError:
        return False
    #multiple
    except wikipedia.exceptions.DisambiguationError as e:
        return False
    except (requests.exceptions.RequestException,
            requests.exceptions.JSONDecodeError,
            wikipedia.exceptions.WikipediaException) as e:
        return False



#parses through json file and looks up the information depending on the id 

myfile = open("timethreads/src/data/historicalsenators300.json")
data = json.load(myfile)
#print(data[0])

for node in data:
    #print(node.get("data"))
    tosearch = node.get("label")
    #print(tosearch)
    if tosearch:
        if exists(tosearch):
            page=wikipedia.page(tosearch)
        #getting references section
            references = page.references
            for reference in references:
                print(reference)

            #all links in the page-> can be used for making edges
            try:
                links = page.links

                for link in links:
                    print(link)
            except (requests.exceptions.RequestException,
            wikipedia.exceptions.WikipediaException,
            ValueError) as e:
                print("Can't get link")