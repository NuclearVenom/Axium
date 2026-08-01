import { KnowledgeGraph } from "../../types/graph";
import { useIsMobile } from "../../hooks/useIsMobile";
import { ConceptPanelDesktop } from "./ConceptPanelDesktop";
import { ConceptPanelMobileSheet } from "./ConceptPanelMobileSheet";

/**
 * Picks the right shell for the device: a resizable side panel on desktop,
 * a draggable bottom sheet on mobile. Both host the same ConceptPanelBody
 * content — only how it's docked and resized differs.
 */
export function ConceptPanel({
  graph,
  conceptId,
  onNavigate,
  onClose,
  onGraphUpdated,
}: {
  graph: KnowledgeGraph;
  conceptId: string;
  onNavigate: (conceptId: string) => void;
  onClose: () => void;
  onGraphUpdated: (graph: KnowledgeGraph) => void;
}) {
  const isMobile = useIsMobile();
  const concept = graph.nodes[conceptId];
  if (!concept) return null;

  const Shell = isMobile ? ConceptPanelMobileSheet : ConceptPanelDesktop;
  return <Shell graph={graph} concept={concept} onNavigate={onNavigate} onClose={onClose} onGraphUpdated={onGraphUpdated} />;
}
