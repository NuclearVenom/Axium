import { useEffect, useState } from "react";
import { ConceptNode, KnowledgeGraph } from "../../types/graph";
import { ConceptPanelBody } from "./ConceptPanelBody";

const MIN_PANEL_WIDTH = 340;
const MAX_PANEL_WIDTH = 720;

export function ConceptPanelDesktop({
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
  // null means "use the default responsive Tailwind width" until the
  // person actually drags the handle, at which point an explicit pixel
  // width takes over.
  const [width, setWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;

    let rafId: number | null = null;
    let pendingWidth: number | null = null;

    const applyPendingWidth = () => {
      if (pendingWidth !== null) setWidth(pendingWidth);
      rafId = null;
    };
    const handleMove = (event: PointerEvent) => {
      const raw = window.innerWidth - event.clientX;
      const cap = Math.min(MAX_PANEL_WIDTH, window.innerWidth * 0.85);
      pendingWidth = Math.min(Math.max(raw, MIN_PANEL_WIDTH), cap);
      if (rafId === null) rafId = requestAnimationFrame(applyPendingWidth);
    };
    const handleUp = () => setIsResizing(false);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [isResizing]);

  return (
    <aside
      style={width !== null ? { width: `${width}px` } : undefined}
      className="pointer-events-auto relative flex h-full w-full flex-col overflow-y-auto border-l border-white/10 bg-panel/65 p-6 shadow-[-16px_0_40px_rgba(0,0,0,0.3)] backdrop-blur-2xl animate-fade-in sm:w-[420px]"
    >
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        className="group absolute -left-1.5 top-0 z-20 hidden h-full w-3 cursor-col-resize touch-none sm:block"
        role="separator"
        aria-label="Resize panel"
        aria-orientation="vertical"
      >
        <div
          className={`mx-auto h-full w-px transition-colors ${
            isResizing ? "bg-accent" : "bg-transparent group-hover:bg-accent/50"
          }`}
        />
      </div>

      <ConceptPanelBody graph={graph} concept={concept} onNavigate={onNavigate} onClose={onClose} onGraphUpdated={onGraphUpdated} />
    </aside>
  );
}
