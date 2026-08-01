import { streamGroq, GroqMessage } from "../integrations/groqClient.js";
import { ConceptNode, KnowledgeGraph } from "../knowledge-engine/types.js";

/**
 * The AI Assistant is a tutor sitting beside the graph. It never invents
 * nodes or relationships, never decides what belongs in the graph, and
 * never becomes the source of truth. Its only inputs are: the currently
 * selected concept, its immediate graph context, and the user's question.
 */

export type TutorIntent =
  | "explain_simpler"
  | "explain_deeper"
  | "analogy"
  | "example"
  | "comparison"
  | "common_mistakes"
  | "quiz"
  | "flashcards"
  | "interview_questions"
  | "revision_summary"
  | "free_question";

function buildContextBlock(graph: KnowledgeGraph, concept: ConceptNode): string {
  const parents = concept.parentIds.map((id) => graph.nodes[id]?.title).filter(Boolean);
  const children = concept.childIds.map((id) => graph.nodes[id]?.title).filter(Boolean);
  const prereqs = concept.prerequisiteIds.map((id) => graph.nodes[id]?.title).filter(Boolean);
  const unlocks = concept.unlocksIds.map((id) => graph.nodes[id]?.title).filter(Boolean);
  const related = concept.relatedIds.slice(0, 8).map((id) => graph.nodes[id]?.title).filter(Boolean);

  return [
    `Selected concept: ${concept.title} (${concept.category}, ${concept.difficulty})`,
    `Summary: ${concept.summary}`,
    `Description: ${concept.description}`,
    parents.length ? `Broader field(s): ${parents.join(", ")}` : "",
    children.length ? `Contains subtopics: ${children.join(", ")}` : "",
    prereqs.length ? `Prerequisites: ${prereqs.join(", ")}` : "",
    unlocks.length ? `Unlocks after mastering: ${unlocks.join(", ")}` : "",
    related.length ? `Related concepts: ${related.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const INTENT_INSTRUCTIONS: Record<TutorIntent, string> = {
  explain_simpler: "Explain this concept in the simplest possible terms, as if to a curious beginner.",
  explain_deeper: "Give a deeper, more rigorous explanation appropriate for someone ready to go further.",
  analogy: "Provide one clear, memorable real-world analogy that captures the core intuition.",
  example: "Give a concrete, worked example that illustrates the concept in action.",
  comparison: "Compare this concept to its closest related or frequently-confused concepts in the graph, and clarify the distinction.",
  common_mistakes: "List the most common misconceptions or mistakes learners have with this concept, and how to avoid them.",
  quiz: "Write 3 short quiz questions (with answers) testing understanding of this concept.",
  flashcards: "Write 5 concise flashcards (front/back) for spaced-repetition review of this concept.",
  interview_questions: "Write 3 interview-style questions about this concept, ranging from foundational to advanced.",
  revision_summary: "Write a compact revision summary: the 4-6 most important facts to remember about this concept.",
  free_question: "Answer the user's specific question about this concept, staying grounded in the graph context.",
};

const SYSTEM_PROMPT = `You are Axium's AI tutor. You sit beside an interactive knowledge graph and help the user understand the concept they have currently selected.

Rules:
- Never invent new concepts, relationships, or claim something belongs in the graph that wasn't given to you as context.
- Always ground your explanation in the graph context you're given — reference prerequisites, related concepts, or what it unlocks where natural.
- Be precise, warm, and concise. Prefer clarity over length.
- You are a supporting teacher, not the product itself — encourage the user to keep exploring the graph rather than replacing that exploration.

Formatting:
- Your responses are rendered as formatted documentation, not plain text. Use Markdown freely: headings, bold/italics, ordered/unordered lists, tables, blockquotes, horizontal rules, and fenced code blocks with a language tag for any code.
- Whenever a mathematical expression appears, write it in proper LaTeX rather than plain text or unicode approximations. Use $...$ for inline math and $$...$$ on its own line for display equations. For example, write $\\sqrt{x^2 + y^2}$ inline, or a display equation as:
$$\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$
- Never write raw LaTeX-looking text outside of $...$ or $$...$$ delimiters, and never describe an equation in words when it can be shown directly.`;

export interface TutorRequest {
  graph: KnowledgeGraph;
  conceptId: string;
  intent: TutorIntent;
  userQuestion?: string;
}

export function buildTutorMessages(req: TutorRequest): GroqMessage[] {
  const concept = req.graph.nodes[req.conceptId];
  if (!concept) throw new Error(`Concept ${req.conceptId} not found in graph`);

  const contextBlock = buildContextBlock(req.graph, concept);
  const instruction = INTENT_INSTRUCTIONS[req.intent];

  const userContent =
    req.intent === "free_question" && req.userQuestion
      ? `Graph context:\n${contextBlock}\n\nUser question: ${req.userQuestion}`
      : `Graph context:\n${contextBlock}\n\nTask: ${instruction}`;

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];
}

/** Streams tutor response chunks. The graph continues to function normally if this throws — callers must not let AI failure block exploration. */
export async function* streamTutorResponse(req: TutorRequest, signal?: AbortSignal): AsyncGenerator<string> {
  const messages = buildTutorMessages(req);
  yield* streamGroq(messages, { temperature: 0.6, maxTokens: 1200 }, signal);
}
