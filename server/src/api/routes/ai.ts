import { Router } from "express";
import { graphRepository } from "../../knowledge-engine/graphRepository.js";
import { streamTutorResponse, TutorIntent } from "../../ai-assistant/aiAssistantService.js";
import { recordAIRequest } from "../../utils/usageStore.js";

export const aiRouter = Router();

aiRouter.post("/tutor/stream", async (req, res) => {
  const { graphId, conceptId, intent, userQuestion } = req.body ?? {};

  if (!graphId || !conceptId || !intent) {
    res.status(400).json({
      error: "missing_fields",
      message: "graphId, conceptId, and intent are required.",
    });
    return;
  }

  const graph = await graphRepository.getGraph(graphId);
  if (!graph || !graph.nodes[conceptId]) {
    res.status(404).json({ error: "not_found", message: "Concept or graph not found." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  await recordAIRequest();

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    for await (const chunk of streamTutorResponse(
      { graph, conceptId, intent: intent as TutorIntent, userQuestion },
      controller.signal
    )) {
      send("chunk", { text: chunk });
    }
    send("done", {});
  } catch (err) {
    send("error", {
      message:
        err instanceof Error
          ? "The AI Assistant is temporarily unavailable. The graph remains fully explorable."
          : "Unknown error.",
    });
  } finally {
    res.end();
  }
});
