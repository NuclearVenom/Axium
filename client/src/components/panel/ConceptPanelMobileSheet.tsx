import { useEffect, useState } from "react";
import { ConceptNode, KnowledgeGraph } from "../../types/graph";
import { ConceptPanelBody } from "./ConceptPanelBody";

const COLLAPSED_HEIGHT = 108; // just the "head" — drag handle + category + title
const TOP_INSET = 48; // always leave a sliver of the graph visible, even at max height
const MAX_HEIGHT_RATIO = 0.94;

function getMaxHeight(): number {
  return Math.min(window.innerHeight - TOP_INSET, window.innerHeight * MAX_HEIGHT_RATIO);
}

/**
 * The mobile equivalent of the desktop side panel: a sheet docked to the
 * bottom edge, dragged open by its handle. Deliberately simple, and
 * deliberately NOT built on any animation/spring library for the drag
 * itself — height is plain React state, set directly and only from
 * pointer events. There is no snapping and no settle animation: wherever
 * you release it is where it stays. It always opens collapsed at the
 * bottom, showing just the concept's category and title.
 *
 * Earlier versions of this component used Framer Motion's `drag` gesture
 * system and, later, a spring-based snap-to-position system. Both were
 * reported stuck/unresponsive on real phones. Rather than keep chasing
 * that, this version removes every moving part that isn't strictly
 * necessary: no motion values, no imperative animation, nothing that
 * could contend with an in-progress drag for control of the panel's
 * position. The drag itself is the same plain-pointer-event approach the
 * desktop panel's resize handle already uses successfully.
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
  const [height, setHeight] = useState(COLLAPSED_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) return;

    let rafId: number | null = null;
    let pendingHeight: number | null = null;

    const applyPendingHeight = () => {
      if (pendingHeight !== null) setHeight(pendingHeight);
      rafId = null;
    };
    const handleMove = (event: PointerEvent) => {
      const raw = window.innerHeight - event.clientY;
      pendingHeight = Math.min(Math.max(raw, COLLAPSED_HEIGHT), getMaxHeight());
      if (rafId === null) rafId = requestAnimationFrame(applyPendingHeight);
    };
    const endDrag = () => setIsDragging(false);

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [isDragging]);

  // Re-clamp on rotation/resize so the sheet can't end up taller than the
  // (new) viewport if the device is rotated while it's open.
  useEffect(() => {
    const handleResize = () => setHeight((h) => Math.min(h, getMaxHeight()));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      style={{ height: `${height}px` }}
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-panel/70 shadow-[0_-16px_40px_rgba(0,0,0,0.3)] backdrop-blur-2xl animate-fade-in"
    >
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
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
    </div>
  );
}
