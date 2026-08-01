import { lazy, Suspense, useState } from "react";
import { ConceptNode, TutorIntent } from "../../types/graph";
import { useAIStream } from "../../hooks/useAIStream";

const MarkdownContent = lazy(() => import("./MarkdownContent").then((m) => ({ default: m.MarkdownContent })));

const INTENT_LABELS: { intent: TutorIntent; label: string }[] = [
  { intent: "explain_simpler", label: "Simpler" },
  { intent: "explain_deeper", label: "Deeper" },
  { intent: "analogy", label: "Analogy" },
  { intent: "example", label: "Example" },
  { intent: "comparison", label: "Compare" },
  { intent: "common_mistakes", label: "Common mistakes" },
  { intent: "quiz", label: "Quiz me" },
  { intent: "flashcards", label: "Flashcards" },
  { intent: "revision_summary", label: "Summarize" },
];

export function AIAssistantPanel({ graphId, concept }: { graphId: string; concept: ConceptNode }) {
  const { text, isStreaming, error, ask } = useAIStream();
  const [question, setQuestion] = useState("");

  const handleIntent = (intent: TutorIntent) => {
    ask({ graphId, conceptId: concept.id, intent });
  };

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    ask({ graphId, conceptId: concept.id, intent: "free_question", userQuestion: question.trim() });
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 mt-4">
      <div className="flex flex-wrap gap-1.5">
        {INTENT_LABELS.map(({ intent, label }) => (
          <button
            key={intent}
            onClick={() => handleIntent(intent)}
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink-muted transition-colors hover:border-accent/50 hover:text-ink"
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleAsk} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about this concept…"
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent/50 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          disabled={isStreaming}
        >
          Ask
        </button>
      </form>

      {(text || isStreaming || error) && (
        <div className="rounded-lg border border-border bg-surface/60 p-4 text-sm leading-relaxed text-ink-muted">
          {error ? (
            <p className="text-amber-400/90">{error}</p>
          ) : (
            <>
              <Suspense fallback={<p className="whitespace-pre-wrap">{text}</p>}>
                <MarkdownContent content={text} />
              </Suspense>
              {isStreaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-middle" />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
