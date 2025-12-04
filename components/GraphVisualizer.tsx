import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { KnowledgeGraphData, GraphNode, GraphLink } from '../types';

interface GraphVisualizerProps {
  data: KnowledgeGraphData | null;
  onNodeClick: (node: GraphNode) => void;
  selectedNodeIds: Set<string>;
}

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ data, onNodeClick, selectedNodeIds }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
  // Use a ref to store the latest click handler so we don't have to restart 
  // the simulation when the handler function identity changes.
  const onNodeClickRef = useRef(onNodeClick);

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Render Graph Structure (Nodes & Links)
  useEffect(() => {
    if (!data || !svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const { width, height } = dimensions;

    // Create a deep copy of data to avoid mutating props directly during simulation
    const nodes = data.nodes.map(d => ({ ...d })) as GraphNode[];
    const links = data.links.map(d => ({ ...d })) as GraphLink[];

    // Color scale for groups
    const color = d3.scaleOrdinal(d3.schemeSet3);

    // Zoom behavior
    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    // Simulation setup
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(50));

    // Arrow marker
    svg.append("defs").selectAll("marker")
      .data(["end"])
      .enter().append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 28) // Shift arrow to tip of link, accounting for node radius
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#9ca3af") // Gray-400
      .attr("d", "M0,-5L10,0L0,5");

    // Draw Links
    const link = g.append("g")
      .attr("class", "links")
      .attr("stroke", "#4b5563") // Gray-600
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    // Draw Nodes Group
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        // Use the ref here to call the latest handler
        onNodeClickRef.current(d);
      });

    // Node circles
    node.append("circle")
      .attr("class", "node-circle")
      .attr("r", 20)
      .attr("fill", d => color(d.group))
      .attr("stroke", "#374151") // Default Gray-700, updated in separate effect
      .attr("stroke-width", 1.5)
      .attr("id", d => `node-${d.id}`); // Add ID for easier selection

    // Node Labels
    node.append("text")
      .text(d => d.label)
      .attr("x", 0)
      .attr("y", 35)
      .attr("text-anchor", "middle")
      .attr("fill", "#e5e7eb") // Gray-200
      .attr("stroke", "none")
      .attr("font-size", "12px")
      .attr("font-weight", "500")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 3px rgba(0,0,0,0.8)");

    // Drag behavior
    const drag = d3.drag<SVGGElement, GraphNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    // Update positions
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => (d.target as GraphNode).x!)
        .attr("y2", d => (d.target as GraphNode).y!);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [data, dimensions]); // Removed onNodeClick from dependency array

  // Separate Effect for Selection Highlighting to avoid re-simulating
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    // Select all circles and update style based on selectedNodeIds
    svg.selectAll<SVGCircleElement, GraphNode>(".node-circle")
      .transition().duration(200)
      .attr("stroke", d => selectedNodeIds.has(d.id) ? "#34d399" : "#374151") // Emerald-400 for selected
      .attr("stroke-width", d => selectedNodeIds.has(d.id) ? 4 : 1.5)
      .attr("stroke-opacity", d => selectedNodeIds.has(d.id) ? 1 : 0.8)
      .attr("r", d => selectedNodeIds.has(d.id) ? 24 : 20); // Make selected slightly larger

  }, [selectedNodeIds, data]); // Run when selection changes or data is refreshed

  return (
    <div ref={containerRef} className="w-full h-full bg-gray-900 rounded-lg overflow-hidden shadow-inner border border-gray-800">
      <svg ref={svgRef} width="100%" height="100%" className="block"></svg>
    </div>
  );
};

export default GraphVisualizer;