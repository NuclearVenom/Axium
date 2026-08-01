import { ConceptNode, KnowledgeGraph } from "./types.js";

/** All prerequisites of a concept, transitively, in learn-first-to-last order. */
export function fullPrerequisiteChain(graph: KnowledgeGraph, conceptId: string): ConceptNode[] {
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const node = graph.nodes[id];
    if (!node) return;
    for (const prereqId of node.prerequisiteIds) visit(prereqId);
    order.push(id);
  }

  const node = graph.nodes[conceptId];
  if (!node) return [];
  for (const prereqId of node.prerequisiteIds) visit(prereqId);

  return order.map((id) => graph.nodes[id]).filter(Boolean);
}

/** Everything unlocked (directly or transitively) by mastering this concept. */
export function fullUnlocksChain(graph: KnowledgeGraph, conceptId: string): ConceptNode[] {
  const visited = new Set<string>();
  const result: ConceptNode[] = [];

  function visit(id: string) {
    const node = graph.nodes[id];
    if (!node) return;
    for (const unlockId of node.unlocksIds) {
      if (visited.has(unlockId)) continue;
      visited.add(unlockId);
      const unlockedNode = graph.nodes[unlockId];
      if (unlockedNode) {
        result.push(unlockedNode);
        visit(unlockId);
      }
    }
  }

  visit(conceptId);
  return result;
}

/** BFS shortest path between two concepts, traversing all edge types undirected. */
export function shortestPath(graph: KnowledgeGraph, fromId: string, toId: string): ConceptNode[] | null {
  if (!graph.nodes[fromId] || !graph.nodes[toId]) return null;
  if (fromId === toId) return [graph.nodes[fromId]];

  const adjacency = buildUndirectedAdjacency(graph);
  const visited = new Set<string>([fromId]);
  const queue: string[][] = [[fromId]];

  while (queue.length > 0) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    for (const neighbor of adjacency.get(last) ?? []) {
      if (visited.has(neighbor)) continue;
      const newPath = [...path, neighbor];
      if (neighbor === toId) return newPath.map((id) => graph.nodes[id]).filter(Boolean);
      visited.add(neighbor);
      queue.push(newPath);
    }
  }
  return null;
}

/** Concepts that are ancestors (via prerequisite or containment) of both given concepts. */
export function commonAncestors(graph: KnowledgeGraph, aId: string, bId: string): ConceptNode[] {
  const ancestorsA = new Set(collectAncestors(graph, aId));
  const ancestorsB = collectAncestors(graph, bId);
  return ancestorsB.filter((id) => ancestorsA.has(id)).map((id) => graph.nodes[id]).filter(Boolean);
}

function collectAncestors(graph: KnowledgeGraph, conceptId: string): string[] {
  const visited = new Set<string>();
  const stack = [conceptId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const node = graph.nodes[id];
    if (!node) continue;
    for (const parentId of [...node.parentIds, ...node.prerequisiteIds]) {
      if (!visited.has(parentId)) {
        visited.add(parentId);
        stack.push(parentId);
      }
    }
  }
  return [...visited];
}

function buildUndirectedAdjacency(graph: KnowledgeGraph): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a)!.add(b);
  };
  for (const edge of graph.edges) {
    add(edge.sourceId, edge.targetId);
    add(edge.targetId, edge.sourceId);
  }
  return adjacency;
}

/** Concepts belonging to more than one category-cluster — the interdisciplinary bridges. */
export function crossDisciplinaryBridges(graph: KnowledgeGraph): ConceptNode[] {
  return Object.values(graph.nodes).filter((n) => n.crossDisciplineIds.length > 0);
}
