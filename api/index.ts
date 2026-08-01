import { app } from "../server/dist/app.js";

/**
 * This is the ONLY file Vercel treats specially — everything it needs
 * (routes, middleware, the knowledge engine, streaming) lives in
 * server/src and is completely unaware it's running on Vercel at all.
 *
 * An Express app is itself a valid `(req, res) => void` request handler,
 * which is exactly what Vercel's Node.js function runtime expects as a
 * default export — so this file's only job is to hand that app over.
 * Deploying an Express app this way is Vercel's own documented pattern
 * (see "Express on Vercel" in their docs); it becomes a single Vercel
 * Function that Fluid Compute scales automatically, with the streaming
 * (SSE) responses in graph.ts and ai.ts working unmodified.
 *
 * It imports the COMPILED output (server/dist/app.js), not the TS source
 * directly. server/dist is produced by `npm run build` inside server/,
 * which vercel.json's buildCommand runs before this function is bundled —
 * that keeps this handoff as plain, predictable ESM JavaScript rather
 * than asking Vercel's bundler to resolve and transpile the entire
 * knowledge engine's TypeScript on the fly.
 */
export default app;
