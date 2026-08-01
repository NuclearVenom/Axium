import { useEffect, useState } from "react";
import { motion, useMotionValue, useDragControls, animate, PanInfo } from "framer-motion";
import { ConceptNode, KnowledgeGraph } from "../../types/graph";
import { ConceptPanelBody } from "./ConceptPanelBody";

const COLLAPSED_HEIGHT = 108; // "bottom" snap — just the head: handle + category + title
const MIDDLE_RATIO = 0.55; // "middle" snap — roughly half the screen
const TOP_INSET = 48; // "top" snap always leaves this much of the graph visible above it
const TOP_HEIGHT_RATIO = 0.94;
const FLING_VELOCITY = 550; // px/s — above this, a swipe moves one snap point regardless of distance dragged

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
 * Either way it eases past the target slightly and springs back, rather
 * than stopping dead — that overshoot-and-settle is `bounce` on the
 * spring below, not a separate effect.
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
  // opened for a concept — see the mount behavior note below.
  const [snapIndex, setSnapIndex] = useState<0 | 1 | 2>(2);
  const dragControls = useDragControls();

  // Starts off-screen (below the collapsed position) so the very first
  // mount animates in as a slide-up rather than appearing instantly.
  const y = useMotionValue(computeSnapMetrics().panelHeight);

  useEffect(() => {
    const controls = animate(y, metrics.snapY[snapIndex], {
      type: "spring",
      bounce: 0.22,
      duration: 0.5,
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapIndex, metrics]);

  // Re-derive snap positions on resize/rotation, keeping whichever snap
  // (top/middle/bottom) is currently active rather than the exact pixel.
  useEffect(() => {
    const handleResize = () => setMetrics(computeSnapMetrics());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    setIsDragging(false);
    const nearest = nearestSnapIndex(metrics.snapY, y.get());
    const velocity = info.velocity.y;

    let target = nearest;
    if (velocity < -FLING_VELOCITY) target = Math.max(0, nearest - 1); // swiped up -> one step toward "top"
    else if (velocity > FLING_VELOCITY) target = Math.min(2, nearest + 1); // swiped down -> one step toward "bottom"

    setSnapIndex(target as 0 | 1 | 2);
  };

  return (
    <motion.div
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0.12}
      dragConstraints={{ top: metrics.snapY[0], bottom: metrics.snapY[2] }}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      style={{ y, height: metrics.panelHeight, willChange: "transform" }}
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-panel/70 shadow-[0_-16px_40px_rgba(0,0,0,0.3)] backdrop-blur-2xl animate-fade-in"
    >
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex shrink-0 cursor-grab touch-none flex-col items-center gap-0.5 py-3 active:cursor-grabbing"
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
