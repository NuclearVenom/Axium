/**
 * Relationship types the model is allowed to emit as explicit edges.
 * "containment" and "specialization" (parent/child) are deliberately
 * excluded — those are derived automatically from each node's parentTempId,
 * never requested from the model, so there is exactly one way a tree edge
 * can enter the graph and no way for the model to contradict its own tree.
 */
export const PROMPT_RELATIONSHIP_TYPES = [
  "prerequisite",
  "generalization",
  "mathematical_dependency",
  "implementation",
  "application",
  "historical_influence",
  "comparison",
  "alternative",
  "supporting",
  "frequently_confused",
] as const;

export type PromptRelationshipType = (typeof PROMPT_RELATIONSHIP_TYPES)[number];

export const RELATIONSHIP_TYPE_GUIDE: Record<PromptRelationshipType, string> = {
  prerequisite: "target needs source first (use sparingly)",
  generalization: "source is a more general case of target (rare)",
  mathematical_dependency: "target's math is built on source's",
  implementation: "target is a concrete implementation of source",
  application: "target is a real-world application of source",
  historical_influence: "source historically influenced/led to target",
  comparison: "commonly compared or contrasted",
  alternative: "competing approaches to the same problem",
  supporting: "target provides background for source",
  frequently_confused: "learners commonly confuse these two",
};

export function renderRelationshipTypeGuide(): string {
  return PROMPT_RELATIONSHIP_TYPES.map((t) => `- ${t}: ${RELATIONSHIP_TYPE_GUIDE[t]}`).join("\n");
}
