export function renderConstructionOutputFormat(): string {
  return `RESPOND WITH EXACTLY THIS JSON SHAPE:
{
  "rootTempId": "<tempId of the single depth-0 node>",
  "nodes": [
    {
      "tempId": "short-unique-slug",
      "title": "Node Title",
      "nodeType": "<one of the semantic types above>",
      "summary": "Exactly one sentence.",
      "description": "Two to four sentences.",
      "parentTempId": "<tempId of parent, or null only for the root>",
      "importance": 0.0,
      "aliases": ["optional", "alternate names"]
    }
  ],
  "edges": [
    {
      "sourceTempId": "tempId",
      "targetTempId": "tempId",
      "type": "<one of the relationship types above>",
      "explanation": "One specific sentence explaining the connection.",
      "weight": 0.0
    }
  ]
}`;
}

export function renderExpansionOutputFormat(): string {
  return `RESPOND WITH EXACTLY THIS JSON SHAPE (all nodes are direct children of the focus concept, so there is no parentTempId field):
{
  "nodes": [
    {
      "tempId": "short-unique-slug",
      "title": "Node Title",
      "nodeType": "<one of the semantic types above>",
      "summary": "Exactly one sentence.",
      "description": "Two to four sentences.",
      "importance": 0.0,
      "aliases": ["optional", "alternate names"]
    }
  ],
  "edges": [
    {
      "sourceTempId": "tempId",
      "targetTempId": "tempId",
      "type": "<one of the relationship types above>",
      "explanation": "One specific sentence explaining the connection.",
      "weight": 0.0
    }
  ]
}
Edges here may only connect tempIds within THIS response (the new siblings you're generating) — you cannot reference nodes from the rest of the graph, which you only have titles for, not tempIds.`;
}
