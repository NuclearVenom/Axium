import { useState } from "react";
import { KnowledgeGraph } from "../types/graph";
import { GraphCanvas } from "../components/graph/GraphCanvas";
import { ConceptPanel } from "../components/panel/ConceptPanel";
import { LogoWatermark } from "../components/common/LogoWatermark";
import { AxiumLogoMark } from "../components/common/AxiumLogoMark";
import { useIsMobile } from "../hooks/useIsMobile";

function GraphExplorer({
  graph,
  onSearchAgain,
  onGraphUpdated,
  onGoHome,
}: {
  graph: KnowledgeGraph;
  onSearchAgain: (topic: string) => void;
  onGraphUpdated: (graph: KnowledgeGraph) => void;
  onGoHome: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(graph.rootConceptId);
  const [searchValue, setSearchValue] = useState("");
  const isMobile = useIsMobile();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) onSearchAgain(searchValue.trim());
  };

  return (
    <div className="relative flex h-full w-full bg-canvas">
      {/* Logo watermark — large, dark gray, spanning the full height, sitting
          behind the graph itself (the graph canvas is transparent, so this
          shows through behind the nodes/edges). */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
        <LogoWatermark className="h-[92%] w-auto opacity-[0.08]" />
      </div>

      <div className="absolute inset-0">
        <GraphCanvas graph={graph} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* Home button + persistent minimal search bar, top-left */}
      <div className="pointer-events-auto absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex w-[calc(100%-2rem)] items-center gap-2 sm:left-6 sm:top-6 sm:w-80">
        <button
          onClick={onGoHome}
          aria-label="Back to home"
          title="Back to home"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-canvas/80 backdrop-blur-xl transition-colors hover:border-accent/40"
        >
          <AxiumLogoMark className="h-[18px] w-auto" />
        </button>
        <form onSubmit={handleSearchSubmit} className="min-w-0 flex-1">
          <input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search a new topic…"
            className="w-full rounded-xl border border-border bg-canvas/80 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted backdrop-blur-xl focus:border-accent/40 focus:outline-none"
          />
        </form>
      </div>

      {!(isMobile && selectedId) && (
        <div className="pointer-events-none absolute left-4 bottom-4 z-10 max-w-[calc(100%-2rem)] truncate rounded-xl border border-border bg-canvas/80 px-4 py-2.5 text-xs text-ink-muted backdrop-blur-xl sm:left-6 sm:bottom-6 sm:max-w-none">
          {graph.topic} · {graph.nodeCount} concepts · {graph.edgeCount} relationships
        </div>
      )}

      {selectedId && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10">
          <ConceptPanel
            graph={graph}
            conceptId={selectedId}
            onNavigate={setSelectedId}
            onClose={() => setSelectedId(null)}
            onGraphUpdated={onGraphUpdated}
          />
        </div>
      )}
    </div>
  );
}

export default GraphExplorer;
