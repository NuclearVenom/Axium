/**
 * Ad-hoc verification script — not part of the app. Run with:
 *   npm run verify   (from server/)
 *
 * This sandbox's network allowlist blocks api.groq.com, so this exercises
 * everything downstream of a model response instead: strict schema
 * validation, structural validation (duplicates, dangling references,
 * unreachable/cyclic nodes), materialization into a real KnowledgeGraph,
 * expansion merging, the AI-response cache, and the Groq client's
 * multi-key discovery/fallback/retry behavior (with fetch mocked rather
 * than hitting the real API) — all against realistic fixture data
 * standing in for what the model would return.
 */
import { AIConstructionGraphSchema, AIExpansionGraphSchema } from "../src/knowledge-engine/ai-generation/schema.js";
import { validateConstruction, validateExpansion } from "../src/knowledge-engine/ai-generation/pipeline/validate.js";
import { materializeConstruction, mergeExpansion } from "../src/knowledge-engine/ai-generation/pipeline/merge.js";
import { buildConstructionPlan, buildExpansionPlan } from "../src/knowledge-engine/ai-generation/pipeline/plan.js";
import {
  constructionCacheKey,
  expansionCacheKey,
  getCachedConstruction,
  setCachedConstruction,
} from "../src/knowledge-engine/ai-generation/aiCache.js";
import { RawAIExpansion } from "../src/knowledge-engine/ai-generation/pipeline/types.js";

let passed = 0;
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  passed++;
  console.log(`  ok — ${message}`);
}

// ============================================================
console.log("\n[1] Schema — a well-formed construction response parses cleanly");
// ============================================================
const validConstructionFixture = {
  rootTempId: "calculus",
  nodes: [
    { tempId: "calculus", title: "Calculus", nodeType: "field", summary: "The study of continuous change.", description: "Calculus studies rates of change and accumulation through derivatives and integrals.", parentTempId: null, importance: 1, aliases: [] },
    { tempId: "differential-calculus", title: "Differential Calculus", nodeType: "field", summary: "The study of rates of change.", description: "Differential calculus concerns the derivative, measuring how a function's output changes as its input changes.", parentTempId: "calculus", importance: 0.9, aliases: [] },
    { tempId: "integral-calculus", title: "Integral Calculus", nodeType: "field", summary: "The study of accumulation.", description: "Integral calculus concerns the integral, measuring the accumulation of quantities such as areas under curves.", parentTempId: "calculus", importance: 0.9, aliases: [] },
    { tempId: "derivative", title: "Derivative", nodeType: "concept", summary: "The instantaneous rate of change of a function.", description: "The derivative measures how a function's value changes as its input changes, geometrically the slope of the tangent line.", parentTempId: "differential-calculus", importance: 0.7, aliases: [] },
    { tempId: "integral", title: "Integral", nodeType: "concept", summary: "The accumulated value of a function over an interval.", description: "The integral computes the signed area between a function's graph and the x-axis over an interval.", parentTempId: "integral-calculus", importance: 0.7, aliases: [] },
  ],
  edges: [
    { sourceTempId: "derivative", targetTempId: "integral", type: "generalization", explanation: "Integration is the formal inverse operation of differentiation.", weight: 0.8 },
  ],
};
const parsedConstruction = AIConstructionGraphSchema.parse(validConstructionFixture);
assert(parsedConstruction.nodes.length === 5, "schema accepts the well-formed fixture");

// ============================================================
console.log("\n[2] Structural validation — catches duplicate titles, dangling parents, and cycles");
// ============================================================
const plan = buildConstructionPlan("Calculus");

const dupTitles = JSON.parse(JSON.stringify(validConstructionFixture));
dupTitles.nodes[2].title = "Differential Calculus"; // duplicate of nodes[1]
const dupResult = validateConstruction(AIConstructionGraphSchema.parse(dupTitles), plan);
assert(!dupResult.ok && dupResult.issues.some((i) => i.includes("used by")), "duplicate titles are rejected");

const danglingParent = JSON.parse(JSON.stringify(validConstructionFixture));
danglingParent.nodes[3].parentTempId = "does-not-exist";
const danglingResult = validateConstruction(AIConstructionGraphSchema.parse(danglingParent), plan);
assert(!danglingResult.ok && danglingResult.issues.some((i) => i.includes("does not exist")), "a dangling parentTempId is rejected");

const twoRoots = JSON.parse(JSON.stringify(validConstructionFixture));
twoRoots.nodes[1].parentTempId = null;
const twoRootsResult = validateConstruction(AIConstructionGraphSchema.parse(twoRoots), plan);
assert(!twoRootsResult.ok && twoRootsResult.issues.some((i) => i.includes("Exactly one node")), "more than one root is rejected");

