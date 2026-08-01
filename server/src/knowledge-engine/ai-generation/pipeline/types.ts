/**
 * Pipeline stage types.
 *
 * The conceptual pipeline is:
 *   Topic -> Planning -> Hierarchy Design -> Node Metadata -> Edge Generation
 *         -> Validation -> Merge
 *
 * Planning (plan.ts) is pure, deterministic, no-AI logic that decides HOW
 * MUCH structure to ask for. Hierarchy Design + Node Metadata + Edge
 * Generation are today issued as a single Groq call (request.ts) because
 * splitting them into three round-trips would multiply latency and cost
 * for no quality gain at Axium's current scale — but they are three
 * distinct instruction blocks within that one prompt (see prompts/), and
 * `request.ts` is written so a future version could turn any of them into
 * its own call without touching Planning, Validation, or Merge. Validation
 * (validate.ts) and Merge (merge.ts) are each their own module already.
 */

/** Decided once per request, before any model call — governs prompt shape and validation bounds. */
export interface GenerationPlan {
  mode: "construct" | "expand";
  topic: string;
  /** Target tree depth for a fresh construction. Not used in expand mode (always exactly one layer). */
  targetDepth: number;
  /** [min, max] children suggested per branch at the level currently being generated. */
  breadth: [number, number];
  /** [min, max] total node count considered a healthy result. */
  nodeCountRange: [number, number];
  temperature: number;
}

/** One node as the model describes it, before ids are minted or it's merged into a real graph. */
export interface RawAINode {
  tempId: string;
  title: string;
  nodeType: string;
  summary: string;
  description: string;
  importance: number;
  aliases: string[];
}

/** A construction-mode node additionally carries its own parent reference (expansion nodes' parent is implied externally). */
export interface RawAIConstructionNode extends RawAINode {
  parentTempId: string | null;
}

export interface RawAIEdge {
  sourceTempId: string;
  targetTempId: string;
  type: string;
  explanation: string;
  weight: number;
}

/** The validated, structurally-sound shape returned by the AI for a fresh construction, before materialization into a KnowledgeGraph. */
export interface RawAIGraph {
  rootTempId: string;
  nodes: RawAIConstructionNode[];
  edges: RawAIEdge[];
}

/** The validated, structurally-sound shape returned by the AI for an expansion — all nodes are direct children of the focus concept. */
export interface RawAIExpansion {
  nodes: RawAINode[];
  edges: RawAIEdge[];
}

/** Context passed to the expansion prompt so the model stays consistent with what already exists. */
export interface ExpansionContext {
  topic: string;
  focusTitle: string;
  focusSummary: string;
  focusCategory: string;
  focusDepth: number;
  parentTitle: string | null;
  siblingTitles: string[];
  existingDescendantTitles: string[];
  otherBranchTitles: string[];
}
