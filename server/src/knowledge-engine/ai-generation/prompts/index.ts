import { GroqMessage } from "../../../integrations/groqClient.js";
import { GenerationPlan, ExpansionContext } from "../pipeline/types.js";
import { renderBasePrompt } from "./base.js";
import { renderConstructionHierarchyRules, renderExpansionHierarchyRules } from "./hierarchy.js";
import { renderConstraints } from "./constraints.js";
import { renderIllustrativeExamples } from "./examples.js";
import { renderConstructionOutputFormat, renderExpansionOutputFormat } from "./outputFormat.js";
import { constructionFewShot } from "./fewShot.js";
import { renderExpansionContext, renderExpansionInstruction } from "./expansion.js";
import { renderValidationFeedback } from "./validationFeedback.js";

/** Full construction: builds an entire fresh graph for a new topic. */
export function buildConstructionMessages(plan: GenerationPlan): GroqMessage[] {
  const system = [
    renderBasePrompt(),
    renderConstructionHierarchyRules(plan),
    renderConstraints(),
    renderIllustrativeExamples(),
    renderConstructionOutputFormat(),
  ].join("\n\n");

  return [
    { role: "system", content: system },
    ...constructionFewShot(),
    { role: "user", content: `Generate the full knowledge graph for topic: "${plan.topic}".` },
  ];
}

/** Expansion: generates only the next layer beneath one existing node. */
export function buildExpansionMessages(plan: GenerationPlan, ctx: ExpansionContext): GroqMessage[] {
  const system = [
    renderBasePrompt(),
    renderExpansionHierarchyRules(plan),
    renderConstraints(),
    renderExpansionOutputFormat(),
  ].join("\n\n");

  const user = [renderExpansionContext(ctx), "", renderExpansionInstruction()].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

const MAX_INVALID_REPLY_CHARS = 3000;

/** Appends the model's invalid reply plus corrective feedback, for the single allowed retry. */
export function appendRetryTurn(messages: GroqMessage[], invalidReply: string, issues: string[]): GroqMessage[] {
  const truncated =
    invalidReply.length > MAX_INVALID_REPLY_CHARS
      ? `${invalidReply.slice(0, MAX_INVALID_REPLY_CHARS)}\n... [truncated — your reply was too long; keep the corrected version within the requested node-count budget]`
      : invalidReply;

  return [
    ...messages,
    { role: "assistant", content: truncated },
    { role: "user", content: renderValidationFeedback(issues) },
  ];
}
