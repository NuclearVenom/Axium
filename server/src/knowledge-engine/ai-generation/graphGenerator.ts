import { KnowledgeGraph } from "../types.js";
import { buildConstructionPlan, buildExpansionPlan } from "./pipeline/plan.js";
import { requestConstructionGraph, requestExpansionGraph } from "./pipeline/request.js";
import { materializeConstruction, mergeExpansion } from "./pipeline/merge.js";
import { ExpansionContext } from "./pipeline/types.js";
import {
  expansionCacheKey,
  getCachedConstruction,
  getCachedExpansion,
  setCachedConstruction,
  setCachedExpansion,
} from "./aiCache.js";

export type StageReporter = (stage: string) => void;

/**
 * Topic -> Planning -> Hierarchy Design -> Node Metadata -> Edge Generation
 * -> Validation -> Merge, for a brand-new topic. Caching sits between
 * Planning and generation: an identical topic reuses the AI's last valid
 * answer to that exact request shape without spending another call.
 */
export async function generateConstruction(topic: string, onStage?: StageReporter): Promise<KnowledgeGraph> {
  onStage?.("Planning knowledge structure");
  const plan = buildConstructionPlan(topic);

  onStage?.("Checking cache for this topic");
  let raw = await getCachedConstruction(topic);

  if (!raw) {
    onStage?.("Designing hierarchy");
    onStage?.("Generating concepts and relationships");
    raw = await requestConstructionGraph(plan);
    await setCachedConstruction(topic, raw);
  } else {
    onStage?.("Reusing a previously generated structure");
  }

  onStage?.("Assembling the knowledge graph");
  return materializeConstruction(topic, raw);
}

/**
 * Same pipeline shape, scoped to one existing node's next layer. Returns
 * the SAME graph object (with new nodes/edges appended) — never a
 * different graph — so existing nodes and their ids are always preserved.
 */
export async function generateExpansion(graph: KnowledgeGraph, conceptId: string, onStage?: StageReporter): Promise<KnowledgeGraph> {
  const focus = graph.nodes[conceptId];
  if (!focus) throw new Error(`Concept ${conceptId} not found in graph ${graph.id}`);

  // Idempotent by design: a node that already has children was already expanded.
  // Re-clicking "Expand Further" is a no-op rather than a duplicate generation.
  if (focus.childIds.length > 0) {
    onStage?.("Already expanded");
    return graph;
  }

  const parentId = focus.parentIds[0];
  const parent = parentId ? graph.nodes[parentId] : undefined;
  const siblingTitles = (parent?.childIds ?? [])
    .filter((id) => id !== conceptId)
    .map((id) => graph.nodes[id]?.title)
    .filter((t): t is string => Boolean(t));

  const allTitles = Object.values(graph.nodes).map((n) => n.title);
  const otherBranchTitles = allTitles.filter((t) => t !== focus.title && !siblingTitles.includes(t));

  const focusDepth = estimateDepth(graph, conceptId);
  const plan = buildExpansionPlan(graph.topic, focusDepth + 1);

  const ctx: ExpansionContext = {
    topic: graph.topic,
    focusTitle: focus.title,
    focusSummary: focus.summary,
    focusCategory: focus.category,
    focusDepth,
    parentTitle: parent?.title ?? null,
    siblingTitles,
    existingDescendantTitles: [], // focus has no children yet (guarded above), so nothing to list
    otherBranchTitles,
  };

  const existingTitlesNormalized = new Set(allTitles.map((t) => t.trim().toLowerCase()));
  const cacheKey = expansionCacheKey(graph.topic, ctx.parentTitle, focus.title);

  onStage?.("Checking cache for this concept");
  let raw = await getCachedExpansion(cacheKey);

  if (!raw) {
    onStage?.(`Expanding "${focus.title}"`);
    raw = await requestExpansionGraph(plan, ctx, existingTitlesNormalized);
    await setCachedExpansion(cacheKey, raw);
  } else {
    onStage?.("Reusing a previously generated expansion");
  }

  onStage?.("Merging into the graph");
  return mergeExpansion(graph, conceptId, raw);
}

function estimateDepth(graph: KnowledgeGraph, nodeId: string): number {
  const visited = new Set<string>([graph.rootConceptId]);
  let frontier = [graph.rootConceptId];
  let depth = 0;
  while (frontier.length > 0) {
    if (frontier.includes(nodeId)) return depth;
    const next: string[] = [];
    for (const id of frontier) {
      const node = graph.nodes[id];
      if (!node) continue;
      for (const childId of node.childIds) {
        if (!visited.has(childId)) {
          visited.add(childId);
          next.push(childId);
        }
      }
    }
    depth++;
    frontier = next;
  }
  return depth;
}
