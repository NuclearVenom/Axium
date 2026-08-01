import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { resolveQuery, searchConcepts } from "../../knowledge-engine/search.js";

export const searchRouter = Router();

searchRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q) {
      res.json({ suggestions: [] });
      return;
    }
    const suggestions = await searchConcepts(q);
    res.json({ suggestions });
  })
);

searchRouter.get(
  "/resolve",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q) {
      res.status(400).json({ error: "missing_query", message: "Query parameter 'q' is required." });
      return;
    }
    const resolved = await resolveQuery(q);
    res.json(resolved);
  })
);
