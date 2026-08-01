import { GenerationPlan } from "../pipeline/types.js";

/** The "Hierarchy Design" instruction block for a fresh construction. */
export function renderConstructionHierarchyRules(plan: GenerationPlan): string {
  const [minB, maxB] = plan.breadth;
  const [minN, maxN] = plan.nodeCountRange;
  return `HIERARCHY RULES:
- Build a tree ${plan.targetDepth} levels deep below the root (root = depth 0). Some branches can bottom out earlier if the subject doesn't need that much depth there.
- Every non-root node has exactly one parentTempId.
- Give each parent ${minB}-${maxB} children per level. Fewer usually means under-decomposed; more usually means merge or split further.
- Go broad before deep: depth 1 should fully cover the subject's major branches before any one branch goes disproportionately deep.
- Target ${minN}-${maxN} total nodes, reflecting real structure, not padding to hit a number.
- Order children the way a textbook would: foundational before derived, simple before complex, ties broken alphabetically. This ordering must be the same every time this topic is generated.
- A depth-1 node's title IS the category for everything beneath it — do not add a separate category field.
- Never create a node that only exists to hold one child.`;
}

/** The "Hierarchy Design" instruction block for expanding one existing node by a single layer. */
export function renderExpansionHierarchyRules(plan: GenerationPlan): string {
  const [minB, maxB] = plan.breadth;
  return `HIERARCHY RULES for this expansion:
- Generate ONLY direct children of the focus concept — one new layer, no grandchildren.
- Produce ${minB}-${maxB} children unless the concept genuinely has fewer/more real, named sub-parts.
- Children must be real, named, textbook-recognizable subdivisions — not filler, not restatements, not topics that belong under a sibling instead.
- Order: foundational before derived, simple before complex, ties alphabetical.
- Category is inherited automatically from the focus concept — do not invent a new one.`;
}
