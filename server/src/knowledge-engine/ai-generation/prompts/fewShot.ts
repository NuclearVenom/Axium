import { GroqMessage } from "../../../integrations/groqClient.js";

/**
 * Real {user, assistant} message pairs prepended before the actual request,
 * as opposed to examples.ts which is prose describing patterns INSIDE the
 * system prompt. Few-shot message pairs condition the model's literal
 * output far more reliably than prose describing that output — this is
 * what keeps field names, JSON shape, and tone consistent across topics.
 *
 * Kept deliberately minimal (one small topic, short text fields) — this
 * pair is sent on every single request, so its token cost is a permanent
 * tax on every call. A few compact nodes are enough to lock in the shape;
 * the detailed rules for content quality live in the prose sections instead.
 */
export function constructionFewShot(): GroqMessage[] {
  return [
    { role: "user", content: 'Generate the full knowledge graph for topic: "Photosynthesis".' },
    {
      role: "assistant",
      content: JSON.stringify({
        rootTempId: "photosynthesis",
        nodes: [
          {
            tempId: "photosynthesis",
            title: "Photosynthesis",
            nodeType: "concept",
            summary: "How plants convert light energy into chemical energy.",
            description: "Converts light, water, and CO2 into glucose and oxygen, underpinning most food chains.",
            parentTempId: null,
            importance: 1,
            aliases: [],
          },
          {
            tempId: "light-dependent-reactions",
            title: "Light-Dependent Reactions",
            nodeType: "method",
            summary: "The stage that captures light energy as chemical energy carriers.",
            description: "Occurs in the thylakoid membrane, producing ATP and NADPH while splitting water.",
            parentTempId: "photosynthesis",
            importance: 0.9,
            aliases: ["light reactions"],
          },
          {
            tempId: "calvin-cycle",
            title: "Calvin Cycle",
            nodeType: "method",
            summary: "The stage that fixes carbon dioxide into glucose using ATP and NADPH.",
            description: "Occurs in the stroma, converting CO2 into sugars using energy from the light reactions.",
            parentTempId: "photosynthesis",
            importance: 0.9,
            aliases: ["dark reactions"],
          },
          {
            tempId: "carbon-fixation",
            title: "Carbon Fixation",
            nodeType: "technique",
            summary: "The first step of the Calvin cycle, attaching CO2 to an existing molecule.",
            description: "The enzyme RuBisCO catalyzes CO2 attachment to ribulose bisphosphate, the cycle's entry point.",
            parentTempId: "calvin-cycle",
            importance: 0.55,
            aliases: [],
          },
        ],
        edges: [
          {
            sourceTempId: "light-dependent-reactions",
            targetTempId: "calvin-cycle",
            type: "supporting",
            explanation: "ATP and NADPH from the light reactions power the Calvin cycle's carbon fixation.",
            weight: 0.7,
          },
        ],
      }),
    },
  ];
}
