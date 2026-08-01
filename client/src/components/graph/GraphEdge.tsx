import { memo } from "react";
import { PositionedNode } from "../../types/graph";
import { curvePathD } from "./edgeGeometry";

const EDGE_COLOR_BASE = "rgba(255, 255, 255, 0.18)";
const EDGE_COLOR_HOVER = "rgba(255, 255, 255, 0.55)";
const EDGE_COLOR_SELECTED = "rgba(255, 255, 255, 0.95)";

export interface GraphEdgeProps {
  edgeId: string;
  source: PositionedNode;
  target: PositionedNode;
  touchesSelected: boolean;
  touchesHover: boolean;
}

function GraphEdgeComponent({ source, target, touchesSelected, touchesHover }: GraphEdgeProps) {
  const stroke = touchesSelected ? EDGE_COLOR_SELECTED : touchesHover ? EDGE_COLOR_HOVER : EDGE_COLOR_BASE;
  const width = touchesSelected ? 1.8 : touchesHover ? 1.3 : 1;

  return (
    <path
      d={curvePathD(source, target)}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      style={{ transition: "stroke 0.35s ease, stroke-width 0.35s ease" }}
    />
  );
}

function propsAreEqual(prev: GraphEdgeProps, next: GraphEdgeProps): boolean {
  return (
    prev.source.x === next.source.x &&
    prev.source.y === next.source.y &&
    prev.target.x === next.target.x &&
    prev.target.y === next.target.y &&
    prev.touchesSelected === next.touchesSelected &&
    prev.touchesHover === next.touchesHover
  );
}

export const GraphEdge = memo(GraphEdgeComponent, propsAreEqual);
