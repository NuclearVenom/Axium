export interface MeshNodeSeed {
  x: number;
  y: number;
  waveFreqX: number;
  waveFreqY: number;
  wavePhaseX: number;
  wavePhaseY: number;
}

export interface MeshEdge {
  a: number;
  b: number;
}

export interface MeshGeometry {
  nodes: MeshNodeSeed[];
  edges: MeshEdge[];
}

const MIN_NODES = 22;
const MAX_NODES = 52;
const NODE_AREA_DIVISOR = 8500;
const CELL_SKIP_CHANCE = 0.08;

/**
 * Points on a jittered grid spanning the full width and height, edge to
 * edge — this (not pure random scatter) is what keeps the mesh from
 * clumping into visible clusters or leaving big gaps: coverage is even
 * by construction, jitter just keeps it from looking like a rigid grid.
 */
function seedNodes(width: number, height: number, random: () => number): MeshNodeSeed[] {
  const targetCount = Math.max(MIN_NODES, Math.min(MAX_NODES, Math.round((width * height) / NODE_AREA_DIVISOR)));
  const aspect = width / height;
  const cols = Math.max(3, Math.round(Math.sqrt(targetCount * aspect)));
  const rows = Math.max(2, Math.round(targetCount / cols));
  const cellW = width / cols;
  const cellH = height / rows;

  const nodes: MeshNodeSeed[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (random() < CELL_SKIP_CHANCE) continue;
      const jitterX = (random() - 0.5) * cellW * 0.72;
      const jitterY = (random() - 0.5) * cellH * 0.72;
      nodes.push({
        x: Math.min(width, Math.max(0, c * cellW + cellW / 2 + jitterX)),
        y: Math.min(height, Math.max(0, r * cellH + cellH / 2 + jitterY)),
        waveFreqX: 0.05 + random() * 0.08,
        waveFreqY: 0.05 + random() * 0.08,
        wavePhaseX: random() * Math.PI * 2,
        wavePhaseY: random() * Math.PI * 2,
      });
    }
  }
  return nodes;
}

/** Every node connects to its 3-4 nearest neighbors — a "node" is just where those lines cross, nothing is drawn at the point itself. */
function knnEdges(nodes: MeshNodeSeed[], random: () => number): MeshEdge[] {
  const result: MeshEdge[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const ranked = nodes
      .map((n, j) => ({ j, d: j === i ? Infinity : Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y) }))
      .sort((a, b) => a.d - b.d);
    const linkCount = random() < 0.5 ? 3 : 4;
    for (let k = 0; k < linkCount && k < ranked.length; k++) {
      const j = ranked[k].j;
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ a: i, b: j });
      }
    }
  }
  return result;
}

/**
 * Guarantees the mesh is a SINGLE connected shape, regardless of how the
 * k-NN pass above happened to land: finds every connected component via
 * union-find, then bridges each smaller component to the main one through
 * its closest pair of nodes. Deterministic and cheap at this node count —
 * this is what turns "usually looks connected" into "always is."
 */
export function ensureSingleComponent(nodes: MeshNodeSeed[], edges: MeshEdge[]): MeshEdge[] {
  const parent = nodes.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (const e of edges) union(e.a, e.b);

  const groups = new Map<number, number[]>();
  for (let i = 0; i < nodes.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }
  const groupList = [...groups.values()];
  if (groupList.length <= 1) return edges;

  let main = groupList.reduce((a, b) => (a.length >= b.length ? a : b));
  const others = groupList.filter((g) => g !== main);
  const bridges: MeshEdge[] = [];
  for (const group of others) {
    let best = { d: Infinity, i: -1, j: -1 };
    for (const i of main) {
      for (const j of group) {
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (d < best.d) best = { d, i, j };
      }
    }
    if (best.i !== -1) {
      bridges.push({ a: best.i, b: best.j });
      main = main.concat(group);
    }
  }
  return [...edges, ...bridges];
}

export function buildMeshGeometry(width: number, height: number, random: () => number = Math.random): MeshGeometry {
  const nodes = seedNodes(width, height, random);
  const edges = ensureSingleComponent(nodes, knnEdges(nodes, random));
  return { nodes, edges };
}

/** True if every node is reachable from node 0 by following edges — used by tests, and safe to use for a runtime sanity check too. */
export function isSingleComponent(nodes: MeshNodeSeed[], edges: MeshEdge[]): boolean {
  if (nodes.length === 0) return true;
  const adjacency = new Map<number, number[]>();
  for (const e of edges) {
    if (!adjacency.has(e.a)) adjacency.set(e.a, []);
    if (!adjacency.has(e.b)) adjacency.set(e.b, []);
    adjacency.get(e.a)!.push(e.b);
    adjacency.get(e.b)!.push(e.a);
  }
  const visited = new Set<number>([0]);
  const queue = [0];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited.size === nodes.length;
}
