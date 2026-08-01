import { useState } from "react";
import { ConceptNode, KnowledgeGraph } from "../../types/graph";
import { AIAssistantPanel } from "./AIAssistantPanel";
import { expandConcept } from "../../lib/api";

const DIFFICULTY_LABEL: Record<string, string> = {
  foundational: "Foundational",
  introductory: "Introductory",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

function formatNodeType(nodeType: string): string {
  return nodeType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function ConceptPanelBody({
  graph,
  concept,
  onNavigate,
  onClose,
  onGraphUpdated,
}: {
  graph: KnowledgeGraph;
  concept: ConceptNode;
  onNavigate: (conceptId: string) => void;
  onClose: () => void;
  onGraphUpdated: (graph: KnowledgeGraph) => void;
}) {
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);

  const relatedList = (ids: string[]) =>
    ids
      .map((id) => graph.nodes[id])
      .filter(Boolean)
      .slice(0, 10);

  const parents = relatedList(concept.parentIds);
  const children = relatedList(concept.childIds);
  const prerequisites = relatedList(concept.prerequisiteIds);
  const unlocks = relatedList(concept.unlocksIds);
  const related = relatedList(concept.relatedIds);
  const crossDiscipline = relatedList(concept.crossDisciplineIds);

  const canExpand = concept.childIds.length === 0;

  const handleExpand = async () => {
    setIsExpanding(true);
    setExpandError(null);
    try {
      const updated = await expandConcept(graph.id, concept.id);
      onGraphUpdated(updated);
    } catch (err) {
      setExpandError(err instanceof Error ? err.message : "Couldn't expand this concept. Please try again.");
    } finally {
      setIsExpanding(false);
    }
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-ink-muted">{concept.category}</p>
          <h2 className="mt-1 truncate text-xl font-semibold text-ink">{concept.title}</h2>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 text-ink-muted transition-colors hover:text-ink"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-muted">
        <span className="rounded-full border border-border px-2.5 py-1">{formatNodeType(concept.nodeType)}</span>
        <span className="rounded-full border border-border px-2.5 py-1">{DIFFICULTY_LABEL[concept.difficulty]}</span>
        <span className="rounded-full border border-border px-2.5 py-1">~{concept.estimatedStudyMinutes} min</span>
        {concept.isFoundational && (
          <span className="rounded-full border border-accent/40 px-2.5 py-1 text-accent">Foundational</span>
        )}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink">{concept.summary}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{concept.description}</p>

      {concept.learningObjectives.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">You'll be able to</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-ink">
            {concept.learningObjectives.map((obj, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent">•</span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canExpand && (
        <div className="mt-5">
          <button
            onClick={handleExpand}
            disabled={isExpanding}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:cursor-wait disabled:opacity-60"
          >
            {isExpanding ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                Expanding…
              </>
            ) : (
              <>Expand Further</>
            )}
          </button>
          {expandError && <p className="mt-2 text-xs text-red-400">{expandError}</p>}
        </div>
      )}

      <RelationSection title="Learn before this" items={prerequisites} onNavigate={onNavigate} />
      <RelationSection title="Part of" items={parents} onNavigate={onNavigate} />
      <RelationSection title="Contains" items={children} onNavigate={onNavigate} />
      <RelationSection title="Unlocks next" items={unlocks} onNavigate={onNavigate} />
      <RelationSection title="Related" items={related} onNavigate={onNavigate} />
      <RelationSection title="Connects across fields" items={crossDiscipline} onNavigate={onNavigate} />

      <AIAssistantPanel graphId={graph.id} concept={concept} />
    </>
  );
}

function RelationSection({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: { id: string; title: string }[];
  onNavigate: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink transition-colors hover:border-accent/50"
          >
            {item.title}
          </button>
        ))}
      </div>
    </div>
  );
}