const cyclic = JSON.parse(JSON.stringify(validConstructionFixture));
cyclic.nodes[0].parentTempId = "derivative"; // root now points into its own descendant
const cyclicResult = validateConstruction(AIConstructionGraphSchema.parse(cyclic), plan);
assert(!cyclicResult.ok, "a cycle involving the root is rejected");

const validResult = validateConstruction(parsedConstruction, plan);
assert(validResult.ok, "the well-formed fixture passes structural validation cleanly");

// ============================================================
console.log("\n[3] Materialization — deterministic construction from validated AI output");
// ============================================================
if (!validResult.ok) throw new Error("unreachable");
const graph = materializeConstruction("Calculus", validResult.value);
assert(graph.rootConceptId === "calculus", "root id is the slugified root title");
assert(graph.nodeCount === 5, "final graph has 5 nodes");
assert(graph.nodes["differential-calculus"].category === "Differential Calculus", "a depth-1 node is its own category");
assert(graph.nodes["derivative"].category === "Differential Calculus", "category propagates down from the depth-1 ancestor");
assert(graph.nodes["calculus"].childIds.includes("differential-calculus"), "containment edges link parent to child");
assert(graph.nodes["differential-calculus"].parentIds.includes("calculus"), "containment edges link child back to parent");
assert(graph.depth === 2, `computed depth is 2 (got ${graph.depth})`);
assert(
  graph.nodes["derivative"].relatedIds.includes("integral") ||
    graph.nodes["derivative"].unlocksIds.includes("integral") ||
    graph.nodes["integral"].unlocksIds.includes("derivative"),
  "the AI-provided non-containment edge is linked"
);
assert(graph.nodes["derivative"].isFoundational === true, "a childless depth-2+ node is marked foundational");
assert(graph.nodes["calculus"].isFoundational === false, "the root is never foundational");

const graph2 = materializeConstruction("Calculus", validResult.value);
const fingerprint = (g: typeof graph) => ({
  nodeIds: Object.keys(g.nodes).sort(),
  edgeTuples: g.edges.map((e) => `${e.sourceId}->${e.targetId}:${e.type}`).sort(),
});
assert(JSON.stringify(fingerprint(graph)) === JSON.stringify(fingerprint(graph2)), "identical validated input produces an identical materialized graph");

// ============================================================
console.log("\n[4] Expansion — validation rejects duplicates, merge only appends");
// ============================================================
const expansionPlan = buildExpansionPlan("Calculus", 3);
const existingTitles = new Set(Object.values(graph.nodes).map((n) => n.title.toLowerCase()));

const expansionFixture = {
  nodes: [
    { tempId: "power-rule", title: "Power Rule", nodeType: "technique", summary: "A shortcut for differentiating polynomial terms.", description: "The power rule states that the derivative of x^n is n*x^(n-1), avoiding the need for the limit definition on simple polynomial terms.", importance: 0.6, aliases: [] },
    { tempId: "chain-rule", title: "Chain Rule", nodeType: "technique", summary: "A rule for differentiating composite functions.", description: "The chain rule expresses the derivative of a composite function in terms of the derivatives of its parts.", importance: 0.65, aliases: [] },
  ],
  edges: [],
};
const parsedExpansion = AIExpansionGraphSchema.parse(expansionFixture);
const expansionValidation = validateExpansion(parsedExpansion, expansionPlan, existingTitles);
assert(expansionValidation.ok, "a genuinely new set of children passes expansion validation");

const dupExpansion = JSON.parse(JSON.stringify(expansionFixture));
dupExpansion.nodes[0].title = "Derivative"; // already exists in the graph
const dupExpansionValidation = validateExpansion(AIExpansionGraphSchema.parse(dupExpansion), expansionPlan, existingTitles);
assert(!dupExpansionValidation.ok, "a child duplicating an existing graph-wide title is rejected");

if (!expansionValidation.ok) throw new Error("unreachable");
const beforeNodeCount = graph.nodeCount;
const beforeRootUpdatedAt = graph.nodes["calculus"].updatedAt;
const expanded = mergeExpansion(graph, "derivative", expansionValidation.value as RawAIExpansion);
assert(expanded.nodeCount === beforeNodeCount + 2, "merge appends exactly the new nodes, nothing more");
assert(expanded.nodes["calculus"].updatedAt === beforeRootUpdatedAt, "untouched existing nodes are never rewritten");
assert(expanded.nodes["derivative"].childIds.length === 2, "the focus node gains the new children");
assert(expanded.nodes["derivative"].isFoundational === false, "an expanded node is no longer foundational");
assert(
  Object.values(expanded.nodes).find((n) => n.title === "Power Rule")?.category === "Differential Calculus",
  "expanded children inherit the focus node's category"
);

