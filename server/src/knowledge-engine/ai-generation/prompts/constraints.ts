import { renderRelationshipTypeGuide } from "./relationshipTypes.js";

export function renderConstraints(): string {
  return `NAMING: Title Case, concise (2-6 words), the real established term — not a paraphrase or sentence. Never invent a plausible-sounding but non-real term. Summary = 1 sentence. Description = 2-4 sentences. Neutral, textbook register — never first/second person, never hype or rhetorical questions.

AVOID (disqualifying): brainstorm-style loose association; buzzwords/marketing language; concepts that don't clearly belong under their stated parent; tiny padding nodes; duplicates or near-duplicates under different names (e.g. "Neural Nets" vs "Neural Networks"); random keyword clouds.

EDGES: parent/child is automatic from parentTempId — never emit that as an edge. Only emit OTHER relationships that add real insight:
${renderRelationshipTypeGuide()}
Use a modest number of genuinely useful cross-links, not one per possible pair. Every edge needs a specific one-sentence reason — never a generic one like "these are related."

OUTPUT: one JSON object, no markdown fences, no leading/trailing text. Every tempId is a short unique lowercase slug. Every parentTempId/sourceTempId/targetTempId must reference a tempId in your nodes list. importance is 0-1: root = 1, rest by genuine centrality, not depth alone.`;
}
