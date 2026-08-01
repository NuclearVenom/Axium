import { KnowledgeGraph, TutorIntent } from "../types/graph";

const BASE = "/api";

export interface SearchSuggestion {
  conceptId: string;
  graphId: string;
  title: string;
  category: string;
}

export async function searchConcepts(query: string): Promise<SearchSuggestion[]> {
  if (!query.trim()) return [];
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.suggestions ?? [];
}

export async function fetchGraph(graphId: string): Promise<KnowledgeGraph> {
  const res = await fetch(`${BASE}/graph/${encodeURIComponent(graphId)}`);
  if (!res.ok) throw new Error("Graph not found");
  return res.json();
}

export async function expandConcept(graphId: string, conceptId: string): Promise<KnowledgeGraph> {
  const res = await fetch(`${BASE}/graph/${encodeURIComponent(graphId)}/expand`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conceptId }),
  });
  if (!res.ok) throw new Error("Failed to expand concept");
  return res.json();
}

/** Parses a raw SSE stream body into {event, data} pairs. */
async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: any }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      let event = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data = line.slice(5).trim();
      }
      if (data) {
        try {
          yield { event, data: JSON.parse(data) };
        } catch {
          yield { event, data };
        }
      }
    }
  }
}

export interface ConstructionCallbacks {
  onStage?: (stage: string) => void;
  onDone?: (graph: KnowledgeGraph, reused: boolean) => void;
  onError?: (message: string) => void;
}

export async function constructGraphStream(topic: string, callbacks: ConstructionCallbacks) {
  const res = await fetch(`${BASE}/graph/construct/stream?topic=${encodeURIComponent(topic)}`);
  if (!res.ok || !res.body) {
    callbacks.onError?.("Could not reach the Knowledge Engine.");
    return;
  }

  for await (const { event, data } of parseSSE(res.body)) {
    if (event === "stage") callbacks.onStage?.(data.name);
    else if (event === "done") callbacks.onDone?.(data.graph, data.reused);
    else if (event === "error") callbacks.onError?.(data.message);
  }
}

export interface TutorStreamParams {
  graphId: string;
  conceptId: string;
  intent: TutorIntent;
  userQuestion?: string;
}

export async function streamTutorResponse(
  params: TutorStreamParams,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (message: string) => void
) {
  const res = await fetch(`${BASE}/ai/tutor/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok || !res.body) {
    onError("The AI Assistant is temporarily unavailable.");
    return;
  }

  for await (const { event, data } of parseSSE(res.body)) {
    if (event === "chunk") onChunk(data.text);
    else if (event === "done") onDone();
    else if (event === "error") onError(data.message);
  }
}
