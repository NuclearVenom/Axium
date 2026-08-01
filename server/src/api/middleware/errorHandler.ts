import { NextFunction, Request, Response } from "express";
import { GroqConfigError, GroqRequestError } from "../../integrations/groqClient.js";
import { GraphGenerationError } from "../../knowledge-engine/ai-generation/pipeline/request.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  if (err instanceof GroqConfigError) {
    res.status(503).json({
      error: "ai_unavailable",
      message: "Axium's knowledge engine is not configured — no GROQ_API_KEY_1 (or GROQ_API_KEY_2, GROQ_API_KEY_3, ...) is set. Graph generation is unavailable until at least one is.",
    });
    return;
  }

  if (err instanceof GraphGenerationError) {
    res.status(422).json({
      error: "graph_generation_failed",
      message: err.message,
    });
    return;
  }

  if (err instanceof GroqRequestError) {
    res.status(502).json({
      error: "ai_request_failed",
      message: "The AI knowledge engine is temporarily unavailable. Please try again.",
    });
    return;
  }

  if (err instanceof SyntaxError) {
    res.status(422).json({
      error: "malformed_response",
      message: "The knowledge graph could not be constructed from the model's response. Please try again.",
    });
    return;
  }

  res.status(500).json({
    error: "internal_error",
    message: "Something went wrong. Please try again.",
  });
}
