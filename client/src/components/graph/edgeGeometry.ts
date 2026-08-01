export interface Point {
  x: number;
  y: number;
}

/**
 * A gentle quadratic control point, offset perpendicular to the straight
 * line between two points. The offset is proportional to distance (capped)
 * so short edges stay nearly straight and long edges get a soft arc —
 * this is what gives the graph its "connected network" feel rather than a
 * grid of dead-straight spokes.
 */
export function curveControlPoint(p0: Point, p1: Point, bend = 0.14): Point {
  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  // perpendicular unit vector
  const nx = -dy / dist;
  const ny = dx / dist;
  const offset = Math.min(dist * bend, 90);
  return { x: mx + nx * offset, y: my + ny * offset };
}

export function curvePathD(p0: Point, p1: Point, bend = 0.14): string {
  const c = curveControlPoint(p0, p1, bend);
  return `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p1.x} ${p1.y}`;
}

/** Point at parameter t (0..1) along the same quadratic curve used for rendering. */
export function bezierPointAt(p0: Point, p1: Point, t: number, bend = 0.14): Point {
  const c = curveControlPoint(p0, p1, bend);
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
  };
}
