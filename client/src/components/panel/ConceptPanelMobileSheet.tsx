import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { ConceptNode, KnowledgeGraph } from "../../types/graph";
import { ConceptPanelBody } from "./ConceptPanelBody";

const COLLAPSED_HEIGHT = 108; // "bottom" snap — just the head: handle + category + title
const MIDDLE_RATIO = 0.55; // "middle" snap — roughly half the screen
const TOP_INSET = 48; // "top" snap always leaves this much of the graph visible above it
const TOP_HEIGHT_RATIO = 0.94;
const FLING_VELOCITY = 550; // px/s — above this, a swipe moves one snap point regardless of distance dragged
const RUBBER_BAND = 0.3; // how much give past the top/bottom snap while actively dragging

interface SnapMetrics {
  panelHeight: number;
  /** y-translation for [top, middle, bottom] — the panel's own height never changes, only its position. */
  snapY: [number, number, number];
}

function computeSnapMetrics(): SnapMetrics {
  const vh = window.innerHeight;
  const panelHeight = Math.min(vh - TOP_INSET, vh * TOP_HEIGHT_RATIO);
  const middleHeight = Math.min(vh * MIDDLE_RATIO, panelHeight - 40);
  return {
    panelHeight,
    snapY: [0, panelHeight - middleHeight, panelHeight - COLLAPSED_HEIGHT],
  };
}

