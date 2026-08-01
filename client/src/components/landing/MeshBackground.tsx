import { useEffect, useRef } from "react";
import { buildMeshGeometry, MeshEdge } from "./meshGeometry";

interface MeshNode {
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Per-node ambient drift — gives the whole mesh a slow, organic wave
  // rather than every node oscillating in lockstep.
  waveFreqX: number;
  waveFreqY: number;
  wavePhaseX: number;
  wavePhaseY: number;
}

interface Pulse {
  edge: number;
  t: number;
  speed: number;
  reverse: boolean;
}

const LINE_RGB = "110, 175, 255";
const HOVER_RADIUS = 100;
const REPEL_STRENGTH = 0.35;
const SPRING_K = 0.025;
const DAMPING = 0.9;
const MAX_PULSES = 7;
const PULSE_SPAWN_CHANCE = 0.03;
const PULSE_TRAIL_T = 0.16;
const WAVE_AMPLITUDE = 13;

/**
 * A thin, decorative network spanning the full width of its container as
 * ONE connected mesh (see meshGeometry.ts for the placement + connectivity
 * guarantee) — junctions are just where 3-4 lines cross, nothing is drawn
 * at the node itself. The whole mesh sways slowly on its own (per-node
 * phase-offset sine drift) and additionally eases away from the cursor
 * like loose fabric. Occasional pulses glide along an edge as a short
 * light-gray streak fading into its tail, rather than a plain dot.
 *
 * Everything renders on one canvas rather than many DOM/SVG nodes, so
 * cost stays flat regardless of mesh density, and the animation loop is
 * skipped entirely under prefers-reduced-motion (a single static frame is
 * drawn instead).
 */
export function MeshBackground({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let nodes: MeshNode[] = [];
    let edges: MeshEdge[] = [];
    let pulses: Pulse[] = [];
    let frameId = 0;
    let visible = !document.hidden;
    let startTime = performance.now();

    function buildMesh() {
      const rect = container!.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const geometry = buildMeshGeometry(width, height);
      nodes = geometry.nodes.map((seed) => ({
        homeX: seed.x,
        homeY: seed.y,
        x: seed.x,
        y: seed.y,
        vx: 0,
        vy: 0,
        waveFreqX: seed.waveFreqX,
        waveFreqY: seed.waveFreqY,
        wavePhaseX: seed.wavePhaseX,
        wavePhaseY: seed.wavePhaseY,
      }));
      edges = geometry.edges;
      pulses = [];
    }

    function step(elapsedSeconds: number) {
      const pointer = pointerRef.current;
      for (const n of nodes) {
        const waveX = Math.sin(elapsedSeconds * n.waveFreqX + n.wavePhaseX) * WAVE_AMPLITUDE;
        const waveY = Math.cos(elapsedSeconds * n.waveFreqY + n.wavePhaseY) * WAVE_AMPLITUDE;
        let fx = (n.homeX + waveX - n.x) * SPRING_K;
        let fy = (n.homeY + waveY - n.y) * SPRING_K;
        if (pointer) {
          const dx = n.x - pointer.x;
          const dy = n.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < HOVER_RADIUS && dist > 0.01) {
            const force = (1 - dist / HOVER_RADIUS) * REPEL_STRENGTH;
            fx += (dx / dist) * force;
            fy += (dy / dist) * force;
          }
        }
        n.vx = (n.vx + fx) * DAMPING;
        n.vy = (n.vy + fy) * DAMPING;
        n.x += n.vx;
        n.y += n.vy;
      }
    }

    function maybeSpawnPulse() {
      if (pulses.length >= MAX_PULSES || edges.length === 0) return;
      if (Math.random() < PULSE_SPAWN_CHANCE) {
        pulses.push({
          edge: Math.floor(Math.random() * edges.length),
          t: 0,
          speed: 0.006 + Math.random() * 0.009,
          reverse: Math.random() < 0.5,
        });
      }
    }

    function drawPulse(pulse: Pulse) {
      const edge = edges[pulse.edge];
      if (!edge) return;
      const a = nodes[edge.a];
      const b = nodes[edge.b];
      const headT = pulse.reverse ? 1 - pulse.t : pulse.t;
      const tailT = pulse.reverse ? Math.min(1, headT + PULSE_TRAIL_T) : Math.max(0, headT - PULSE_TRAIL_T);
      const headX = a.x + (b.x - a.x) * headT;
      const headY = a.y + (b.y - a.y) * headT;
      const tailX = a.x + (b.x - a.x) * tailT;
      const tailY = a.y + (b.y - a.y) * tailT;
      const lifeAlpha = Math.sin(pulse.t * Math.PI);

      // A light-gray streak fading toward the tail — a glide of light
      // along the wire, not a dot — plus a brighter glint at the head.
      const gradient = ctx!.createLinearGradient(tailX, tailY, headX, headY);
      gradient.addColorStop(0, "rgba(215, 219, 230, 0)");
      gradient.addColorStop(1, `rgba(215, 219, 230, ${(0.75 * lifeAlpha).toFixed(3)})`);
      ctx!.strokeStyle = gradient;
      ctx!.lineWidth = 1.6;
      ctx!.lineCap = "round";
      ctx!.beginPath();
      ctx!.moveTo(tailX, tailY);
      ctx!.lineTo(headX, headY);
      ctx!.stroke();

      ctx!.beginPath();
      ctx!.fillStyle = `rgba(255, 255, 255, ${(0.95 * lifeAlpha).toFixed(3)})`;
      ctx!.arc(headX, headY, 1.25, 0, Math.PI * 2);
      ctx!.fill();
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      ctx!.lineWidth = 1;
      ctx!.strokeStyle = `rgba(${LINE_RGB}, 0.30)`;
      ctx!.beginPath();
      for (const e of edges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
      }
      ctx!.stroke();

      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i];
        pulse.t += pulse.speed;
        if (pulse.t >= 1 || !edges[pulse.edge]) {
          pulses.splice(i, 1);
          continue;
        }
        drawPulse(pulse);
      }
    }

    function frame() {
      if (!visible) return;
      const elapsedSeconds = (performance.now() - startTime) / 1000;
      step(elapsedSeconds);
      maybeSpawnPulse();
      draw();
      frameId = requestAnimationFrame(frame);
    }

    function handlePointerMove(event: PointerEvent) {
      const rect = container!.getBoundingClientRect();
      pointerRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    function handlePointerLeave() {
      pointerRef.current = null;
    }

    buildMesh();
    draw();

    if (!reduceMotion) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
      frame();
    }

    function handleVisibilityChange() {
      const wasHidden = !visible;
      visible = !document.hidden;
      if (visible && wasHidden && !reduceMotion) frame();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let resizeTimeout: ReturnType<typeof setTimeout> | undefined;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        buildMesh();
        draw();
      }, 150);
    });
    resizeObserver.observe(container);

    return () => {
      visible = false;
      cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      resizeObserver.disconnect();
      clearTimeout(resizeTimeout);
    };
  }, []);

  return (
    <div ref={containerRef} className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}>
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
