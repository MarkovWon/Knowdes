import { GoogleGenAI, Type } from "@google/genai";
import { KnowledgeGraphData, PlanResponse, AspectRatio, GroundingSource } from "../types";

// Helper to check for API Key
export const hasApiKey = async (): Promise<boolean> => {
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    return await window.aistudio.hasSelectedApiKey();
  }
  return !!process.env.API_KEY;
};

// Helper to open selection dialog
export const selectApiKey = async (): Promise<void> => {
  if (window.aistudio && window.aistudio.openSelectKey) {
    await window.aistudio.openSelectKey();
  }
};

// Helper to get fresh AI instance
const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Clean JSON from Markdown code blocks and conversational text
const cleanJson = (text: string): string => {
  let clean = text;
  
  // Remove markdown code blocks
  clean = clean.replace(/```json/g, '').replace(/```/g, '');
  
  // Find the JSON object (first '{' to last '}')
  const firstOpen = clean.indexOf('{');
  const lastClose = clean.lastIndexOf('}');
  
  if (firstOpen !== -1 && lastClose !== -1) {
    clean = clean.substring(firstOpen, lastClose + 1);
  }
  
  return clean.trim();
};

export const generateKnowledgeGraph = async (topic: string, status: string): Promise<KnowledgeGraphData> => {
  const ai = getAI();
  const prompt = `
    Create a detailed knowledge graph for learning about: "${topic}".
    The user's current status is: "${status}".
    
    Return a JSON object with two arrays:
    1. "nodes": Objects with "id" (string), "label" (short name), "group" (category name), and "description" (short summary).
    2. "links": Objects with "source" (node id), "target" (node id), and "relation" (dependency type).
    
    Ensure the graph starts from fundamentals matching the user's status and progresses to advanced topics.
    
    IMPORTANT OUTPUT RULES:
    1. Return ONLY valid JSON.
    2. Do NOT use Markdown code blocks.
    3. Do NOT include comments (e.g. // or /* */).
    4. Do NOT include any conversational text before or after the JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text || "{}";
    const jsonStr = cleanJson(text);
    const parsed = JSON.parse(jsonStr);
    
    // Validate structure
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      links: Array.isArray(parsed.links) ? parsed.links : []
    };
  } catch (error) {
    console.error("Failed to generate graph:", error);
    throw new Error("Failed to generate knowledge graph. Please try again.");
  }
};

export const expandGraph = async (selectedNodes: {id: string, label: string}[], topic: string): Promise<KnowledgeGraphData> => {
  const ai = getAI();
  const prompt = `
    Context: The user is learning about "${topic}".
    They have selected the following specific concepts to "Subdivide" or "Expand" into more detail:
    ${JSON.stringify(selectedNodes, null, 2)}

    Task:
    1. Break down these selected concepts into granular sub-concepts (new nodes).
    2. Define relationships (links) between these new sub-concepts AND the original selected nodes (use the provided "id" to link back).
    3. The goal is to deepen the knowledge graph in this specific area.

    Return a JSON object with:
    1. "nodes": New granular nodes. DO NOT return the original input nodes, only new ones.
       Fields: "id" (unique string), "label", "group" (should relate to parent), "description".
    2. "links": Links connecting new nodes to each other OR new nodes to the original selected nodes.

    IMPORTANT OUTPUT RULES:
    1. Return ONLY valid JSON.
    2. Do NOT use Markdown code blocks.
    3. Do NOT include comments (e.g. // or /* */).
    4. Do NOT include any conversational text before or after the JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text || "{}";
    const jsonStr = cleanJson(text);
    const parsed = JSON.parse(jsonStr);

    // Validate structure
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      links: Array.isArray(parsed.links) ? parsed.links : []
    };
  } catch (error) {
    console.error("Failed to expand graph:", error);
    // Log the actual text for debugging if needed, but return generic error to UI
    throw new Error("Failed to expand selected nodes. The model returned invalid data.");
  }
};

export const generateActionPlan = async (nodeLabel: string, userStatus: string, contextTopic: string): Promise<PlanResponse> => {
  const ai = getAI();
  const prompt = `
    I am learning about "${contextTopic}". My current background is: "${userStatus}".
    
    I want to master the specific concept: "${nodeLabel}".
    
    Please provide a concise, actionable learning plan.
    1. Explain the concept simply.
    2. List 3-5 specific action steps to learn it (readings, exercises, projects).
    3. Explain why this node is important in the larger context of ${contextTopic}.
    
    Use Google Search to find the most up-to-date resources.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const markdown = response.text || "No plan generated.";
    
    // Extract grounding sources if available
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: GroundingSource[] = chunks
      .map((chunk: any) => chunk.web)
      .filter((web: any) => web && web.uri && web.title)
      .map((web: any) => ({ title: web.title, uri: web.uri }));

    return { markdown, sources };
  } catch (error) {
    console.error("Failed to generate plan:", error);
    throw new Error("Failed to generate action plan.");
  }
};

export const generateConceptImage = async (prompt: string, aspectRatio: AspectRatio): Promise<string> => {
  const ai = getAI();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "1K" 
        }
      }
    });

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Failed to generate image:", error);
    throw error;
  }
};