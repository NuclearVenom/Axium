import { promises as fs } from "node:fs";
import path from "node:path";
import { redis, isRedisConfigured } from "../storage/redisClient.js";

interface UsageCounters {
  graphRequests: number;
  aiRequests: number;
}

const USAGE_FILE = path.resolve(process.cwd(), "data", "usage.json");
const GRAPH_REQUESTS_KEY = "axium:usage:graphRequests";
const AI_REQUESTS_KEY = "axium:usage:aiRequests";

let cache: UsageCounters | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function loadFromDisk(): Promise<UsageCounters> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(USAGE_FILE, "utf-8");
    cache = JSON.parse(raw);
  } catch {
    cache = { graphRequests: 0, aiRequests: 0 };
  }
  return cache!;
}

async function persistToDisk() {
  await fs.mkdir(path.dirname(USAGE_FILE), { recursive: true });
  await fs.writeFile(USAGE_FILE, JSON.stringify(cache, null, 2), "utf-8");
}

function enqueueWrite() {
  writeQueue = writeQueue.then(persistToDisk).catch((err) => console.error("Failed to persist usage counters", err));
  return writeQueue;
}

/**
 * Two backends, same as graphRepository: filesystem locally, Redis in
 * production. Redis's INCR is atomic, which is also a genuine correctness
 * improvement over the filesystem version's in-memory write queue — that
 * queue only serializes writes within a single process, which offers no
 * protection at all once multiple serverless instances can be handling
 * requests concurrently.
 */
export async function recordGraphRequest(): Promise<void> {
  if (isRedisConfigured()) {
    await redis!.incr(GRAPH_REQUESTS_KEY);
    return;
  }
  const counters = await loadFromDisk();
  counters.graphRequests += 1;
  await enqueueWrite();
}

export async function recordAIRequest(): Promise<void> {
  if (isRedisConfigured()) {
    await redis!.incr(AI_REQUESTS_KEY);
    return;
  }
  const counters = await loadFromDisk();
  counters.aiRequests += 1;
  await enqueueWrite();
}

export async function getUsageCounters(): Promise<UsageCounters & { totalCalls: number }> {
  if (isRedisConfigured()) {
    const [graphRequests, aiRequests] = await Promise.all([
      redis!.get<number>(GRAPH_REQUESTS_KEY),
      redis!.get<number>(AI_REQUESTS_KEY),
    ]);
    const counters = { graphRequests: graphRequests ?? 0, aiRequests: aiRequests ?? 0 };
    return { ...counters, totalCalls: counters.graphRequests + counters.aiRequests };
  }
  const counters = await loadFromDisk();
  return { ...counters, totalCalls: counters.graphRequests + counters.aiRequests };
}
