import { ConceptNode, KnowledgeGraph, PositionedNode } from "../../types/graph";

const RING_GAP = 190;
const MIN_ANGLE_SPAN = 0.06;

interface TreeNode {
  id: string;
  children: TreeNode[];
  subtreeSize: number;
}

/**
 * Determines each node's single "primary" parent for layout purposes, even
 * though the underlying graph keeps its full web of relationships.
 * Preference order: containment, then prerequisite, then anything else
 * pointing at it, falling back to the root so no node is ever orphaned.
 *
 * This is the exact same resolution the radial layout has always used —
 * extracted here so it can also drive the knowledge-flow animation without
 * touching the layout math itself.
 */
function buildPrimaryParentMap(graph: KnowledgeGraph): Map<string, string> {
  const primaryParent = new Map<string, string>();

  // Pass 1: containment relationships are the strongest signal of "belongs under".
  for (const node of Object.values(graph.nodes)) {
    if (node.id === graph.rootConceptId) continue;
    if (node.parentIds.length > 0 && graph.nodes[node.parentIds[0]]) {
      primaryParent.set(node.id, node.parentIds[0]);
    }
  }

  // Pass 2: anything still unassigned, use its first prerequisite as the "before" anchor.
  for (const node of Object.values(graph.nodes)) {
    if (node.id === graph.rootConceptId || primaryParent.has(node.id)) continue;
    if (node.prerequisiteIds.length > 0 && graph.nodes[node.prerequisiteIds[0]]) {
      primaryParent.set(node.id, node.prerequisiteIds[0]);
    }
  }

  // Pass 3: anything still unassigned, attach to whatever points at it at all.
  for (const edge of graph.edges) {
    if (primaryParent.has(edge.targetId) || edge.targetId === graph.rootConceptId) continue;
    if (graph.nodes[edge.sourceId]) primaryParent.set(edge.targetId, edge.sourceId);
  }

  // Pass 4: anything still unassigned falls back to root directly.
  for (const node of Object.values(graph.nodes)) {
    if (node.id === graph.rootConceptId || primaryParent.has(node.id)) continue;
    primaryParent.set(node.id, graph.rootConceptId);
  }

  return primaryParent;
}

function buildLayoutTree(graph: KnowledgeGraph): TreeNode {
  const primaryParent = buildPrimaryParentMap(graph);
  const childrenOf = new Map<string, string[]>();

  // Guard against accidental cycles by tracking visited ancestors while assembling.
  for (const [child, parent] of primaryParent.entries()) {
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent)!.push(child);
  }

  function build(id: string, visiting: Set<string>): TreeNode {
    if (visiting.has(id)) return { id, children: [], subtreeSize: 1 };
    visiting.add(id);
    const kids = (childrenOf.get(id) ?? [])
      .filter((k) => k !== id)
      .map((k) => build(k, visiting));
    visiting.delete(id);
    const subtreeSize = 1 + kids.reduce((sum, k) => sum + k.subtreeSize, 0);
    return { id, children: kids, subtreeSize };
  }

  return build(graph.rootConceptId, new Set());
}

/**
 * The spanning-tree edges (parent -> child) used internally by the radial
 * layout, exposed for the knowledge-flow animation. This does not affect
 * node positions in any way — it's the same hierarchy the layout already
 * computes, just made available to the renderer.
 */
export function getSpanningTreeEdges(graph: KnowledgeGraph): { parentId: string; childId: string }[] {
  const primaryParent = buildPrimaryParentMap(graph);
  return [...primaryParent.entries()].map(([childId, parentId]) => ({ parentId, childId }));
}

function assignAngles(
  node: TreeNode,
  startAngle: number,
  endAngle: number,
  depth: number,
  out: Map<string, { angle: number; depth: number }>
) {
  const midAngle = (startAngle + endAngle) / 2;
  out.set(node.id, { angle: midAngle, depth });

  if (node.children.length === 0) return;

  const span = endAngle - startAngle;
  const totalWeight = node.children.reduce((sum, c) => sum + Math.max(c.subtreeSize, 1), 0);
  let cursor = startAngle;

  for (const child of node.children) {
    const weight = Math.max(child.subtreeSize, 1) / totalWeight;
    let childSpan = span * weight;
    if (childSpan < MIN_ANGLE_SPAN && node.children.length > 1) childSpan = MIN_ANGLE_SPAN;
    assignAngles(child, cursor, cursor + childSpan, depth + 1, out);
    cursor += childSpan;
  }
}

/**
 * Rough on-screen footprint of a node's label, used only to decide whether
 * two same-ring neighbors are tight enough to need staggering — not for
 * pixel-perfect layout, just enough to catch the crowded cases.
 */
