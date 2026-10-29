import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";
import historyData from "../data/historicalsenators300.json";
 
/*
const partyColors = {
  "Democratic Party": "#2563eb",
  "Republican Party": "#dc2626",
  "independent politician": "#9333ea",
  "Green Party of the United States": "#16a34a",
};
*/


export default function HistoryGraph() {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);

  // Deduplicate historyitems by their Wikidata entity URL.
  const historyitems = useMemo(() => {
  const unique = new Map();

  for (const historyitem of historyData) {
    if (!unique.has(historyitem.id)) {
      unique.set(historyitem.id, historyitem);
    }
  }

  return [...unique.values()];
}, []);

 
  useEffect(() => {
    const nodes = historyitems.map((historyitem) => ({
      data: {
        id: historyitem.id,
        label: historyitem.label,
        start: historyitem.birthDate,
        end: historyitem.deathDate,
        party: historyitem.partyLabel,
        image: historyitem.image,
      },
    }));


//Redo edge schema- old example edge schema below

/*
    const edges = [];

for (let i = 0; i < historyitems.length; i++) {
  for (let j = i + 1; j < historyitems.length; j++) {
    const a = historyitems[i];
    const b = historyitems[j];


    
    // Connect historyitems from the same party.
    if (
      a.partyLabel &&
      b.partyLabel &&
      a.partyLabel === b.partyLabel
    ) {
      edges.push({
        data: {
          id: `party-${i}-${j}`,
          source: a.historyitem,
          target: b.historyitem,
          type: "shared-party",
          relationship: `Same party: ${a.partyLabel}`,
          color: "#6d94c9",
        },
      });
    }
  
    // Connect historyitems from the same state.
const stateA = a.districtLabel
  ?.replace(/\s+class\s+\d+\s+senate seat$/i, "")
  .trim();

const stateB = b.districtLabel
  ?.replace(/\s+class\s+\d+\s+senate seat$/i, "")
  .trim();

if (stateA && stateB && stateA === stateB) {
  console.log("Same state:", a.historyitemLabel, b.historyitemLabel, stateA);
}

if (stateA === stateB) {
  edges.push({
    data: {
      id: `state-${i}-${j}`,
      source: a.historyitem,
      target: b.historyitem,
      type: "shared-state",
      relationship: `Same state: ${stateA}`,
      color: "#f59e0b",
    },
  });
}
}
}
*/
    console.log("historyitems:", historyitems.length);
    console.log("Nodes:", nodes.length);
   // console.log("Edges:", edges.length);
   // console.log("First node:", nodes[0]);
   // console.log("First edge:", edges[0]);
   // const elements = [...nodes, ...edges];
   const elements =nodes;

    console.log("First historyitem image:", historyitems[0]?.image);
    console.log("First node data:", nodes[0]);

    
    const cy = cytoscape({
      container: containerRef.current,
      elements,

      style: [
       {
  selector: "edge",
  style: {
    width: 2,
    "line-color": "data(color)",
    opacity: 0.65,
    "curve-style": "bezier",
    "target-arrow-shape": "none",
  },
},
{
  selector: "edge:active",
  style: {
    width: 4,
    opacity: 1,
  },
},
{
  selector: "node",
  style: {
    "background-color": "#64748b",
    "background-fit": "cover",
    "background-clip": "node",
    "background-opacity": 1,
    width: 48,
    height: 48,
    shape: "ellipse",
    label: "data(label)",
    "font-size": 10,
    color: "#222",
    "text-wrap": "wrap",
    "text-max-width": 90,
    "text-valign": "bottom",
    "text-halign": "center",
    "text-margin-y": 5,
    "border-width": 2,
    "border-color": "#000000", //old code: data(partyColor)
  },
},

{
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#a39715",
            width: 54,
            height: 54,
          },
        },
      ],

      layout: {
        name: "cose",
        animate: false,
        padding: 35,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 100,
      },

      minZoom: 0.2,
      maxZoom: 3,
      wheelSensitivity: 0.2,
    });

   
cyRef.current = cy;

cy.on("tap", "node", (event) => {
  setSelected({ ...event.target.data() });
});

cy.on("tap", (event) => {
  if (event.target === cy) {
    setSelected(null);
  }
});



return () => {
  cy.destroy();
  cyRef.current = null;
};
}, [historyitems]);



  return (
    <div className="history-graph">

      
<div
  style={{
    position: "relative",
    width: "100%",
  }}
>
  <div
    ref={containerRef}
    style={{
      width: "100%",
      height: "650px",
      border: "1px solid #ddd",
      borderRadius: "8px",
    }}
  />

  
</div>


      <p>{historyitems.length} unique historyitems</p>

      {selected && (
        <section className="historyitem-details">
          {selected.image && (
            <img
              src={selected.image}
              alt={selected.label}
              style={{
                width: 120,
                maxHeight: 150,
                objectFit: "cover",
              }}
            />
          )}

          <h2>{selected.label}</h2>
          <p><strong>Party:</strong> {selected.party}</p>
          <p><strong>Seat:</strong> {selected.seat}</p>
          <p>
            <strong>Assumed office:</strong>{" "}
            {selected.assumedOffice
              ? selected.assumedOffice.slice(0, 10)
              : "Unknown"}
          </p>

          <a
            href={selected.id}
            target="_blank"
            rel="noreferrer"
          >
            View Wikidata entity
          </a>
        </section>
      )}
    </div>
  );
}