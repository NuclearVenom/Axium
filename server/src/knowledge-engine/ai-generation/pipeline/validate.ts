import { AIConstructionGraph, AIExpansionGraph } from "../schema.js";
import { GenerationPlan, RawAIGraph, RawAIExpansion } from "./types.js";

export interface ValidationOk<T> {
  ok: true;
  value: T;
}
export interface ValidationFailed {
  ok: false;
  issues: string[];
}
export type ValidationResult<T> = ValidationOk<T> | ValidationFailed;

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Structural checks shared by both modes: unique tempIds, unique titles, edges reference real nodes. */
function baseChecks(nodes: { tempId: string; title: string }[], edges: { sourceTempId: string; targetTempId: string }[], issues: string[]) {
  const tempIds = new Set<string>();
  for (const node of nodes) {
    if (tempIds.has(node.tempId)) issues.push(`Duplicate tempId "${node.tempId}" used by more than one node.`);
    tempIds.add(node.tempId);
  }

  const titleCounts = new Map<string, number>();
  for (const node of nodes) {
    const key = normalizeTitle(node.title);
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }
  for (const [title, count] of titleCounts) {
    if (count > 1) issues.push(`Title "${title}" is used by ${count} different nodes — titles must be unique.`);
  }

  for (const edge of edges) {
    if (!tempIds.has(edge.sourceTempId)) issues.push(`Edge references unknown sourceTempId "${edge.sourceTempId}".`);
    if (!tempIds.has(edge.targetTempId)) issues.push(`Edge references unknown targetTempId "${edge.targetTempId}".`);
    if (edge.sourceTempId === edge.targetTempId) issues.push(`Edge from "${edge.sourceTempId}" to itself is not allowed.`);
  }

  return tempIds;
}

export function validateConstruction(parsed: AIConstructionGraph, plan: GenerationPlan): ValidationResult<RawAIGraph> {
  const issues: string[] = [];
  const tempIds = baseChecks(parsed.nodes, parsed.edges, issues);

  if (!tempIds.has(parsed.rootTempId)) {
    issues.push(`rootTempId "${parsed.rootTempId}" does not match any node's tempId.`);
  }

  const roots = parsed.nodes.filter((n) => n.parentTempId === null);
  if (roots.length !== 1) {
    issues.push(`Exactly one node must have parentTempId: null (the root). Found ${roots.length}.`);
  } else if (roots[0].tempId !== parsed.rootTempId) {
    issues.push(`The node with parentTempId: null ("${roots[0].tempId}") must match rootTempId ("${parsed.rootTempId}").`);
  }

  for (const node of parsed.nodes) {
    if (node.parentTempId !== null && !tempIds.has(node.parentTempId)) {
      issues.push(`Node "${node.tempId}" has parentTempId "${node.parentTempId}", which does not exist.`);
    }
    if (node.parentTempId === node.tempId) {
      issues.push(`Node "${node.tempId}" cannot be its own parent.`);
    }
  }

  // Reachability from root doubles as a cycle guard: anything unreachable is either
  // orphaned or trapped in a cycle that never touches the root — both are invalid.
  if (tempIds.has(parsed.rootTempId)) {
    const childrenOf = new Map<string, string[]>();
    for (const node of parsed.nodes) {
      if (node.parentTempId === null) continue;
      if (!childrenOf.has(node.parentTempId)) childrenOf.set(node.parentTempId, []);
      childrenOf.get(node.parentTempId)!.push(node.tempId);
    }
    const visited = new Set<string>([parsed.rootTempId]);
    const queue = [parsed.rootTempId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const child of childrenOf.get(current) ?? []) {
        if (visited.has(child)) continue;
        visited.add(child);
        queue.push(child);
      }
    }
    const unreachable = parsed.nodes.filter((n) => !visited.has(n.tempId));
    if (unreachable.length > 0) {
      issues.push(
        `${unreachable.length} node(s) are not reachable from the root by following parentTempId links (e.g. "${unreachable[0].tempId}") — likely a cycle or a broken parent chain.`
      );
    }
  }

  const [minN, maxN] = plan.nodeCountRange;
  const slack = Math.ceil(maxN * 0.35);
  if (parsed.nodes.length < Math.max(3, minN - slack)) {
    issues.push(`Only ${parsed.nodes.length} nodes were produced — too sparse for "${plan.topic}". Expand the structure.`);
  }
  if (parsed.nodes.length > maxN + slack) {
    issues.push(`${parsed.nodes.length} nodes were produced — too many. Consolidate toward roughly ${minN}-${maxN} nodes.`);
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: { rootTempId: parsed.rootTempId, nodes: parsed.nodes, edges: parsed.edges },
  };
}

export function validateExpansion(
  parsed: AIExpansionGraph,
  plan: GenerationPlan,
  existingTitlesNormalized: Set<string>
): ValidationResult<RawAIExpansion> {
  const issues: string[] = [];
  baseChecks(parsed.nodes, parsed.edges, issues);

  for (const node of parsed.nodes) {
    if (existingTitlesNormalized.has(normalizeTitle(node.title))) {
      issues.push(`"${node.title}" already exists elsewhere in the graph — do not recreate it as a new child.`);
    }
  }

  const [minN, maxN] = plan.nodeCountRange;
  const slack = Math.ceil(maxN * 0.6) + 2;
  if (parsed.nodes.length > maxN + slack) {
    issues.push(`${parsed.nodes.length} children were produced — too many for one expansion. Keep it closer to ${minN}-${maxN}.`);
  }

  if (issues.length > 0) return { ok: false, issues };

  return { ok: true, value: { nodes: parsed.nodes, edges: parsed.edges } };
}
