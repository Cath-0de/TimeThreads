import cytoscape from 'cytoscape';
//example from https://ishan-mehta17.medium.com/visualize-knowledge-graphs-using-cytoscape-js-c640e8237d82

import data from './cyto.json' with { type: 'json' };
const data1 = JSON.parse(JSON.stringify(data));

const cy = cytoscape({
    container: document.getElementById('cy'),
    elements: [
    ...data1.nodes,
    ...data1.edges
    ],
        style: [
        {
        selector: "node",
        style: {
            "label": "data(label)" //display text label on each node
        }
        }
        
    ],
        layout: { name: "grid" } // can also use circle, grid,breadthfirst, cose 
});