import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";
import senatorData from "../data/senators.json";

const partyColors = {
  "Democratic Party": "#2563eb",
  "Republican Party": "#dc2626",
  "independent politician": "#9333ea",
  "Green Party of the United States": "#16a34a",
};

export default function HistoryGraph() {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);

  // Deduplicate senators by their Wikidata entity URL.
  const senators = useMemo(() => {
    const unique = new Map();

    for (const senator of senatorData.nodes) {
      if (!unique.has(senator.senator)) {
        unique.set(senator.senator, senator);
      }
    }

    return [...unique.values()];
  }, []);

 
  useEffect(() => {
    const nodes = senators.map((senator) => ({
      data: {
        id: senator.senator,
        label: senator.senatorLabel,
        party: senator.partyLabel,
        seat: senator.districtLabel,
        state: senator.districtLabel?.replace(/\s+class\s+\d+$/i, ""),
        assumedOffice: senator.assumedOffice,
        image: senator.image,
        partyColor: partyColors[senator.partyLabel] || "#64748b",
      },
    }));

    const edges = [];

for (let i = 0; i < senators.length; i++) {
  for (let j = i + 1; j < senators.length; j++) {
    const a = senators[i];
    const b = senators[j];

    // Connect senators from the same party.
    if (
      a.partyLabel &&
      b.partyLabel &&
      a.partyLabel === b.partyLabel
    ) {
      edges.push({
        data: {
          id: `party-${i}-${j}`,
          source: a.senator,
          target: b.senator,
          type: "shared-party",
          relationship: `Same party: ${a.partyLabel}`,
          color: "#6d94c9",
        },
      });
    }
  
    // Connect senators from the same state.
const stateA = a.districtLabel
  ?.replace(/\s+class\s+\d+\s+senate seat$/i, "")
  .trim();

const stateB = b.districtLabel
  ?.replace(/\s+class\s+\d+\s+senate seat$/i, "")
  .trim();

if (stateA && stateB && stateA === stateB) {
  console.log("Same state:", a.senatorLabel, b.senatorLabel, stateA);
}

if (stateA === stateB) {
  edges.push({
    data: {
      id: `state-${i}-${j}`,
      source: a.senator,
      target: b.senator,
      type: "shared-state",
      relationship: `Same state: ${stateA}`,
      color: "#f59e0b",
    },
  });
}
}
}
    console.log("Senators:", senators.length);
    console.log("Nodes:", nodes.length);
    console.log("Edges:", edges.length);
    console.log("First node:", nodes[0]);
    console.log("First edge:", edges[0]);
    const elements = [...nodes, ...edges];

    console.log("First senator image:", senators[0]?.image);
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
    "background-color": "data(partyColor)",
    "background-image": "data(image)",
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
    "border-color": "data(partyColor)",
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

cy.on("mouseover", "edge", (event) => {
  const edge = event.target;
  const position = event.renderedPosition;

  setHoveredEdge({
    text: edge.data("relationship"),
    x: position.x,
    y: position.y,
  });
});

cy.on("mouseout", "edge", () => {
  setHoveredEdge(null);
});

return () => {
  cy.destroy();
  cyRef.current = null;
};
}, [senators]);



  return (
    <div className="history-graph">
      <div className="graph-legend">
        {Object.entries(partyColors).map(([party, color]) => (
          <span key={party} className="legend-item">
            <span
              className="legend-dot"
              style={{ backgroundColor: color }}
            />
            {party}
          </span>
        ))}
      </div>

      
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

  {hoveredEdge && (
    <div
      style={{
        position: "absolute",
        left: hoveredEdge.x + 12,
        top: hoveredEdge.y + 12,
        padding: "8px 12px",
        background: "#1f2937",
        color: "white",
        borderRadius: "6px",
        fontSize: "13px",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      {hoveredEdge.text}
    </div>
  )}
</div>


      <p>{senators.length} unique senators</p>

      {selected && (
        <section className="senator-details">
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