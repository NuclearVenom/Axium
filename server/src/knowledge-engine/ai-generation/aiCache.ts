import { promises as fs } from "node:fs";
import path from "node:path";
import { RawAIExpansion, RawAIGraph } from "./pipeline/types.js";
import { redis, isRedisConfigured } from "../../storage/redisClient.js";

/**
 * Caches the AI's raw, already-validated output — one layer below the
 * final KnowledgeGraph cache in graphRepository.ts. Two independent
 * concerns:
 *   - graphRepository caches the MATERIALIZED graph (ids assigned, linked,
 *     ready to render) keyed by graph id / topic slug.
 *   - this module caches the AI's RAW answer keyed by what was actually
 *     asked, so construction and every individual node expansion are each
 *     reusable without spending another model call, even if materialization
 *     logic (id assignment, category propagation, etc.) changes later.
 *
 * Filesystem-backed locally, Redis-backed in production — same pattern as
 * graphRepository.ts and usageStore.ts, and for the same reason: Vercel's
 * serverless filesystem is ephemeral and not shared across invocations.
 */

const CONSTRUCTION_DIR = path.resolve(process.cwd(), "data", "ai-cache", "construction");
const EXPANSION_DIR = path.resolve(process.cwd(), "data", "ai-cache", "expansion");

function slugKey(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 150);
}

/** Expansion is keyed by concept identity (root topic + parent + title), not by graphId — so
 *  the same real-world concept expanded from two different graphs can share one cache entry. */
export function expansionCacheKey(rootTopic: string, parentTitle: string | null, focusTitle: string): string {
  return slugKey(`${rootTopic}::${parentTitle ?? "root"}::${focusTitle}`);
}

export function constructionCacheKey(topic: string): string {
  return slugKey(topic);
}

const constructionMemo = new Map<string, RawAIGraph>();
const expansionMemo = new Map<string, RawAIExpansion>();

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}

const redisKey = (kind: "construction" | "expansion", key: string) => `axium:aicache:${kind}:${key}`;

export async function getCachedConstruction(topic: string): Promise<RawAIGraph | null> {
  const key = constructionCacheKey(topic);
  if (constructionMemo.has(key)) return constructionMemo.get(key)!;

  const value = isRedisConfigured()
    ? await redis!.get<RawAIGraph>(redisKey("construction", key))
    : await readJsonFile<RawAIGraph>(path.join(CONSTRUCTION_DIR, `${key}.json`));

  if (value) constructionMemo.set(key, value);
  return value;
}

export async function setCachedConstruction(topic: string, graph: RawAIGraph): Promise<void> {
  const key = constructionCacheKey(topic);
  constructionMemo.set(key, graph);
  if (isRedisConfigured()) {
    await redis!.set(redisKey("construction", key), graph);
  } else {
    await writeJsonFile(path.join(CONSTRUCTION_DIR, `${key}.json`), graph);
  }
}

export async function getCachedExpansion(key: string): Promise<RawAIExpansion | null> {
  if (expansionMemo.has(key)) return expansionMemo.get(key)!;

  const value = isRedisConfigured()
    ? await redis!.get<RawAIExpansion>(redisKey("expansion", key))
    : await readJsonFile<RawAIExpansion>(path.join(EXPANSION_DIR, `${key}.json`));

  if (value) expansionMemo.set(key, value);
  return value;
}

export async function setCachedExpansion(key: string, expansion: RawAIExpansion): Promise<void> {
  expansionMemo.set(key, expansion);
  if (isRedisConfigured()) {
    await redis!.set(redisKey("expansion", key), expansion);
  } else {
    await writeJsonFile(path.join(EXPANSION_DIR, `${key}.json`), expansion);
  }
}
