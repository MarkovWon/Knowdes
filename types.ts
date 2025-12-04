import { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  group: string;
  description: string;
  // D3 internal properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  relation?: string;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface PlanResponse {
  markdown: string;
  sources: GroundingSource[];
}

export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";

export interface ImageGenerationConfig {
  prompt: string;
  aspectRatio: AspectRatio;
}
