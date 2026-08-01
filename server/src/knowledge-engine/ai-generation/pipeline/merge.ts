import { nanoid } from "nanoid";
import {
  ConceptDifficulty,
  ConceptEdge,
  ConceptNode,
  ConceptNodeType,
  KnowledgeGraph,
  RelationshipType,
} from "../../types.js";
import { slugify } from "../../search.js";
import { deriveSearchKeywords } from "../../construction/textExtraction.js";
import { RawAIEdge, RawAIExpansion, RawAIGraph, RawAINode } from "./types.js";

function difficultyForDepth(depth: number): ConceptDifficulty {
  if (depth <= 0) return "intermediate";
  if (depth === 1) return "introductory";
  if (depth === 2) return "intermediate";
  if (depth === 3) return "advanced";
  return "expert";
}

/** Collision-safe slug assignment — identical strategy to the legacy engine so ids stay stable and readable. */
function assignIds(entries: { tempId: string; title: string }[], reserved: Iterable<string> = []): Map<string, string> {
  const used = new Set(reserved);
  const map = new Map<string, string>();
  for (const { tempId, title } of entries) {
    const base = slugify(title) || tempId;
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix++;
    }
    used.add(id);
    map.set(tempId, id);
  }
  return map;
}

function buildLearningObjectives(title: string, parentTitle?: string): string[] {
  const objectives = [`Understand what ${title} is.`];
  if (parentTitle) objectives.push(`See how ${title} relates to ${parentTitle}.`);
  return objectives;
}

function toConceptNode(
  raw: RawAINode,
  opts: { id: string; category: string; depth: number; learningObjectives: string[]; now: string }
): ConceptNode {
  return {
    id: opts.id,
    title: raw.title,
    aliases: raw.aliases,
    category: opts.category,
    nodeType: raw.nodeType as ConceptNodeType,
    difficulty: difficultyForDepth(opts.depth),
    importance: raw.importance,
    estimatedStudyMinutes: Math.round(15 + opts.depth * 12),
    summary: raw.summary,
    description: raw.description,
    learningObjectives: opts.learningObjectives,
    searchKeywords: deriveSearchKeywords(raw.title, raw.aliases),
    parentIds: [],
    childIds: [],
    prerequisiteIds: [],
    unlocksIds: [],
    relatedIds: [],
    crossDisciplineIds: [],
    externalRefs: [{ source: "ai-inferred" }],
    isFoundational: false, // set by the caller once the full tree/child-count is known
    textRefinedByAI: true,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}

/** Derives childIds/prerequisiteIds/unlocksIds/relatedIds from the edge list so relationships are queryable both directions. Identical logic to the legacy engine. */
function linkGraph(nodes: Record<string, ConceptNode>, edges: ConceptEdge[]) {
  for (const edge of edges) {
    const source = nodes[edge.sourceId];
    const target = nodes[edge.targetId];
    if (!source || !target) continue;

    if (edge.type === "containment" || edge.type === "specialization") {
      if (!source.childIds.includes(target.id)) source.childIds.push(target.id);
      if (!target.parentIds.includes(source.id)) target.parentIds.push(source.id);
    } else if (edge.type === "prerequisite" || edge.type === "mathematical_dependency") {
      if (!target.prerequisiteIds.includes(source.id)) target.prerequisiteIds.push(source.id);
      if (!source.unlocksIds.includes(target.id)) source.unlocksIds.push(target.id);
    } else {
      if (!source.relatedIds.includes(target.id)) source.relatedIds.push(target.id);
      if (!target.relatedIds.includes(source.id)) target.relatedIds.push(source.id);
    }

    if (source.category !== target.category) {
      if (!source.crossDisciplineIds.includes(target.id)) source.crossDisciplineIds.push(target.id);
      if (!target.crossDisciplineIds.includes(source.id)) target.crossDisciplineIds.push(source.id);
    }
  }
}

function computeDepth(nodes: Record<string, ConceptNode>, rootId: string): number {
  const visited = new Set<string>();
  let frontier = [rootId];
  let depth = 0;
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      if (visited.has(id)) continue;
      visited.add(id);
      const node = nodes[id];
      if (!node) continue;
      for (const childId of node.childIds) if (!visited.has(childId)) next.push(childId);
    }
    if (next.length === 0) break;
    depth++;
    frontier = next;
  }
  return depth;
}

