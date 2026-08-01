import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getUsageCounters } from "../../utils/usageStore.js";

export const usageRouter = Router();

usageRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const counters = await getUsageCounters();
    res.json(counters);
  })
);
