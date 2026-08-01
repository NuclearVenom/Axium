import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { graphRepository } from "../../knowledge-engine/graphRepository.js";
import { resolveQuery, slugify } from "../../knowledge-engine/search.js";
import { constructGraph, expandConcept } from "../../knowledge-engine/construction/graphBuilder.js";
import { recordGraphRequest } from "../../utils/usageStore.js";

export const graphRouter = Router();

graphRouter.get(
  "/:graphId",
  asyncHandler(async (req, res) => {
    const graph = await graphRepository.getGraph(req.params.graphId);
    if (!graph) {
      res.status(404).json({ error: "not_found", message: "Graph not found." });
      return;
    }
    res.json(graph);
  })
);

/**
 * Server-Sent Events endpoint. Streams construction stage names as the
 * graph is built, then a final "done" event carrying the complete graph.
 * If a cached graph already satisfies the query, it skips straight to done.
 */
graphRouter.get(
  "/construct/stream",
  asyncHandler(async (req, res) => {
    const topic = String(req.query.topic ?? "").trim();
    if (!topic) {
      res.status(400).json({ error: "missing_topic", message: "Query parameter 'topic' is required." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    await recordGraphRequest();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const resolved = await resolveQuery(topic);

      // Reuse: strong match against an already-built graph — jump straight there.
      if (resolved.matchedGraphId && resolved.confidence > 0.55) {
        const existing = await graphRepository.getGraph(resolved.matchedGraphId);
        if (existing) {
          send("stage", { name: "Found existing knowledge landscape" });
          send("done", { graph: existing, reused: true });
          res.end();
          return;
        }
      }

      // Also check if a graph with the exact same id already exists (repeat search).
      const graphId = slugify(topic);
      const existingById = await graphRepository.getGraph(graphId);
      if (existingById) {
        send("stage", { name: "Found existing knowledge landscape" });
        send("done", { graph: existingById, reused: true });
        res.end();
        return;
      }

      const graph = await constructGraph(topic, (stage) => send("stage", { name: stage }));
      send("done", { graph, reused: false });
      res.end();
    } catch (err) {
      send("error", {
        message: err instanceof Error ? err.message : "Graph construction failed.",
      });
      res.end();
    }
  })
);

graphRouter.post(
  "/:graphId/expand",
  asyncHandler(async (req, res) => {
    const { conceptId } = req.body ?? {};
    if (!conceptId) {
      res.status(400).json({ error: "missing_concept", message: "Body field 'conceptId' is required." });
      return;
    }
    const graph = await expandConcept(req.params.graphId, conceptId);
    res.json(graph);
  })
);
