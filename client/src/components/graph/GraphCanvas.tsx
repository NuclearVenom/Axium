import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity, ZoomBehavior } from "d3-zoom";
import { KnowledgeGraph, PositionedNode } from "../../types/graph";
import { depthColor, computeRadialLayout } from "./layout";
import { KnowledgeFlowLayer } from "./KnowledgeFlowLayer";
import { GraphNode } from "./GraphNode";
import { GraphEdge } from "./GraphEdge";

interface GraphCanvasProps {
  graph: KnowledgeGraph;
  selectedId: string | null;
  onSelect: (conceptId: string) => void;
}

export function GraphCanvas({ graph, selectedId, onSelect }: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehavior = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  const positioned = useMemo(() => computeRadialLayout(graph), [graph]);
  const positionById = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    for (const p of positioned) map.set(p.node.id, p);
    return map;
  }, [positioned]);

  // Tracks which node ids are brand-new since the last render of THIS SAME
  // graph (i.e. appended by an expansion, not a fresh topic) so they can be
  // animated growing outward from their parent instead of popping in place.
  const prevGraphIdRef = useRef<string | null>(null);
  const prevNodeIdsRef = useRef<Set<string>>(new Set());
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(positioned.map((p) => p.node.id));
    const isSameGraphIdentity = prevGraphIdRef.current === graph.id;
    prevGraphIdRef.current = graph.id;

    if (!isSameGraphIdentity) {
      prevNodeIdsRef.current = currentIds;
      setEnteringIds(new Set());
      return;
    }

    const freshlyAdded = [...currentIds].filter((id) => !prevNodeIdsRef.current.has(id));
    prevNodeIdsRef.current = currentIds;

    if (freshlyAdded.length === 0) return;
    setEnteringIds(new Set(freshlyAdded));
    // One frame later, "settle" them — this state flip is what triggers the
    // CSS transition from the parent's position out to their real position.
    const frame = requestAnimationFrame(() => setEnteringIds(new Set()));
    return () => cancelAnimationFrame(frame);
  }, [graph, positioned]);

  const getRenderPosition = useCallback(
    (p: PositionedNode): { x: number; y: number } => {
      if (!enteringIds.has(p.node.id)) return { x: p.x, y: p.y };
      const parentId = p.node.parentIds[0];
      const parentPos = parentId ? positionById.get(parentId) : undefined;
      return parentPos ? { x: parentPos.x, y: parentPos.y } : { x: 0, y: 0 };
    },
    [enteringIds, positionById]
  );

  // Set up pan/zoom once per graph mount.
  useEffect(() => {
    if (!svgRef.current) return;
    const svgSel = select(svgRef.current);
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 2.5])
      .on("zoom", (event) => {
        setTransform(event.transform);
      });
    zoomBehavior.current = behavior;
    svgSel.call(behavior);

    const initial = zoomIdentity.translate(window.innerWidth / 2, window.innerHeight / 2).scale(0.75);
    svgSel.call(behavior.transform, initial);

    return () => {
      svgSel.on(".zoom", null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.id]);

  // Smoothly re-center when selection changes.
  useEffect(() => {
    if (!selectedId || !svgRef.current || !zoomBehavior.current) return;
    const pos = positionById.get(selectedId);
    if (!pos) return;
    const svgSel = select(svgRef.current);
    const target = zoomIdentity
      .translate(window.innerWidth / 2 - pos.x * transform.k, window.innerHeight / 2 - pos.y * transform.k)
      .scale(transform.k);
    svgSel.transition().duration(650).call(zoomBehavior.current.transform, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Selection highlights connections and immediate neighbors only — nothing
  // in the graph ever fades or disappears. Hover behaves the same way.
  const selectedNeighborIds = useMemo(() => {
    if (!selectedId) return null;
    const node = graph.nodes[selectedId];
    if (!node) return null;
    return new Set([
      ...node.parentIds,
      ...node.childIds,
      ...node.prerequisiteIds,
      ...node.unlocksIds,
      ...node.relatedIds,
      ...node.crossDisciplineIds,
    ]);
  }, [selectedId, graph]);

  const hoveredNeighborIds = useMemo(() => {
    if (!hoveredId || hoveredId === selectedId) return null;
    const node = graph.nodes[hoveredId];
    if (!node) return null;
    return new Set([
      ...node.parentIds,
      ...node.childIds,
      ...node.prerequisiteIds,
      ...node.unlocksIds,
      ...node.relatedIds,
      ...node.crossDisciplineIds,
    ]);
  }, [hoveredId, selectedId, graph]);

  const handleHoverStart = useCallback((id: string) => setHoveredId(id), []);
  const handleHoverEnd = useCallback(() => setHoveredId(null), []);

  return (
    <svg ref={svgRef} className="h-full w-full cursor-grab select-none active:cursor-grabbing">
      <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
        {/* Connections — thin, curved, low-opacity by default; brighten only when touching the selected or hovered node. */}
        <g>
          {graph.edges.map((edge) => {
            const source = positionById.get(edge.sourceId);
            const target = positionById.get(edge.targetId);
            if (!source || !target) return null;

            const touchesSelected = Boolean(
              edge.sourceId === selectedId ||
                edge.targetId === selectedId ||
                (selectedNeighborIds && selectedNeighborIds.has(edge.sourceId) && selectedNeighborIds.has(edge.targetId))
            );
            const touchesHover = Boolean(
              !touchesSelected &&
                (edge.sourceId === hoveredId ||
                  edge.targetId === hoveredId ||
                  (hoveredNeighborIds && hoveredNeighborIds.has(edge.sourceId) && hoveredNeighborIds.has(edge.targetId)))
            );

            return (
              <GraphEdge
                key={edge.id}
                edgeId={edge.id}
                source={source}
                target={target}
                touchesSelected={touchesSelected}
                touchesHover={touchesHover}
              />
            );
          })}
        </g>

        {/* Ambient particles traveling outward from the root, layer by layer. */}
        <KnowledgeFlowLayer graph={graph} positionById={positionById} />

        {/* Nodes — always fully visible, labels always shown. Selection and hover communicate through glow, not opacity. */}
        <g>
          {positioned.map((p) => {
            const renderPos = getRenderPosition(p);
            return (
              <GraphNode
                key={p.node.id}
                node={p.node}
                x={renderPos.x}
                y={renderPos.y}
                depth={p.depth}
                color={depthColor(p.depth)}
                isSelected={p.node.id === selectedId}
                isHovered={p.node.id === hoveredId}
                isSelectedNeighbor={Boolean(selectedNeighborIds?.has(p.node.id))}
                isHoveredNeighbor={Boolean(hoveredNeighborIds?.has(p.node.id))}
                isEntering={enteringIds.has(p.node.id)}
                onSelect={onSelect}
                onHoverStart={handleHoverStart}
                onHoverEnd={handleHoverEnd}
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
}
