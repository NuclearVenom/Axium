import { KnowledgeGraph } from "../types.js";
import { graphRepository } from "../graphRepository.js";
import { generateConstruction, generateExpansion, StageReporter } from "../ai-generation/graphGenerator.js";

export type { StageReporter };

/**
 * Builds a brand-new knowledge graph for a topic that has never been
 * constructed before, entirely from the AI Graph Generator (no internet
 * retrieval — see knowledge-engine/ai-generation/). Persists the result
 * through graphRepository exactly as the legacy engine did, so search.ts,
 * the graph API routes, and the frontend contract are all unaffected by
 * this being AI-generated rather than retrieved.
 */
export async function constructGraph(topic: string, onStage?: StageReporter): Promise<KnowledgeGraph> {
  const graph = await generateConstruction(topic, onStage);
  onStage?.("Caching graph");
  await graphRepository.saveGraph(graph);
  return graph;
}

/**
 * Expands a single existing concept by exactly one layer, using the AI
 * Graph Generator with full awareness of the existing graph so it never
 * duplicates a concept that's already present elsewhere. The previously
 * generated graph is never rebuilt — only new nodes/edges are appended.
 */
export async function expandConcept(graphId: string, conceptId: string, onStage?: StageReporter): Promise<KnowledgeGraph> {
  const graph = await graphRepository.getGraph(graphId);
  if (!graph) throw new Error(`Graph ${graphId} not found`);
  if (!graph.nodes[conceptId]) throw new Error(`Concept ${conceptId} not found in graph ${graphId}`);

  const updated = await generateExpansion(graph, conceptId, onStage);
  await graphRepository.saveGraph(updated);
  return updated;
}
