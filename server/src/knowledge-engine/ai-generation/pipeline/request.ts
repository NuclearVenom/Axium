import { callGroq, GroqMessage } from "../../../integrations/groqClient.js";
import { AIConstructionGraphSchema, AIExpansionGraphSchema } from "../schema.js";
import { appendRetryTurn, buildConstructionMessages, buildExpansionMessages } from "../prompts/index.js";
import { validateConstruction, validateExpansion } from "./validate.js";
import { ExpansionContext, GenerationPlan, RawAIExpansion, RawAIGraph } from "./types.js";

export class GraphGenerationError extends Error {}

// The account's TPM ceiling for this model rejects any single request whose
// (prompt tokens + this budget) exceeds ~8000. Construction's system prompt
// + few-shot example runs ~1.6-1.8k tokens, so 5000 leaves comfortable
// headroom; expansion's prompt is smaller still, so 2200 is generous for
// the handful of children a single expansion ever produces.
const MAX_TOKENS_CONSTRUCTION = 5000;
const MAX_TOKENS_EXPANSION = 2200;

/** Strips accidental markdown code fences — some models wrap JSON in ```json even in JSON mode under load. */
function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

// This account's model tier rejects any single request whose (prompt +
// requested completion) tokens exceed ~8000. Rather than trusting that the
// prompt modules stay small forever, every call clamps its requested
// completion budget to whatever headroom is actually left — so a future
// prompt edit that grows the prompt degrades gracefully (a smaller but
// still valid graph) instead of resurfacing this exact 413.
const SAFE_TOTAL_TOKEN_CEILING = 7600;
const MIN_COMPLETION_TOKENS = 800;

function estimateTokensFromChars(chars: number): number {
  // Deliberately conservative (chars/4 tends to slightly overestimate real
  // token counts for this kind of prose+JSON mix — better to under-request
  // completion budget than to risk another 413).
  return Math.ceil(chars / 4);
}

function clampCompletionBudget(messages: GroqMessage[], requestedMaxTokens: number): number {
  const promptChars = messages.reduce((sum, m) => sum + (typeof m.content === "string" ? m.content.length : JSON.stringify(m.content).length), 0);
  const estimatedPromptTokens = estimateTokensFromChars(promptChars);
  const available = SAFE_TOTAL_TOKEN_CEILING - estimatedPromptTokens;
  const clamped = Math.max(MIN_COMPLETION_TOKENS, Math.min(requestedMaxTokens, available));
  if (clamped < requestedMaxTokens) {
    console.warn(
      `[ai-generation] Prompt grew larger than expected (~${estimatedPromptTokens} tokens) — clamping completion budget from ${requestedMaxTokens} to ${clamped} to stay under the account's request ceiling.`
    );
  }
  return clamped;
}

async function callAndParse<T>(messages: GroqMessage[], schema: { parse: (v: unknown) => T }, temperature: number, maxTokens: number) {
  const safeMaxTokens = clampCompletionBudget(messages, maxTokens);
  const raw = await callGroq(messages, { temperature, maxTokens: safeMaxTokens, jsonMode: true, retries: 2 });
  let json: unknown;
  try {
    json = JSON.parse(stripFences(raw));
  } catch {
    return { raw, error: "Response was not valid JSON." as string, parsed: null };
  }
  try {
    return { raw, error: null, parsed: schema.parse(json) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Response did not match the required schema.";
    return { raw, error: message, parsed: null };
  }
}

/**
 * Requests a full construction graph. Hierarchy Design + Node Metadata +
 * Edge Generation happen in this one Groq call today (see pipeline/types.ts
 * for why); this function is what a future split would change first.
 */
export async function requestConstructionGraph(plan: GenerationPlan): Promise<RawAIGraph> {
  const messages = buildConstructionMessages(plan);

  const first = await callAndParse(messages, AIConstructionGraphSchema, plan.temperature, MAX_TOKENS_CONSTRUCTION);
  if (first.parsed) {
    const validated = validateConstruction(first.parsed, plan);
    if (validated.ok) return validated.value;
    return retryConstruction(messages, first.raw, validated.issues, plan);
  }
  return retryConstruction(messages, first.raw, [first.error ?? "Malformed response."], plan);
}

async function retryConstruction(
  originalMessages: GroqMessage[],
  invalidReply: string,
  issues: string[],
  plan: GenerationPlan
): Promise<RawAIGraph> {
  const retryMessages = appendRetryTurn(originalMessages, invalidReply, issues);
  const retry = await callAndParse(retryMessages, AIConstructionGraphSchema, Math.max(0.1, plan.temperature - 0.05), MAX_TOKENS_CONSTRUCTION);
  if (!retry.parsed) {
    throw new GraphGenerationError(
      `The AI could not produce a valid knowledge graph for "${plan.topic}" after a corrective retry: ${retry.error}`
    );
  }
  const validated = validateConstruction(retry.parsed, plan);
  if (!validated.ok) {
    throw new GraphGenerationError(
      `The AI's corrected knowledge graph for "${plan.topic}" was still invalid: ${validated.issues.join(" ")}`
    );
  }
  return validated.value;
}

export async function requestExpansionGraph(
  plan: GenerationPlan,
  ctx: ExpansionContext,
  existingTitlesNormalized: Set<string>
): Promise<RawAIExpansion> {
  const messages = buildExpansionMessages(plan, ctx);

  const first = await callAndParse(messages, AIExpansionGraphSchema, plan.temperature, MAX_TOKENS_EXPANSION);
  if (first.parsed) {
    const validated = validateExpansion(first.parsed, plan, existingTitlesNormalized);
    if (validated.ok) return validated.value;
    return retryExpansion(messages, first.raw, validated.issues, plan, existingTitlesNormalized);
  }
  return retryExpansion(messages, first.raw, [first.error ?? "Malformed response."], plan, existingTitlesNormalized);
}

async function retryExpansion(
  originalMessages: GroqMessage[],
  invalidReply: string,
  issues: string[],
  plan: GenerationPlan,
  existingTitlesNormalized: Set<string>
): Promise<RawAIExpansion> {
  const retryMessages = appendRetryTurn(originalMessages, invalidReply, issues);
  const retry = await callAndParse(retryMessages, AIExpansionGraphSchema, Math.max(0.1, plan.temperature - 0.05), MAX_TOKENS_EXPANSION);
  if (!retry.parsed) {
    throw new GraphGenerationError(`The AI could not expand "${ctxTopicSafe(plan)}" after a corrective retry: ${retry.error}`);
  }
  const validated = validateExpansion(retry.parsed, plan, existingTitlesNormalized);
  if (!validated.ok) {
    throw new GraphGenerationError(`The AI's corrected expansion was still invalid: ${validated.issues.join(" ")}`);
  }
  return validated.value;
}

function ctxTopicSafe(plan: GenerationPlan): string {
  return plan.topic;
}