function nearestSnapIndex(snapY: readonly number[], currentY: number): number {
  let best = 0;
  let bestDist = Infinity;
  snapY.forEach((p, i) => {
    const d = Math.abs(p - currentY);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/**
 * The mobile equivalent of the desktop side panel: a sheet docked to the
 * bottom edge, dragged open by its handle, with three resting positions —
 * top (near full screen), middle (about half), and bottom (just the
 * "head" — category and title — peeking up). A fast swipe moves exactly
 * one snap point in that direction regardless of how far it was dragged;
 * a slower drag settles on whichever snap point it ends up nearest to.
 *
 * The drag itself is tracked manually with plain pointer events (the same
 * approach the desktop panel's resize handle uses) rather than Framer
 * Motion's `drag` gesture system — that's a deliberate choice, not
 * incidental: this used to be built on `dragControls`/`dragListener`, and
 * on real phones it could get stuck mid-drag. The root cause was a
 * settle-animation effect that could fire *during* an active drag (mobile
 * browsers fire `resize` when the address bar shows/hides mid-touch),
 * starting an imperative spring on the same motion value the live drag
 * was writing to — the two fought each other and the sheet stopped
 * responding. Manual tracking sidesteps that class of bug entirely: the
 * settle animation only ever runs once a drag has actually ended.
 *
 * The panel's own height never changes — it's always tall enough for the
 * "top" position — only its vertical position (a `y` transform) does.
 * Animating a transform instead of `height` keeps this on the compositor
 * rather than triggering layout every frame, which is what keeps it smooth.
 */
export function ConceptPanelMobileSheet({
  graph,
  concept,
  onNavigate,
  onClose,
  onGraphUpdated,
}: {
  graph: KnowledgeGraph;
  concept: ConceptNode;
  onNavigate: (conceptId: string) => void;
  onClose: () => void;
  onGraphUpdated: (graph: KnowledgeGraph) => void;
}) {
  const [metrics, setMetrics] = useState<SnapMetrics>(computeSnapMetrics);
  // Starts at the "bottom" (collapsed) snap whenever the sheet is freshly
  // opened for a concept.
  const [snapIndex, setSnapIndex] = useState<0 | 1 | 2>(2);
  const [isDragging, setIsDragging] = useState(false);

  // Starts off-screen (below the collapsed position) so the very first
  // mount animates in as a slide-up rather than appearing instantly.
  const y = useMotionValue(computeSnapMetrics().panelHeight);

  // Settles to the current snap point — but NEVER while a drag is live.
  // This guard is the actual fix for the "stuck" bug: without it, a
  // metrics change mid-drag (see the debounced resize handler below)
  // could start this animation on top of an in-progress drag and the two
  // would fight over the same motion value.
  useEffect(() => {
    if (isDragging) return;
    const controls = animate(y, metrics.snapY[snapIndex], {
      type: "spring",
      bounce: 0.22,
      duration: 0.5,
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapIndex, metrics, isDragging]);

  // Re-derive snap positions on resize/rotation, keeping whichever snap
  // (top/middle/bottom) is currently active rather than the exact pixel.
  // Debounced because mobile browsers fire `resize` repeatedly as their
  // address bar shows/hides during ordinary touch interaction, not just
  // on real rotation/resize.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setMetrics(computeSnapMetrics()), 200);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Manual drag tracking — see the component doc comment for why this
  // isn't Framer Motion's `drag` prop. `dragState` holds the pointer/
  // panel position at drag start; using a ref (not state) means pointer
  // moves never trigger a re-render, only direct motion-value writes do.
  const dragState = useRef<{ pointerId: number; startClientY: number; startY: number } | null>(null);

  useEffect(() => {
    if (!isDragging) return;

    let rafId: number | null = null;
    let pendingY: number | null = null;
    let lastSampleTime = performance.now();
    let lastSampleY = y.get();
    let velocity = 0;

    const applyPendingY = () => {
      if (pendingY !== null) y.set(pendingY);
      rafId = null;
    };

    const handleMove = (event: PointerEvent) => {
      const start = dragState.current;
      if (!start || event.pointerId !== start.pointerId) return;

      const delta = event.clientY - start.startClientY;
      const raw = start.startY + delta;
      const [minY, , maxY] = metrics.snapY;

      // A little give past the edges instead of a hard stop — this is
      // the "goes a little beyond" feel while actively dragging past the
      // top/bottom snap; the settle spring provides the matching effect
      // on release.
      let next = raw;
      if (raw < minY) next = minY + (raw - minY) * RUBBER_BAND;
      else if (raw > maxY) next = maxY + (raw - maxY) * RUBBER_BAND;

      const now = performance.now();
      const dt = now - lastSampleTime;
      if (dt > 0) velocity = ((next - lastSampleY) / dt) * 1000; // px/s
      lastSampleTime = now;
      lastSampleY = next;

      pendingY = next;
      if (rafId === null) rafId = requestAnimationFrame(applyPendingY);
    };

    const endDrag = () => {
      dragState.current = null;
      setIsDragging(false);

      const nearest = nearestSnapIndex(metrics.snapY, y.get());
      let target = nearest;
      if (velocity < -FLING_VELOCITY) target = Math.max(0, nearest - 1); // swiped up -> one step toward "top"
      else if (velocity > FLING_VELOCITY) target = Math.min(2, nearest + 1); // swiped down -> one step toward "bottom"
      setSnapIndex(target as 0 | 1 | 2);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    document.body.style.userSelect = "none";

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [isDragging, metrics]);

  const handlePointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    dragState.current = { pointerId: event.pointerId, startClientY: event.clientY, startY: y.get() };
    setIsDragging(true);
  };

  return (
    <motion.div
      style={{ y, height: metrics.panelHeight, willChange: "transform" }}
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-panel/70 shadow-[0_-16px_40px_rgba(0,0,0,0.3)] backdrop-blur-2xl animate-fade-in"
    >
      <div
        onPointerDown={handlePointerDown}
        style={{ touchAction: "none" }}
        className="flex shrink-0 cursor-grab touch-none flex-col items-center gap-1 py-4 active:cursor-grabbing"
        role="separator"
        aria-label="Resize panel"
        aria-orientation="horizontal"
      >
        <div className={`h-1.5 w-10 rounded-full transition-colors ${isDragging ? "bg-accent" : "bg-white/20"}`} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <ConceptPanelBody graph={graph} concept={concept} onNavigate={onNavigate} onClose={onClose} onGraphUpdated={onGraphUpdated} />
      </div>
    </motion.div>
  );
}
