import { z } from "zod";
import { NODE_TYPES } from "./prompts/nodeTypes.js";
import { PROMPT_RELATIONSHIP_TYPES } from "./prompts/relationshipTypes.js";

export const NodeTypeSchema = z.enum(NODE_TYPES);
export const RelationshipTypeSchema = z.enum(PROMPT_RELATIONSHIP_TYPES);

const TITLE_MAX = 80;
const SUMMARY_MAX = 160;
const DESCRIPTION_MAX = 380;
const EXPLANATION_MAX = 180;

const TempIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "tempId must be a lowercase slug (letters, digits, hyphens)");

export const AINodeSchema = z.object({
  tempId: TempIdSchema,
  title: z.string().trim().min(1).max(TITLE_MAX),
  nodeType: NodeTypeSchema,
  summary: z.string().trim().min(1).max(SUMMARY_MAX),
  description: z.string().trim().min(1).max(DESCRIPTION_MAX),
  importance: z.number().min(0).max(1),
  aliases: z.array(z.string().trim().min(1)).max(8).optional().default([]),
});

export const AIConstructionNodeSchema = AINodeSchema.extend({
  parentTempId: z.string().nullable(),
});

export const AIEdgeSchema = z.object({
  sourceTempId: TempIdSchema,
  targetTempId: TempIdSchema,
  type: RelationshipTypeSchema,
  explanation: z.string().trim().min(1).max(EXPLANATION_MAX),
  weight: z.number().min(0).max(1),
});

export const AIConstructionGraphSchema = z.object({
  rootTempId: TempIdSchema,
  nodes: z.array(AIConstructionNodeSchema).min(4),
  edges: z.array(AIEdgeSchema).default([]),
});

export const AIExpansionGraphSchema = z.object({
  nodes: z.array(AINodeSchema).min(1),
  edges: z.array(AIEdgeSchema).default([]),
});

export type AIConstructionGraph = z.infer<typeof AIConstructionGraphSchema>;
export type AIExpansionGraph = z.infer<typeof AIExpansionGraphSchema>;
