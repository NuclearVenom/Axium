import { memo } from "react";
import { ConceptNode } from "../../types/graph";
import { getLabelStyle } from "./layout";

export interface GraphNodeProps {
  node: ConceptNode;
  x: number;
  y: number;
  depth: number;
  color: string;
  isSelected: boolean;
  isHovered: boolean;
  isSelectedNeighbor: boolean;
  isHoveredNeighbor: boolean;
  isEntering: boolean;
  onSelect: (id: string) => void;
  onHoverStart: (id: string) => void;
  onHoverEnd: () => void;
}

function GraphNodeComponent({
  node,
  x,
  y,
  depth,
  color,
  isSelected,
  isHovered,
  isSelectedNeighbor,
  isHoveredNeighbor,
  isEntering,
  onSelect,
  onHoverStart,
  onHoverEnd,
}: GraphNodeProps) {
  const baseRadius = depth === 0 ? 14 : Math.max(5, 11 - depth * 1.1);

  const glow = isSelected
    ? `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 1.5px rgba(255,255,255,0.4))`
    : isSelectedNeighbor || isHovered
    ? `drop-shadow(0 0 6px ${color})`
    : isHoveredNeighbor
    ? `drop-shadow(0 0 4px ${color})`
    : "none";

  const label = getLabelStyle(depth);
  // Labels always point outward, away from the root, rather than always to
  // the right — halves the chance of a label crossing back over the graph.
  const isLeft = x < 0;
  const labelX = isLeft ? -(baseRadius + 8) : baseRadius + 8;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onMouseEnter={() => onHoverStart(node.id)}
      onMouseLeave={onHoverEnd}
      onClick={() => onSelect(node.id)}
      className="cursor-pointer"
      style={{
        filter: glow,
        opacity: isEntering ? 0 : 1,
        transition: "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), filter 0.3s ease, opacity 0.4s ease",
      }}
    >
      {isSelected && (
        <>
          <circle className="selection-ring-pulse" r={baseRadius + 7} fill="none" stroke={color} strokeWidth={1.4} strokeOpacity={0.55} />
          <circle
            className="selection-ring-rotate"
            r={baseRadius + 11}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.5}
            strokeWidth={1}
            strokeDasharray="2.5 7"
          />
        </>
      )}

      <circle r={baseRadius} fill={color} />

      <text
        x={labelX}
        y={4}
        textAnchor={isLeft ? "end" : "start"}
        fontSize={label.fontSize}
        fontWeight={label.fontWeight}
        fillOpacity={label.opacity}
        fill="currentColor"
        className="pointer-events-none text-ink dark:text-ink"
        style={{ paintOrder: "stroke", stroke: "rgba(10,10,11,0.75)", strokeWidth: 3 }}
      >
        {node.title}
      </text>
    </g>
  );
}

function propsAreEqual(prev: GraphNodeProps, next: GraphNodeProps): boolean {
  return (
    prev.node === next.node &&
    prev.x === next.x &&
    prev.y === next.y &&
    prev.depth === next.depth &&
    prev.color === next.color &&
    prev.isSelected === next.isSelected &&
    prev.isHovered === next.isHovered &&
    prev.isSelectedNeighbor === next.isSelectedNeighbor &&
    prev.isHoveredNeighbor === next.isHoveredNeighbor &&
    prev.isEntering === next.isEntering
  );
}

export const GraphNode = memo(GraphNodeComponent, propsAreEqual);
