import { GenerationPlan } from "./types.js";

/**
 * Planning stage. Deliberately AI-free: the same topic (or the same
 * expansion depth) always produces the same plan, which is half of what
 * keeps output deterministic — the model is given the same structural
 * budget every time rather than guessing its own scope.
 */

// Kept modest deliberately: a single Groq request (prompt + completion) must
// stay comfortably under this account's ~8000 token-per-request ceiling.
// A 3-level initial tree with Expand Further available for anything deeper
// fits that budget reliably; the original 4-level/90-node target did not.
const CONSTRUCTION_DEPTH = 3;
const CONSTRUCTION_BREADTH: [number, number] = [4, 7];
const CONSTRUCTION_NODE_RANGE: [number, number] = [18, 36];
const CONSTRUCTION_TEMPERATURE = 0.2;

const EXPANSION_TEMPERATURE = 0.25;

export function buildConstructionPlan(topic: string): GenerationPlan {
  return {
    mode: "construct",
    topic: topic.trim(),
    targetDepth: CONSTRUCTION_DEPTH,
    breadth: CONSTRUCTION_BREADTH,
    nodeCountRange: CONSTRUCTION_NODE_RANGE,
    temperature: CONSTRUCTION_TEMPERATURE,
  };
}

/**
 * Breadth narrows as depth increases — chapters split into many sections,
 * but a single formula rarely has more than a few real sub-parts. Depth
 * here is the DEPTH OF THE NEW CHILDREN being generated (focusDepth + 1).
 */
export function breadthForExpansionDepth(childDepth: number): [number, number] {
  if (childDepth <= 2) return [5, 10];
  if (childDepth === 3) return [4, 8];
  if (childDepth === 4) return [3, 6];
  return [2, 5];
}

export function buildExpansionPlan(topic: string, childDepth: number): GenerationPlan {
  const breadth = breadthForExpansionDepth(childDepth);
  return {
    mode: "expand",
    topic: topic.trim(),
    targetDepth: childDepth,
    breadth,
    nodeCountRange: breadth,
    temperature: EXPANSION_TEMPERATURE,
  };
}
