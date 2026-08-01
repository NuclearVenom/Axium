import "dotenv/config";
import express from "express";
import cors from "cors";
import { searchRouter } from "./api/routes/search.js";
import { graphRouter } from "./api/routes/graph.js";
import { aiRouter } from "./api/routes/ai.js";
import { usageRouter } from "./api/routes/usage.js";
import { errorHandler } from "./api/middleware/errorHandler.js";
import { countConfiguredKeys } from "./integrations/groqClient.js";

/**
 * The Express app itself, deliberately with no `.listen()` call. Both the
 * local dev entry point (index.ts, run via `npm run dev`/`npm start`) and
 * the Vercel serverless function entry point (/api/index.ts at the repo
 * root) import this same module. Keeping app assembly separate from
 * server startup is what lets the exact same routes, middleware, and
 * knowledge engine run completely unmodified in both a traditional
 * long-running process and a serverless request/response model — nothing
 * about routing, streaming, or the knowledge engine itself changes
 * between the two; only who calls `.listen()` does.
 *
 * `dotenv/config` is safe to import unconditionally here: locally it loads
 * `server/.env`; on Vercel there is no `.env` file to find, so it's a
 * harmless no-op and the platform's own injected environment variables
 * are used instead.
 */
export const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  const configuredKeys = countConfiguredKeys();
  res.json({ status: "ok", knowledgeEngineConfigured: configuredKeys > 0, configuredGroqKeys: configuredKeys });
});

app.use("/api/search", searchRouter);
app.use("/api/graph", graphRouter);
app.use("/api/ai", aiRouter);
app.use("/api/usage", usageRouter);

app.use(errorHandler);
