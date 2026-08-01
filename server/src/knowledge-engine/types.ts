/**
 * Knowledge Engine — Domain Types
 *
 * These types are the single source of truth for what a "concept" and a
 * "relationship" are inside Axium. Nothing outside knowledge-engine/ is
 * allowed to define its own notion of these — the AI Assistant, the API
 * layer, and the frontend all consume these shapes as-is.
 */

export type ConceptDifficulty = "foundational" | "introductory" | "intermediate" | "advanced" | "expert";

/**
 * What KIND of thing a concept is, independent of where it sits in the
 * hierarchy or how hard it is. Orthogonal to depth/category — a "Formula"
 * or a "Person" can appear at any depth. Exists purely as metadata today
 * (surfaced in the side panel); reserved for future filtering, per-type
 * styling, and learning-path construction.
 */
export type ConceptNodeType =
  | "domain"          // a whole field of study, e.g. "Computer Science"
  | "field"           // a major subfield, e.g. "Machine Learning"
  | "paradigm"        // a school of thought / approach, e.g. "Functional Programming"
  | "theory"          // a formal theory, e.g. "Information Theory"
  | "concept"         // a general idea with no more specific type, the default
  | "algorithm"       // a named algorithm, e.g. "Dijkstra's Algorithm"
  | "method"          // a general method or approach, e.g. "Gradient Descent"
  | "technique"       // a narrower applied technique, e.g. "Data Augmentation"
  | "formula"         // a specific mathematical formula or equation
  | "metric"          // a measurement or evaluation quantity, e.g. "F1 Score"
  | "tool"            // a named tool, e.g. "Git"
  | "framework"       // a named framework, e.g. "React"
  | "library"         // a named software library, e.g. "NumPy"
  | "application"     // a real-world application or use case
  | "person"          // a notable individual, e.g. "Alan Turing"
  | "dataset"         // a named dataset, e.g. "ImageNet"
  | "research_area";  // an active area of ongoing research

export type RelationshipType =
  | "prerequisite"       // source must be understood before target
  | "containment"        // source is a broader field that contains target
  | "specialization"     // target is a more specific case of source
  | "generalization"     // inverse of specialization
  | "mathematical_dependency"
  | "implementation"     // target is a concrete implementation of source
  | "application"        // target is a real-world application of source
  | "historical_influence"
  | "comparison"         // source and target are commonly compared
  | "alternative"        // source and target are alternative approaches
  | "supporting"         // target provides supporting context for source
  | "frequently_confused";

export interface ConceptNode {
  id: string;                    // stable unique id, e.g. "linear-algebra"
  title: string;                 // canonical title
  aliases: string[];             // alternative names, abbreviations, synonyms
  category: string;              // e.g. "Mathematics", "Machine Learning"
  nodeType: ConceptNodeType;
  difficulty: ConceptDifficulty;
  importance: number;            // 0..1, relative importance within its graph
  estimatedStudyMinutes: number;
  summary: string;               // 1-3 sentence overview
  description: string;           // longer explanation, structured, non-AI-generated-on-the-fly
  learningObjectives: string[];
  searchKeywords: string[];
  parentIds: string[];           // broader containing concepts
  childIds: string[];            // narrower concepts contained within this one
  prerequisiteIds: string[];     // must understand before this
  unlocksIds: string[];          // becomes learnable/easier after this
  relatedIds: string[];          // loosely related, non-directional
  crossDisciplineIds: string[];  // concept ids in other disciplines this connects to
  externalRefs: ExternalReference[];
  isFoundational: boolean;       // true if this is a terminal / base concept
  textRefinedByAI: boolean;      // true only if the optional AI text-refinement pass touched this node's summary/description
  createdAt: string;
  updatedAt: string;
}

export interface ExternalReference {
  source: "wikipedia" | "wikidata" | "dbpedia" | "openalex" | "arxiv" | "manual" | "ai-inferred";
  url?: string;
  identifier?: string;
}

/** Where a relationship came from. AI-inferred edges are always tagged distinctly from source-derived ones — never silently merged. */
export type EdgeProvenance = "wikidata" | "wikipedia" | "dbpedia" | "openalex" | "ai-inferred" | "manual";

export interface ConceptEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  explanation: string;   // WHY these two concepts are connected
  weight: number;        // 0..1, strength/importance of the relationship
  provenance: EdgeProvenance;
}

export interface KnowledgeGraph {
  id: string;              // graph id, derived from the root topic's canonical id
  rootConceptId: string;
  topic: string;           // the original search string that produced this graph
  nodes: Record<string, ConceptNode>;
  edges: ConceptEdge[];
  depth: number;           // max BFS depth reached from root
  nodeCount: number;
  edgeCount: number;
  status: "constructing" | "ready" | "failed";
  constructionStages: ConstructionStage[];
  createdAt: string;
  updatedAt: string;
}

export interface ConstructionStage {
  name: string;
  startedAt: string;
  completedAt?: string;
}

/** Result of resolving a user's raw search text to a canonical concept/topic. */
export interface ResolvedQuery {
  raw: string;
  canonical: string;
  matchedConceptId?: string;   // set if an existing indexed concept matched
  matchedGraphId?: string;     // set if that concept already lives in a cached graph
  confidence: number;          // 0..1
}

/** Graph-native query capabilities — these must emerge from structure, not bespoke code per feature. */
export interface GraphQueryResult {
  conceptIds: string[];
}
