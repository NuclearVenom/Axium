import { useEffect, useRef } from "react";
import { KnowledgeGraph, PositionedNode } from "../../types/graph";
import { getSpanningTreeEdges } from "./layout";
import { bezierPointAt } from "./edgeGeometry";

const MAX_POOL = 36; // hard cap on simultaneous particles — clutter can never scale with graph size
const MAX_DEPTH_ANIMATED = 6; // beyond this, branches are too far out to matter visually
const MAX_EDGES_PER_LEVEL = 14; // sampled per wave if a level has more branches than this
const WAVE_INTERVAL_MS = 3600;
const EDGE_TRAVEL_MS = 850;
const LEVEL_STAGGER = 0.8; // overlap factor between successive depth levels in a wave

interface EdgeInfo {
  p0: { x: number; y: number };
  p1: { x: number; y: number };
}

interface ScheduledParticle {
  edge: EdgeInfo;
  start: number;
  duration: number;
}

interface Wave {
  particles: ScheduledParticle[];
  endsAt: number;
}

function pickSample<T>(arr: T[], count: number): T[] {
  if (arr.length <= count) return arr;
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export function KnowledgeFlowLayer({
  graph,
  positionById,
}: {
  graph: KnowledgeGraph;
  positionById: Map<string, PositionedNode>;
}) {
  const groupRef = useRef<SVGGElement | null>(null);
  const poolRefs = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    // Build depth-grouped edge list once per graph, reusing the exact same
    // spanning tree the radial layout already computed.
    const treeEdges = getSpanningTreeEdges(graph);
    const edgesByDepth = new Map<number, EdgeInfo[]>();

    for (const { parentId, childId } of treeEdges) {
      const parentPos = positionById.get(parentId);
      const childPos = positionById.get(childId);
      if (!parentPos || !childPos || childPos.depth === 0) continue;
      if (childPos.depth > MAX_DEPTH_ANIMATED) continue;
      const list = edgesByDepth.get(childPos.depth) ?? [];
      list.push({ p0: { x: parentPos.x, y: parentPos.y }, p1: { x: childPos.x, y: childPos.y } });
      edgesByDepth.set(childPos.depth, list);
    }

    const maxDepth = Math.min(MAX_DEPTH_ANIMATED, Math.max(0, ...edgesByDepth.keys()));
    if (maxDepth === 0 || edgesByDepth.size === 0) return;

    let waves: Wave[] = [];
    let animationFrame: number;
    let waveTimer: ReturnType<typeof setInterval>;
    const slotAssignments: (ScheduledParticle | null)[] = new Array(MAX_POOL).fill(null);

    function spawnWave(now: number) {
      const particles: ScheduledParticle[] = [];
      for (let depth = 1; depth <= maxDepth; depth++) {
        const edges = edgesByDepth.get(depth);
        if (!edges || edges.length === 0) continue;
        const sample = pickSample(edges, MAX_EDGES_PER_LEVEL);
        const levelStart = now + (depth - 1) * EDGE_TRAVEL_MS * LEVEL_STAGGER;
        for (const edge of sample) {
          particles.push({
            edge,
            start: levelStart + Math.random() * 180,
            duration: EDGE_TRAVEL_MS * (0.9 + Math.random() * 0.25),
          });
        }
      }
      const lastEnd = particles.reduce((max, p) => Math.max(max, p.start + p.duration), now);
      waves.push({ particles, endsAt: lastEnd });
    }

    // Kick off immediately, then repeat.
    spawnWave(performance.now());
    waveTimer = setInterval(() => spawnWave(performance.now()), WAVE_INTERVAL_MS);

    function tick() {
      const now = performance.now();
      waves = waves.filter((w) => w.endsAt > now - 200);

      // Determine which scheduled particles are currently "in flight".
      const inFlight: { particle: ScheduledParticle; progress: number }[] = [];
      for (const wave of waves) {
        for (const particle of wave.particles) {
          const progress = (now - particle.start) / particle.duration;
          if (progress >= 0 && progress <= 1) {
            inFlight.push({ particle, progress });
          }
        }
      }

      // Release slots whose particle finished or is no longer in-flight.
      for (let i = 0; i < MAX_POOL; i++) {
        const assigned = slotAssignments[i];
        if (assigned) {
          const stillFlying = inFlight.find((f) => f.particle === assigned);
          if (!stillFlying) {
            slotAssignments[i] = null;
            const el = poolRefs.current[i];
            if (el) el.setAttribute("opacity", "0");
          }
        }
      }

      // Assign new in-flight particles to free slots.
      for (const { particle } of inFlight) {
        if (slotAssignments.includes(particle)) continue;
        const freeSlot = slotAssignments.findIndex((s) => s === null);
        if (freeSlot === -1) continue; // pool full — silently drop, keeps clutter bounded
        slotAssignments[freeSlot] = particle;
      }

      // Render current positions for all assigned slots.
      for (let i = 0; i < MAX_POOL; i++) {
        const particle = slotAssignments[i];
        const el = poolRefs.current[i];
        if (!particle || !el) continue;
        const found = inFlight.find((f) => f.particle === particle);
        if (!found) continue;
        const { progress } = found;
        const pos = bezierPointAt(particle.edge.p0, particle.edge.p1, progress);
        // Ease in/out and fade at both ends so particles never "pop".
        const fade = Math.sin(Math.PI * Math.min(1, Math.max(0, progress)));
        el.setAttribute("cx", String(pos.x));
        el.setAttribute("cy", String(pos.y));
        el.setAttribute("opacity", String(0.55 * fade));
      }

      animationFrame = requestAnimationFrame(tick);
    }

    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrame);
      clearInterval(waveTimer);
    };
  }, [graph, positionById]);

  return (
    <g ref={groupRef} aria-hidden="true">
      {Array.from({ length: MAX_POOL }).map((_, i) => (
        <circle
          key={i}
          ref={(el) => (poolRefs.current[i] = el)}
          r={2.1}
          fill="#ffffff"
          opacity={0}
          style={{ filter: "drop-shadow(0 0 3px rgba(255,255,255,0.85))" }}
        />
      ))}
    </g>
  );
}