// ============================================================
console.log("\n[5] AI response cache — round-trips through the filesystem");
// ============================================================
await setCachedConstruction("__verify_pipeline_fixture__", validResult.value);
const cached = await getCachedConstruction("__verify_pipeline_fixture__");
assert(cached !== null && cached.rootTempId === validResult.value.rootTempId, "a cached construction response round-trips correctly");
assert(constructionCacheKey("Calculus") === constructionCacheKey("  calculus  "), "construction cache keys normalize whitespace/casing");
assert(
  expansionCacheKey("Calculus", "Differential Calculus", "Derivative") === expansionCacheKey("calculus", "differential calculus", "derivative"),
  "expansion cache keys are case-insensitive"
);

console.log(`\nAll ${passed} checks passed.\n`);

// ============================================================
console.log("[6] Groq client — multi-key discovery, fallback, and sticky preference");
// ============================================================
{
  const realFetch = globalThis.fetch;
  let callLog: string[] = [];
  const mockFetch = (behavior: (key: string, attemptsForKey: number) => Response) => {
    globalThis.fetch = (async (_url: unknown, init: any) => {
      const key = (init.headers.Authorization as string).replace("Bearer ", "");
      callLog.push(key);
      const attemptsForKey = callLog.filter((k) => k === key).length;
      return behavior(key, attemptsForKey);
    }) as typeof fetch;
  };

  // Each scenario needs a fresh module instance, since groqClient caches
  // its discovered keys at module scope on first use — the cache-busting
  // query string forces Node to re-evaluate the module with the env vars
  // current at that point.
  let v = 0;
  const freshGroqClient = () => import(`../src/integrations/groqClient.js?verify=${v++}`);

  // Key rotation on a rate-limited key, then sticky preference on the next call.
  process.env.GROQ_API_KEY_1 = "verify-key1-rate-limited";
  process.env.GROQ_API_KEY_2 = "verify-key2-good";
  callLog = [];
  mockFetch((key) => {
    if (key === "verify-key1-rate-limited") return new Response("{}", { status: 429 });
    return new Response(JSON.stringify({ choices: [{ message: { content: `from-${key}` } }] }), { status: 200 });
  });
  const rotationClient = await freshGroqClient();
  const rotated = await rotationClient.callGroq([{ role: "user", content: "x" }]);
  assert(rotated === "from-verify-key2-good", "a rate-limited key (429) falls back to the next configured key");
  assert(callLog.join(",") === "verify-key1-rate-limited,verify-key2-good", "the failed key is tried before the fallback, in order");

  callLog = [];
  const sticky = await rotationClient.callGroq([{ role: "user", content: "x" }]);
  assert(sticky === "from-verify-key2-good", "the next call still succeeds via the same fallback key");
  assert(callLog.length === 1 && callLog[0] === "verify-key2-good", "the previously-successful key is preferred first — no wasted attempt on the still-bad key");

  // No keys configured at all.
  delete process.env.GROQ_API_KEY_1;
  delete process.env.GROQ_API_KEY_2;
  const unconfiguredClient = await freshGroqClient();
  try {
    await unconfiguredClient.callGroq([{ role: "user", content: "x" }]);
    assert(false, "calling with no keys configured should throw");
  } catch (err) {
    assert(err instanceof unconfiguredClient.GroqConfigError, "no keys configured raises GroqConfigError specifically");
  }

  // Every configured key fails — should surface an error after trying each exactly once (retries: 0).
  process.env.GROQ_API_KEY_1 = "verify-always-bad-1";
  process.env.GROQ_API_KEY_2 = "verify-always-bad-2";
  callLog = [];
  mockFetch(() => new Response("nope", { status: 401 }));
  const allBadClient = await freshGroqClient();
  try {
    await allBadClient.callGroq([{ role: "user", content: "x" }], { retries: 0 });
    assert(false, "should throw once every configured key has failed");
  } catch {
    assert(callLog.length === 2, `every configured key is tried exactly once before giving up (got ${callLog.length})`);
  }

  // A transient failure (500) retries the SAME key before rotating — not every failure should burn through keys.
  delete process.env.GROQ_API_KEY_2;
  process.env.GROQ_API_KEY_1 = "verify-transient";
  callLog = [];
  mockFetch((_key, attemptsForKey) =>
    attemptsForKey === 1
      ? new Response("hiccup", { status: 500 })
      : new Response(JSON.stringify({ choices: [{ message: { content: "recovered" } }] }), { status: 200 })
  );
  const transientClient = await freshGroqClient();
  const recovered = await transientClient.callGroq([{ role: "user", content: "x" }], { retries: 2 });
  assert(recovered === "recovered", "a transient (500) failure recovers on retry");
  assert(callLog.length === 2 && callLog.every((k) => k === "verify-transient"), "a transient failure retries the SAME key rather than immediately rotating");

  globalThis.fetch = realFetch;
  delete process.env.GROQ_API_KEY_1;
  delete process.env.GROQ_API_KEY_2;
}

console.log(`\nAll ${passed} checks passed.\n`);
