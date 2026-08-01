/**
 * groqClient — the single, dedicated integration point with Groq.
 *
 * Per architecture: no other module in Axium is permitted to call Groq
 * directly. Two callers use this client for entirely different purposes:
 *   - knowledge-engine/ai-generation/pipeline/request.ts
 *       uses it to produce STRUCTURED graph data (JSON), one-shot, no streaming.
 *   - ai-assistant/aiAssistantService.ts
 *       uses it to produce STREAMED tutoring explanations.
 * Those two callers never share prompts, schemas, or code paths — only
 * this low-level transport.
 *
 * Multi-key fallback: Axium looks for GROQ_API_KEY_1, GROQ_API_KEY_2,
 * GROQ_API_KEY_3, ... (any number, any gaps) and rotates through whichever
 * are actually set. If a key comes back rate-limited or unauthorized, the
 * same logical request immediately retries with the next configured key
 * instead of failing — useful for spreading load across multiple Groq
 * accounts/keys when one hits its per-key rate limit. Whichever key last
 * succeeded is tried first on the next call, so a request doesn't keep
 * re-trying a key that's currently rate-limited.
 */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

// Status codes worth switching keys for immediately, rather than retrying
// the same key: invalid/revoked key, forbidden, and rate/quota limits
// (429 is the standard "too many requests" code; 413 is what Groq returns
// for "this request's tokens exceed your account's per-request ceiling",
// which is also effectively a per-key limit a different key may not share).
const KEY_LEVEL_FAILURE_STATUSES = new Set([401, 403, 413, 429]);

export class GroqConfigError extends Error {}
export class GroqRequestError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CallOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  retries?: number;
}

let cachedKeys: string[] | null = null;

/** Discovers every GROQ_API_KEY_<n> env var that's actually set, in numeric order — not just 1/2/3, any numbering, any gaps. */
function discoverApiKeys(): string[] {
  const found: { index: number; value: string }[] = [];
  for (const [name, value] of Object.entries(process.env)) {
    const match = name.match(/^GROQ_API_KEY_(\d+)$/);
    if (match && value && value.trim().length > 0) {
      found.push({ index: Number(match[1]), value: value.trim() });
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found.map((k) => k.value);
}

function getApiKeys(): string[] {
  if (!cachedKeys) cachedKeys = discoverApiKeys();
  if (cachedKeys.length === 0) {
    throw new GroqConfigError(
      "No Groq API keys are configured. Set GROQ_API_KEY_1 in the environment (and optionally GROQ_API_KEY_2, GROQ_API_KEY_3, ... for automatic fallback)."
    );
  }
  return cachedKeys;
}

/** Non-throwing check for health endpoints / startup warnings — how many GROQ_API_KEY_<n> vars are actually set. */
export function countConfiguredKeys(): number {
  if (!cachedKeys) cachedKeys = discoverApiKeys();
  return cachedKeys.length;
}

// Sticky pointer to whichever key most recently succeeded, so a request
// doesn't waste an attempt re-trying a key that's currently rate-limited.
let preferredKeyIndex = 0;

/**
 * Issues one Groq request, rotating through every configured key on
 * key-level failures and retrying the same key on transient ones, until
 * either a request succeeds or every key has been tried. Returns the raw,
 * already-ok Response — callers handle parsing/streaming themselves.
 */
async function requestWithKeyRotation(body: unknown, retriesPerKey: number): Promise<Response> {
  const keys = getApiKeys();
  let lastError: unknown;

  for (let keyAttempt = 0; keyAttempt < keys.length; keyAttempt++) {
    const keyIndex = (preferredKeyIndex + keyAttempt) % keys.length;
    const key = keys[keyIndex];

    for (let retryAttempt = 0; retryAttempt <= retriesPerKey; retryAttempt++) {
      try {
        const res = await fetch(GROQ_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const error = new GroqRequestError(`Groq request failed (${res.status}): ${text}`, res.status);
          if (KEY_LEVEL_FAILURE_STATUSES.has(res.status) && keys.length > 1) {
            console.warn(`[groqClient] Key #${keyIndex + 1} failed with ${res.status} — trying the next configured key.`);
            lastError = error;
            break; // stop retrying this key, move to the next one
          }
          throw error; // transient/unexpected failure — worth a same-key retry below
        }

        preferredKeyIndex = keyIndex; // stick to whichever key just worked
        return res;
      } catch (err) {
        lastError = err;
        if (retryAttempt < retriesPerKey) {
          await new Promise((r) => setTimeout(r, 400 * (retryAttempt + 1)));
          continue;
        }
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All configured Groq API keys failed.");
}

/** One-shot, non-streaming call. Used for structured graph construction. */
export async function callGroq(messages: GroqMessage[], opts: CallOptions = {}): Promise<string> {
  const { temperature = 0.3, maxTokens = 8000, jsonMode = false, retries = 2 } = opts;

  const res = await requestWithKeyRotation(
    {
      model: MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    },
    retries
  );

  const data = (await res.json()) as any;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new GroqRequestError("Groq response missing content");
  }
  return content;
}

/** Streaming call. Used for AI Assistant tutoring responses. Returns an async generator of text chunks. */
export async function* streamGroq(
  messages: GroqMessage[],
  opts: CallOptions = {},
  signal?: AbortSignal
): AsyncGenerator<string> {
  const { temperature = 0.6, maxTokens = 2000 } = opts;

  // Key rotation applies to the connection phase only — once a stream is
  // actually flowing to the caller, switching keys mid-stream isn't safe
  // (some content may already have been forwarded), so a failure past
  // this point just propagates as before.
  const res = await requestWithKeyRotation(
    {
      model: MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    },
    1
  );

  if (!res.body) {
    throw new GroqRequestError("Groq stream response had no body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            yield delta;
          }
        } catch {
          // ignore malformed SSE fragments
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
