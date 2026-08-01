import Fuse from "fuse.js";
import { graphRepository } from "./graphRepository.js";
import { ResolvedQuery } from "./types.js";

/** Common abbreviations we resolve without hitting an LLM. Extend freely — this list only grows. */
const KNOWN_ABBREVIATIONS: Record<string, string> = {
  ai: "artificial intelligence",
  ml: "machine learning",
  dl: "deep learning",
  rl: "reinforcement learning",
  nlp: "natural language processing",
  cv: "computer vision",
  os: "operating systems",
  db: "databases",
  cs: "computer science",
  ds: "data structures",
  algo: "algorithms",
  "lin alg": "linear algebra",
  stats: "statistics",
  prob: "probability",
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalize(raw: string): string {
  let text = raw.trim().toLowerCase();
  // strip simple plural forms — conservative, avoids false singularization
  if (text.endsWith("ies") && text.length > 4) text = text.slice(0, -3) + "y";
  else if (text.endsWith("ses")) {
    // keep as-is; "ses" plurals are ambiguous (e.g. "biases")
  } else if (text.endsWith("s") && !text.endsWith("ss") && text.length > 3) {
    text = text.slice(0, -1);
  }
  if (KNOWN_ABBREVIATIONS[text]) return KNOWN_ABBREVIATIONS[text];
  return text;
}

/**
 * Resolve a raw search string to a canonical topic, checking whether it
 * already exists somewhere in the knowledge base before anything is built.
 * This is the very first stage of the search pipeline and never touches
 * the AI Assistant.
 */
export async function resolveQuery(raw: string): Promise<ResolvedQuery> {
  const canonical = normalize(raw);
  const allConcepts = await graphRepository.allConceptsIndex();

  if (allConcepts.length === 0) {
    return { raw, canonical, confidence: 0 };
  }

  const fuse = new Fuse(allConcepts, {
    keys: [
      { name: "node.title", weight: 0.5 },
      { name: "node.aliases", weight: 0.3 },
      { name: "node.searchKeywords", weight: 0.2 },
    ],
    threshold: 0.35,
    includeScore: true,
  });

  const results = fuse.search(canonical);
  if (results.length === 0) {
    return { raw, canonical, confidence: 0 };
  }

  const best = results[0];
  const confidence = 1 - (best.score ?? 1);
  return {
    raw,
    canonical,
    matchedConceptId: best.item.node.id,
    matchedGraphId: best.item.graphId,
    confidence,
  };
}

export interface SearchSuggestion {
  conceptId: string;
  graphId: string;
  title: string;
  category: string;
}

export async function searchConcepts(query: string, limit = 8): Promise<SearchSuggestion[]> {
  const allConcepts = await graphRepository.allConceptsIndex();
  if (allConcepts.length === 0) return [];

  const fuse = new Fuse(allConcepts, {
    keys: [
      { name: "node.title", weight: 0.5 },
      { name: "node.aliases", weight: 0.3 },
      { name: "node.searchKeywords", weight: 0.2 },
    ],
    threshold: 0.4,
  });

  return fuse
    .search(normalize(query))
    .slice(0, limit)
    .map((r) => ({
      conceptId: r.item.node.id,
      graphId: r.item.graphId,
      title: r.item.node.title,
      category: r.item.node.category,
    }));
}
