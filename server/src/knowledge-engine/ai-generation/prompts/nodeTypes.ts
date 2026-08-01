/**
 * The semantic node-type taxonomy, defined once and consumed by both the
 * Zod schema (ai-generation/schema.ts) and the prompt text (base.ts) so the
 * two can never drift apart. Add a new type here and it is simultaneously
 * a valid schema value and documented to the model.
 */
export const NODE_TYPES = [
  "domain",
  "field",
  "paradigm",
  "theory",
  "concept",
  "algorithm",
  "method",
  "technique",
  "formula",
  "metric",
  "tool",
  "framework",
  "library",
  "application",
  "person",
  "dataset",
  "research_area",
] as const;

export type PromptNodeType = (typeof NODE_TYPES)[number];

export const NODE_TYPE_GUIDE: Record<PromptNodeType, string> = {
  domain: "an entire field of study (usually only the root)",
  field: "a major subfield/branch, e.g. Machine Learning",
  paradigm: "a school of thought, e.g. Functional Programming",
  theory: "a formalized theory, e.g. Information Theory",
  concept: "a general idea — the safe default",
  algorithm: "a named algorithm, e.g. Dijkstra's Algorithm",
  method: "a general method/approach, e.g. Gradient Descent",
  technique: "a narrower applied technique, e.g. Data Augmentation",
  formula: "a specific formula/equation, e.g. Bayes' Theorem",
  metric: "a measurement/score, e.g. F1 Score",
  tool: "a named tool, e.g. Git",
  framework: "a named framework, e.g. React",
  library: "a named software library, e.g. NumPy",
  application: "a real-world application or use case",
  person: "a specific notable individual, e.g. Alan Turing",
  dataset: "a named dataset, e.g. ImageNet",
  research_area: "an active, still-evolving research area",
};

export function renderNodeTypeGuide(): string {
  return NODE_TYPES.map((t) => `- ${t}: ${NODE_TYPE_GUIDE[t]}`).join("\n");
}
