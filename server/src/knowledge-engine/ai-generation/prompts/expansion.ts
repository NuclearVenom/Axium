import { ExpansionContext } from "../pipeline/types.js";

const MAX_OTHER_BRANCH_TITLES = 60;
const MAX_DESCENDANT_TITLES = 80;

/**
 * Renders everything the model needs to know about the EXISTING graph so
 * expansion never duplicates a concept that already exists somewhere else
 * in it, and stays coherent with what's already been built.
 */
export function renderExpansionContext(ctx: ExpansionContext): string {
  const lines = [
    `Original search topic: "${ctx.topic}"`,
    `Focus concept to expand: "${ctx.focusTitle}" (category: ${ctx.focusCategory}, depth ${ctx.focusDepth})`,
    `Focus concept's own summary: ${ctx.focusSummary}`,
    ctx.parentTitle ? `Focus concept's parent: "${ctx.parentTitle}"` : "Focus concept is the root of the graph.",
  ];

  if (ctx.siblingTitles.length > 0) {
    lines.push(`Sibling concepts (already exist alongside the focus concept, do not recreate): ${ctx.siblingTitles.join(", ")}`);
  }
  if (ctx.existingDescendantTitles.length > 0) {
    lines.push(
      `Concepts that already exist beneath the focus concept from earlier expansions (do not recreate these — you are adding MORE children alongside them): ${ctx.existingDescendantTitles
        .slice(0, MAX_DESCENDANT_TITLES)
        .join(", ")}`
    );
  }
  if (ctx.otherBranchTitles.length > 0) {
    lines.push(
      `Concepts that already exist elsewhere in the wider graph (avoid recreating any of these under the focus concept instead): ${ctx.otherBranchTitles
        .slice(0, MAX_OTHER_BRANCH_TITLES)
        .join(", ")}`
    );
  }

  return lines.join("\n");
}

export function renderExpansionInstruction(): string {
  return `Generate the next layer of the knowledge graph: the direct children of the focus concept above, and only those. Do not restate the focus concept itself as a node. Do not recreate anything listed as already existing above — if every real child of this concept already exists, return as few new nodes as genuinely justified rather than inventing filler.`;
}
