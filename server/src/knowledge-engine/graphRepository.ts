import { promises as fs } from "node:fs";
import path from "node:path";
import { KnowledgeGraph, ConceptNode } from "./types.js";
import { redis, isRedisConfigured } from "../storage/redisClient.js";

/**
 * GraphRepository is the only interface the rest of the Knowledge Engine
 * is allowed to depend on for persistence. Two implementations exist:
 * a JSON-file store for local development, and a Redis-backed store for
 * production on Vercel, where the filesystem is ephemeral and not shared
 * across serverless invocations. Which one is active is decided once, at
 * module load, based on whether Redis credentials are present — nothing
 * else in the codebase needs to know which backend is in use.
 */
export interface GraphRepository {
  getGraph(graphId: string): Promise<KnowledgeGraph | null>;
  saveGraph(graph: KnowledgeGraph): Promise<void>;
  listGraphs(): Promise<{ id: string; topic: string; nodeCount: number; updatedAt: string }[]>;
  /** Every concept ever generated, across all graphs — used for search + cross-graph linking. */
  findConceptAnywhere(conceptId: string): Promise<{ graphId: string; node: ConceptNode } | null>;
  allConceptsIndex(): Promise<{ graphId: string; node: ConceptNode }[]>;
}

const DATA_DIR = path.resolve(process.cwd(), "data", "graphs");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function graphFilePath(graphId: string) {
  return path.join(DATA_DIR, `${graphId}.json`);
}

export class JsonFileGraphRepository implements GraphRepository {
  private cache = new Map<string, KnowledgeGraph>();

  async getGraph(graphId: string): Promise<KnowledgeGraph | null> {
    if (this.cache.has(graphId)) return this.cache.get(graphId)!;
    await ensureDataDir();
    try {
      const raw = await fs.readFile(graphFilePath(graphId), "utf-8");
      const graph = JSON.parse(raw) as KnowledgeGraph;
      this.cache.set(graphId, graph);
      return graph;
    } catch (err: any) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  }

  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    await ensureDataDir();
    graph.updatedAt = new Date().toISOString();
    await fs.writeFile(graphFilePath(graph.id), JSON.stringify(graph, null, 2), "utf-8");
    this.cache.set(graph.id, graph);
  }

  async listGraphs() {
    await ensureDataDir();
    const files = await fs.readdir(DATA_DIR);
    const results = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const graph = await this.getGraph(file.replace(/\.json$/, ""));
      if (graph) {
        results.push({
          id: graph.id,
          topic: graph.topic,
          nodeCount: graph.nodeCount,
          updatedAt: graph.updatedAt,
        });
      }
    }
    return results;
  }

  async findConceptAnywhere(conceptId: string) {
    const all = await this.allConceptsIndex();
    return all.find((e) => e.node.id === conceptId) ?? null;
  }

  async allConceptsIndex() {
    const graphs = await this.listGraphs();
    const out: { graphId: string; node: ConceptNode }[] = [];
    for (const g of graphs) {
      const full = await this.getGraph(g.id);
      if (!full) continue;
      for (const node of Object.values(full.nodes)) {
        out.push({ graphId: g.id, node });
      }
    }
    return out;
  }
}

const GRAPH_INDEX_KEY = "axium:index:graphs";
const graphKey = (graphId: string) => `axium:graph:${graphId}`;

/**
 * Redis-backed repository for production on Vercel. Graph bodies are
 * stored as individual keys; a Redis Set tracks every graph id that
 * exists so listing/search (which need to enumerate all graphs) don't
 * require a filesystem directory listing or a Redis KEYS scan — both of
 * which are either unavailable or discouraged in this environment.
 */
export class RedisGraphRepository implements GraphRepository {
  async getGraph(graphId: string): Promise<KnowledgeGraph | null> {
    return (await redis!.get<KnowledgeGraph>(graphKey(graphId))) ?? null;
  }

  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    graph.updatedAt = new Date().toISOString();
    await redis!.set(graphKey(graph.id), graph);
    await redis!.sadd(GRAPH_INDEX_KEY, graph.id);
  }

  async listGraphs() {
    const ids = await redis!.smembers(GRAPH_INDEX_KEY);
    if (ids.length === 0) return [];
    const graphs = await this.mgetGraphs(ids);
    return graphs.map((g) => ({ id: g.id, topic: g.topic, nodeCount: g.nodeCount, updatedAt: g.updatedAt }));
  }

  async findConceptAnywhere(conceptId: string) {
    const all = await this.allConceptsIndex();
    return all.find((e) => e.node.id === conceptId) ?? null;
  }

  async allConceptsIndex() {
    const ids = await redis!.smembers(GRAPH_INDEX_KEY);
    if (ids.length === 0) return [];
    const graphs = await this.mgetGraphs(ids);
    const out: { graphId: string; node: ConceptNode }[] = [];
    for (const g of graphs) {
      for (const node of Object.values(g.nodes)) out.push({ graphId: g.id, node });
    }
    return out;
  }

  /** Batch fetch, filtering out ids whose graph body is somehow missing (e.g. a stale index entry) rather than throwing. */
  private async mgetGraphs(ids: string[]): Promise<KnowledgeGraph[]> {
    const results = await redis!.mget<(KnowledgeGraph | null)[]>(...ids.map(graphKey));
    return results.filter((g): g is KnowledgeGraph => g !== null);
  }
}

// Singleton — the rest of the app imports this instance. Backend chosen
// once at startup based on whether Redis credentials are present.
export const graphRepository: GraphRepository = isRedisConfigured() ? new RedisGraphRepository() : new JsonFileGraphRepository();
