import { Redis } from "@upstash/redis";

/**
 * A single shared Redis connection for every storage module (graph
 * repository, AI response cache, usage counters). Vercel's serverless
 * functions have an ephemeral filesystem — nothing written to disk in one
 * invocation is guaranteed to be there for the next, since invocations can
 * land on different instances. Redis (via Upstash, provisioned through the
 * Vercel Marketplace) is the persistent store that replaces the filesystem
 * in that environment.
 *
 * Locally, none of this is required — if no Redis credentials are present,
 * `redis` is null and every storage module falls back to the original
 * JSON-file-on-disk behavior, so `npm run dev` keeps working exactly as it
 * always has with zero setup.
 *
 * Reads both the modern Upstash env var names and the legacy Vercel KV
 * names, since which one a given Marketplace integration injects has
 * shifted over time — supporting both means one less thing to debug at
 * deploy time.
 */
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis: Redis | null = url && token ? new Redis({ url, token }) : null;

export function isRedisConfigured(): boolean {
  return redis !== null;
}
