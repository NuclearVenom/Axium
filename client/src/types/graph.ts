export type ConceptDifficulty = "foundational" | "introductory" | "intermediate" | "advanced" | "expert";

/**
 * What KIND of thing a concept is, independent of depth or category.
 * Currently surfaced as metadata in the side panel; reserved for future
 * filtering, per-type styling, and learning-path construction.
 */
export type ConceptNodeType =
  | "domain"
  | "field"
  | "paradigm"
  | "theory"
  | "concept"
  | "algorithm"
  | "method"
  | "technique"
  | "formula"
  | "metric"
  | "tool"
  | "framework"
  | "library"
  | "application"
  | "person"
  | "dataset"
  | "research_area";

export type RelationshipType =
  | "prerequisite"
  | "containment"
  | "specialization"
  | "generalization"
  | "mathematical_dependency"
  | "implementation"
  | "application"
  | "historical_influence"
  | "comparison"
  | "alternative"
  | "supporting"
  | "frequently_confused";

export interface ConceptNode {
  id: string;
  title: string;
  aliases: string[];
  category: string;
  nodeType: ConceptNodeType;
  difficulty: ConceptDifficulty;
  importance: number;
  estimatedStudyMinutes: number;
  summary: string;
  description: string;
  learningObjectives: string[];
  searchKeywords: string[];
  parentIds: string[];
  childIds: string[];
  prerequisiteIds: string[];
  unlocksIds: string[];
  relatedIds: string[];
  crossDisciplineIds: string[];
  isFoundational: boolean;
}

export interface ConceptEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  explanation: string;
  weight: number;
}

export interface KnowledgeGraph {
  id: string;
  rootConceptId: string;
  topic: string;
  nodes: Record<string, ConceptNode>;
  edges: ConceptEdge[];
  depth: number;
  nodeCount: number;
  edgeCount: number;
  status: "constructing" | "ready" | "failed";
}

export interface PositionedNode {
  node: ConceptNode;
  x: number;
  y: number;
  depth: number;
}

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