function estimateLabelWidth(title: string, depth: number): number {
  const fontSize = getLabelStyle(depth).fontSize;
  return 20 + title.length * fontSize * 0.56;
}

/**
 * Every node's label is always shown (per Axium's readability requirement),
 * so the layout itself has to do some of the decluttering work rather than
 * leaving it entirely to hover/selection state. Within each depth ring,
 * neighbors whose labels would likely overlap given their angular spacing
 * are nudged to alternating radii so their text has room to breathe.
 */
function computeLabelStagger(graph: KnowledgeGraph, angleMap: Map<string, { angle: number; depth: number }>): Map<string, number> {
  const byDepth = new Map<number, { id: string; angle: number }[]>();
  for (const [id, info] of angleMap) {
    if (info.depth === 0) continue;
    if (!byDepth.has(info.depth)) byDepth.set(info.depth, []);
    byDepth.get(info.depth)!.push({ id, angle: info.angle });
  }

  const stagger = new Map<string, number>();
  for (const [depth, entries] of byDepth) {
    if (entries.length < 2) continue;
    entries.sort((a, b) => a.angle - b.angle);
    const baseRadius = RING_GAP * Math.pow(depth, 0.92);
    let toggle = false;
    for (let i = 0; i < entries.length; i++) {
      const cur = entries[i];
      const next = entries[(i + 1) % entries.length];
      let delta = Math.abs(next.angle - cur.angle);
      delta = Math.min(delta, Math.PI * 2 - delta) || Math.PI * 2;
      const arcGap = baseRadius * delta;
      const node = graph.nodes[cur.id];
      if (!node) continue;
      const neededGap = estimateLabelWidth(node.title, depth);
      if (arcGap < neededGap && entries.length > 1) {
        toggle = !toggle;
        stagger.set(cur.id, toggle ? 26 : -12);
      }
    }
  }
  return stagger;
}

export function computeRadialLayout(graph: KnowledgeGraph): PositionedNode[] {
  const tree = buildLayoutTree(graph);
  const angleMap = new Map<string, { angle: number; depth: number }>();
  assignAngles(tree, 0, Math.PI * 2, 0, angleMap);
  const stagger = computeLabelStagger(graph, angleMap);

  const positioned: PositionedNode[] = [];
  for (const node of Object.values(graph.nodes)) {
    const info = angleMap.get(node.id) ?? { angle: 0, depth: 0 };
    const baseRadius = info.depth === 0 ? 0 : RING_GAP * Math.pow(info.depth, 0.92);
    const radius = baseRadius + (stagger.get(node.id) ?? 0);
    positioned.push({
      node,
      x: radius * Math.cos(info.angle),
      y: radius * Math.sin(info.angle),
      depth: info.depth,
    });
  }
  return positioned;
}

/** Depth-scaled label typography — labels are always visible, but recede slightly with depth so deep, dense rings stay legible rather than shouting. */
export function getLabelStyle(depth: number): { fontSize: number; fontWeight: number; opacity: number } {
  if (depth <= 0) return { fontSize: 15, fontWeight: 700, opacity: 1 };
  if (depth === 1) return { fontSize: 13, fontWeight: 650, opacity: 1 };
  if (depth === 2) return { fontSize: 11.5, fontWeight: 550, opacity: 0.95 };
  if (depth === 3) return { fontSize: 10.5, fontWeight: 500, opacity: 0.88 };
  return { fontSize: 9.5, fontWeight: 450, opacity: 0.8 };
}

/**
 * One bright, saturated color per depth layer — every node at the same
 * depth shares this color, and every depth gets a color unique to it.
 * A fixed palette (rather than a hash) so the sequence is deterministic
 * and each layer reads as clearly distinct against the dark canvas.
 */
const DEPTH_COLOR_PALETTE = [
  "#FFE14D", // depth 0 — root
  "#3AA6FF", // depth 1
  "#33E6A0", // depth 2
  "#FF4FA3", // depth 3
  "#FF8A3D", // depth 4
  "#B57BFF", // depth 5
  "#4DE8E8", // depth 6
  "#F2FF4D", // depth 7
];

export function depthColor(depth: number): string {
  if (depth >= 0 && depth < DEPTH_COLOR_PALETTE.length) return DEPTH_COLOR_PALETTE[depth];
  // Beyond the fixed palette (very deep expansion chains), keep generating
  // distinct bright hues rather than repeating one.
  const hue = (depth * 47) % 360;
  return `hsl(${hue}, 88%, 62%)`;
}