function containmentEdge(nodes: Record<string, ConceptNode>, sourceId: string, targetId: string): ConceptEdge {
  return {
    id: nanoid(10),
    sourceId,
    targetId,
    type: "containment",
    explanation: `${nodes[sourceId].title} contains ${nodes[targetId].title}.`,
    weight: 0.9,
    provenance: "ai-inferred",
  };
}

function mapRelationEdges(
  raw: RawAIEdge[],
  idByTemp: Map<string, string>,
  seenKeys: Set<string>
): ConceptEdge[] {
  const edges: ConceptEdge[] = [];
  for (const e of raw) {
    const sourceId = idByTemp.get(e.sourceTempId);
    const targetId = idByTemp.get(e.targetTempId);
    if (!sourceId || !targetId || sourceId === targetId) continue;
    const key = `${sourceId}::${targetId}::${e.type}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    edges.push({
      id: nanoid(10),
      sourceId,
      targetId,
      type: e.type as RelationshipType,
      explanation: e.explanation,
      weight: e.weight,
      provenance: "ai-inferred",
    });
  }
  return edges;
}

/** Turns a validated, tempId-based construction response into a fresh, fully-linked KnowledgeGraph. */
export function materializeConstruction(topic: string, raw: RawAIGraph): KnowledgeGraph {
  const now = new Date().toISOString();
  const nodeByTemp = new Map(raw.nodes.map((n) => [n.tempId, n]));
  const idByTemp = assignIds(raw.nodes.map((n) => ({ tempId: n.tempId, title: n.title })));

  const childrenOfTemp = new Map<string, string[]>();
  for (const n of raw.nodes) {
    if (n.parentTempId) {
      if (!childrenOfTemp.has(n.parentTempId)) childrenOfTemp.set(n.parentTempId, []);
      childrenOfTemp.get(n.parentTempId)!.push(n.tempId);
    }
  }

  const depthByTemp = new Map<string, number>([[raw.rootTempId, 0]]);
  {
    let frontier = [raw.rootTempId];
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const child of childrenOfTemp.get(id) ?? []) {
          if (!depthByTemp.has(child)) {
            depthByTemp.set(child, (depthByTemp.get(id) ?? 0) + 1);
            next.push(child);
          }
        }
      }
      frontier = next;
    }
  }

  // Category = the depth-1 ancestor's own title, propagated down. Processed in depth order
  // so a parent's category is always resolved before any of its children need it.
  const categoryByTemp = new Map<string, string>();
  const rootTitle = nodeByTemp.get(raw.rootTempId)?.title ?? topic;
  categoryByTemp.set(raw.rootTempId, rootTitle);
  const sortedByDepth = [...raw.nodes].sort((a, b) => (depthByTemp.get(a.tempId) ?? 99) - (depthByTemp.get(b.tempId) ?? 99));
  for (const n of sortedByDepth) {
    if (n.tempId === raw.rootTempId) continue;
    const depth = depthByTemp.get(n.tempId) ?? 1;
    if (depth === 1) {
      categoryByTemp.set(n.tempId, n.title);
    } else {
      const parentCategory = n.parentTempId ? categoryByTemp.get(n.parentTempId) : undefined;
      categoryByTemp.set(n.tempId, parentCategory ?? rootTitle);
    }
  }

  const childCount = new Map<string, number>();
  for (const n of raw.nodes) if (n.parentTempId) childCount.set(n.parentTempId, (childCount.get(n.parentTempId) ?? 0) + 1);

  const nodes: Record<string, ConceptNode> = {};
  for (const n of raw.nodes) {
    const id = idByTemp.get(n.tempId)!;
    const depth = depthByTemp.get(n.tempId) ?? 0;
    const parentTitle = n.parentTempId ? nodeByTemp.get(n.parentTempId)?.title : undefined;
    const node = toConceptNode(n, {
      id,
      category: categoryByTemp.get(n.tempId) ?? rootTitle,
      depth,
      learningObjectives: buildLearningObjectives(n.title, parentTitle),
      now,
    });
    node.isFoundational = depth >= 2 && (childCount.get(n.tempId) ?? 0) === 0;
    nodes[id] = node;
  }

  const edges: ConceptEdge[] = [];
  const seenKeys = new Set<string>();
  for (const n of raw.nodes) {
    if (!n.parentTempId) continue;
    const sourceId = idByTemp.get(n.parentTempId)!;
    const targetId = idByTemp.get(n.tempId)!;
    const key = `${sourceId}::${targetId}::containment`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    edges.push(containmentEdge(nodes, sourceId, targetId));
  }
  edges.push(...mapRelationEdges(raw.edges, idByTemp, seenKeys));

  linkGraph(nodes, edges);

  const rootId = idByTemp.get(raw.rootTempId)!;
  return {
    id: slugify(topic) || rootId,
    rootConceptId: rootId,
    topic,
    nodes,
    edges,
    depth: computeDepth(nodes, rootId),
    nodeCount: Object.keys(nodes).length,
    edgeCount: edges.length,
    status: "ready",
    constructionStages: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Merges a validated expansion response into an EXISTING graph, mutating
 * nothing that was already there — only appending new nodes/edges beneath
 * the focus concept. Returns the same graph object, updated in place, for
 * convenience at the call site.
 */
export function mergeExpansion(graph: KnowledgeGraph, focusId: string, raw: RawAIExpansion): KnowledgeGraph {
  const focus = graph.nodes[focusId];
  if (!focus) throw new Error(`Concept ${focusId} not found in graph ${graph.id}`);

  const now = new Date().toISOString();
  const reservedIds = Object.keys(graph.nodes);
  const idByTemp = assignIds(
    raw.nodes.map((n) => ({ tempId: n.tempId, title: n.title })),
    reservedIds
  );

  const depth = estimateDepth(graph, focusId) + 1;

  for (const n of raw.nodes) {
    const id = idByTemp.get(n.tempId)!;
    if (graph.nodes[id]) continue; // already present — never overwrite an existing node
    const node = toConceptNode(n, {
      id,
      category: focus.category,
      depth,
      learningObjectives: buildLearningObjectives(n.title, focus.title),
      now,
    });
    node.isFoundational = true; // newly added leaves are foundational until further expanded
    graph.nodes[id] = node;
  }

  const newEdges: ConceptEdge[] = [];
  const seenKeys = new Set(graph.edges.map((e) => `${e.sourceId}::${e.targetId}::${e.type}`));
  for (const n of raw.nodes) {
    const childId = idByTemp.get(n.tempId)!;
    if (!graph.nodes[childId]) continue;
    const key = `${focusId}::${childId}::containment`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    newEdges.push(containmentEdge(graph.nodes, focusId, childId));
  }
  newEdges.push(...mapRelationEdges(raw.edges, idByTemp, seenKeys));

  graph.edges.push(...newEdges);
  linkGraph(graph.nodes, newEdges);
  // A newly-expanded focus node is no longer a terminal leaf.
  focus.isFoundational = false;

  graph.nodeCount = Object.keys(graph.nodes).length;
  graph.edgeCount = graph.edges.length;
  graph.depth = computeDepth(graph.nodes, graph.rootConceptId);
  graph.updatedAt = now;

  return graph;
}

function estimateDepth(graph: KnowledgeGraph, nodeId: string): number {
  // BFS from root; used only as a fallback since ConceptNode doesn't store depth directly.
  const visited = new Set<string>([graph.rootConceptId]);
  let frontier = [graph.rootConceptId];
  let depth = 0;
  while (frontier.length > 0) {
    if (frontier.includes(nodeId)) return depth;
    const next: string[] = [];
    for (const id of frontier) {
      const node = graph.nodes[id];
      if (!node) continue;
      for (const childId of node.childIds) if (!visited.has(childId)) {
        visited.add(childId);
        next.push(childId);
      }
    }
    depth++;
    frontier = next;
  }
  return depth;
}
