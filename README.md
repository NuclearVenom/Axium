[![Visit Axium](assets/axium-visit-badge.svg)](https://useaxium.vercel.app)

>*An AI-powered atlas of human knowledge — search a topic, get an explorable graph instead of a list of links.*

[![License: MIT](https://img.shields.io/badge/License-MIT-9E1D32.svg)](./LICENSE)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![GPT-OSS](https://img.shields.io/badge/GPT--OSS-120B-0A9E7B?logo=openai&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-API_Key-F55036?logo=groq&logoColor=white)
![Upstash](https://img.shields.io/badge/Upstash-Redis-00E9A3?logo=upstash&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?logo=vercel&logoColor=white)

---

## Contents

- [Contents](#contents)
- [Overview](#overview)
- [How it works](#how-it-works)
- [Why a graph instead of a page](#why-a-graph-instead-of-a-page)
- [Features](#features)
- [Screenshots](#screenshots)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Configure the server](#1-configure-the-server)
  - [2. Install and run](#2-install-and-run)
  - [Verifying the knowledge engine](#verifying-the-knowledge-engine)
- [Configuration](#configuration)
  - [Multiple Groq keys](#multiple-groq-keys)
- [Deployment](#deployment)
  - [How it's wired](#how-its-wired)
  - [Deploying your own instance](#deploying-your-own-instance)
  - [Function duration](#function-duration)
- [The knowledge engine, in depth](#the-knowledge-engine-in-depth)
- [API reference](#api-reference)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Security](#security)
- [Citation](#citation)
- [License](#license)
- [Credits](#credits)

## Overview

Most tools present knowledge in a straight line. Books read front to back. Search engines return a ranked list of isolated pages. Chatbots answer one question, then wait for the next. None of them show you the *shape* of a subject — what its major parts are, how those parts depend on one another, and where the idea you just read about actually sits in the wider field.

Axium takes a different approach. Type in a topic — Machine Learning, Ancient Rome, Calculus, whatever you're trying to understand — and Axium generates a knowledge graph for it: a hierarchy of concepts organized the way a good textbook's table of contents would organize them, rendered as something you navigate rather than scroll through. Every node is a concept you can select for a full explanation; every edge is a real relationship, not a decorative line. There is no manual authoring involved and no fixed dataset behind it — the entire structure is generated on demand by a large language model, constrained by a strict schema so the result stays consistent, hierarchical, and free of the noise a raw chatbot answer tends to produce.

Selecting a node opens a detail panel without disturbing the graph around it, so context is never lost. If a concept deserves more depth than the initial pass gave it, **Expand Further** generates exactly the next layer beneath that one node — nothing else is rebuilt, and the graph simply grows from wherever you're curious.

## How it works

```
User searches a topic
        |
        v
 Planning (deterministic, no model call)
   decides target depth, breadth, and node-count budget
        |
        v
 Prompt composition
   base identity + hierarchy rules + constraints + worked examples
   + few-shot examples, assembled from independent prompt modules
        |
        v
 Groq API call (structured JSON output)
        |
        v
 Schema validation (Zod) + structural validation
   duplicate titles, dangling references, cycles, node-count bounds
   -> one corrective retry with specific feedback if invalid
        |
        v
 Merge / materialization
   ids assigned, categories propagated, difficulty inferred,
   containment + relationship edges linked both directions
        |
        v
 Cached graph, ready to render
```

Expanding a node runs the same pipeline scoped to a single concept: the model is given the topic, the focus node, its parent, its siblings, and a digest of what already exists elsewhere in the graph, then asked for **only the next layer** beneath it — never a rebuild.

## Why a graph instead of a page

A few things fall out naturally once knowledge is represented as a graph rather than a document:

- **The big picture comes first.** You see how a subject is organized before you commit to reading any one part of it, instead of discovering the structure by accident thirty pages in.
- **Learning paths become personal.** Expanding only the branches you're curious about produces a path shaped by your own questions, not a fixed syllabus.
- **Prerequisites are visible, not assumed.** Dependency and prerequisite edges show what to understand first, rather than leaving you to guess or double back.
- **Cross-discipline connections surface on their own.** Relationships between fields that a textbook would never mention side by side show up as ordinary edges in the graph.
- **Depth is opt-in.** Beginners can stay at the top few layers; a specialist can keep expanding the same branch as far as the subject actually goes.

## Features

- **AI-native graph generation** — no internet retrieval; every graph is generated directly from a large language model against a strict schema.
- **Textbook-structured hierarchies** — broad-before-deep organization, consistent naming conventions, and a depth model that mirrors a real curriculum (domain → field → chapter → section → concept).
- **Expand Further** — grow any node's next layer of detail on demand, with full awareness of the rest of the graph so nothing is duplicated.
- **Infinite depth** — there is no hard ceiling on how far a branch can be explored.
- **Semantic node types** — every concept is tagged as a domain, field, theory, algorithm, formula, tool, person, dataset, and more, independent of its position in the hierarchy.
- **Rich relationships** — beyond parent/child containment, nodes can be linked by prerequisite, comparison, alternative, historical influence, and other relationship types, all visible in the side panel.
- **Resizable, adaptive side panel** — drag its edge to widen it; its contents reflow to make use of the extra space.
- **Always-legible labels** — every node's label is visible by default, with depth-aware typography and automatic decluttering so dense rings of nodes stay readable.
- **AI tutor** — ask follow-up questions, request a simpler or deeper explanation, an analogy, a quiz, or flashcards for any concept, streamed inline in the side panel.
- **Two-tier caching** — both the AI's raw generated structure and the fully materialized graph are cached, so repeat searches and repeat expansions are instant and free.
- **Deterministic by design** — low-temperature generation, explicit ordering rules, and caching combine to keep repeated generations of the same topic structurally consistent.

## Screenshots

<!-- Add screenshots or a short demo GIF here. Suggested shots: the landing search screen, a freshly generated graph at a moderate zoom level, the side panel with a concept expanded, and the AI tutor mid-response. -->

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Graph rendering | Custom SVG radial layout, d3-zoom, d3-selection |
| AI tutor content | react-markdown, remark-gfm, remark-math, rehype-katex, rehype-highlight |
| Backend | Node.js, Express, TypeScript (ESM) |
| Knowledge engine | Groq API (structured JSON generation), Zod (schema + structural validation) |
| Search & persistence | Fuse.js (fuzzy topic matching), Redis via Upstash in production (JSON files locally) |
| Deployment | Vercel — static frontend + the Express app as a single serverless function |

## Project structure

```
axium/
├── api/                              Vercel serverless function entry point
│   └── index.ts                       Re-exports the built Express app — see "Deployment" below
├── assets/                          Brand assets (logo) referenced by this README
├── client/                          Frontend application
│   └── src/
│       ├── components/
│       │   ├── graph/                Radial layout, canvas, node/edge renderers
│       │   ├── panel/                Side panel, AI tutor, markdown rendering
│       │   ├── search/               Landing search box
│       │   ├── landing/              Wordmark, animated mesh, GitHub repo badge
│       │   ├── common/               Shared visual elements (logo mark, watermark)
│       │   ├── construction/         Graph-construction loading state
│       │   └── usage/                Usage widget
│       ├── pages/                    Landing and GraphExplorer top-level views
│       ├── hooks/                    AI streaming hook, mobile-viewport detection
│       ├── lib/                      API client, local usage tracking
│       └── types/                    Shared frontend domain types
│
├── server/                           Backend application (Express)
│   └── src/
│       ├── app.ts                    The Express app itself — no .listen() call (see "Deployment")
│       ├── index.ts                  Local dev entry point — imports app.ts and listens on $PORT
│       ├── storage/                  Redis (production) / filesystem (local) persistence backends
│       ├── knowledge-engine/
│       │   ├── ai-generation/        The AI-native knowledge engine (see below)
│       │   ├── construction/         Thin orchestration wrapper + search-keyword derivation
│       │   ├── graphRepository.ts    Graph persistence and cache lookups
│       │   ├── search.ts             Fuzzy topic resolution
│       │   └── types.ts              Shared backend domain types
│       ├── ai-assistant/             The side-panel AI tutor (separate from graph generation)
│       ├── integrations/             Groq API client
│       ├── api/                      Express routes and middleware
│       ├── utils/                    Usage tracking, async error handling
│       └── deprecated/               Legacy multi-provider retrieval engine (local-only, see its README)
│
├── package.json                     Root scripts that orchestrate both subprojects (dev, build, verify)
├── vercel.json                      Vercel build/routing configuration
├── CONTRIBUTING.md
├── ROADMAP.md
├── SECURITY.md
├── CODE_OF_CONDUCT.md
├── CITATION.cff
└── LICENSE
```

## Getting started

### Prerequisites

- Node.js 18 or later
- A [Groq API key](https://console.groq.com) — the knowledge engine and the AI tutor both require one

Alternatively, the hosted build at [useaxium.vercel.app](https://useaxium.vercel.app) requires no setup at all.

### 1. Configure the server

```bash
cd server
cp .env.example .env   # if you don't already have server/.env
```

Edit `server/.env` and set:

```
GROQ_API_KEY_1=your_key_here
```

Redis is not required locally — leave `KV_REST_API_URL`/`KV_REST_API_TOKEN` unset and storage falls back to the `data/` directory automatically. See [Deployment](#deployment) for when those matter.

### 2. Install and run

From the repository root:

```bash
npm run install:all   # installs both server/ and client/ dependencies
npm run dev            # runs the server and client together
```

This starts the API on `http://localhost:4000` and the client on `http://localhost:5173` (which proxies `/api` requests to the server), matching exactly how the production deployment is wired. Prefer separate terminals? `npm run dev --prefix server` and `npm run dev --prefix client` work the same way individually.

### Verifying the knowledge engine

The knowledge-generation pipeline (schema validation, structural validation, materialization, merging, caching) has a standalone verification script that runs entirely offline against fixture data — no Groq API calls, no network required:

```bash
npm run verify
```

## Configuration

| Variable | Where | Required | Description |
| --- | --- | --- | --- |
| `PORT` | `server/.env` (local only) | No | Port the API server listens on locally. Defaults to `4000`. Not used on Vercel. |
| `GROQ_API_KEY_1` | `server/.env` locally; Vercel Environment Variables in production | Yes | Groq API key. Powers both graph generation and the AI tutor. Without it, the server starts but returns a clear `ai_unavailable` error for any graph request. |
| `GROQ_API_KEY_2`, `GROQ_API_KEY_3`, ... | Same as above | No | Additional Groq keys for automatic fallback — see [Multiple Groq keys](#multiple-groq-keys) below. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel Environment Variables | Required in production; optional locally | Upstash Redis REST credentials. When present, graph storage, the AI cache, and usage counters use Redis; otherwise they use local JSON files. See [Deployment](#deployment). |

### Multiple Groq keys

Axium looks for `GROQ_API_KEY_1`, `GROQ_API_KEY_2`, `GROQ_API_KEY_3`, and so on — any number, in any combination of what's actually set. If a request comes back rate-limited, unauthorized, or over the account's per-request token ceiling, it automatically retries with the next configured key, rather than failing. Whichever key most recently succeeded is preferred on the next call, so a request never wastes an attempt re-trying a key that's currently rate-limited.

This is entirely optional — one key is all Axium needs to run. Adding more only helps if you have more than one Groq account/key and want requests to spread across them automatically, e.g. to raise your effective rate limit ceiling.

## Deployment

Axium deploys to Vercel as a single project — one static frontend plus one serverless function — with no separately hosted backend required.

### How it's wired

- **Frontend.** `client/` builds to static files (`client/dist`) via Vite, served directly by Vercel.
- **Backend.** The entire Express app in `server/` (every route, the streaming endpoints, the knowledge engine, the AI tutor) is compiled to plain JavaScript and re-exported from a single file, `api/index.ts`, at the repository root. Vercel treats any Express app as a valid serverless function automatically — this is [Vercel's own documented pattern](https://vercel.com/docs/frameworks/backend/express) for Express, not a workaround. Nothing in `server/src` — no route, no middleware, no part of the knowledge engine — is aware it's running on Vercel; `api/index.ts` is the only Vercel-specific file in the whole backend.
- **Streaming.** [Vercel Functions support standard HTTP streaming](https://vercel.com/blog/streaming-for-serverless-node-js-and-edge-runtimes-with-vercel-functions) for both the Node.js and Edge runtimes. The graph construction and AI tutor endpoints stream Server-Sent Events using the same `res.write()`-based approach they always have — no SSE-specific changes were needed for the migration.
- **Persistence.** Vercel's serverless filesystem is ephemeral and not shared across invocations, so the graph cache, AI response cache, and usage counters — all originally simple JSON files on disk — are backed by Redis (via the Vercel Marketplace "Upstash for Redis" integration) in production. `server/src/storage/` picks Redis automatically when `KV_REST_API_URL`/`KV_REST_API_TOKEN` are present and falls back to the original `data/` JSON files otherwise, so local development is completely unaffected and requires no Redis setup at all.
- **Routing.** `vercel.json` rewrites every `/api/*` request to the one backend function; Express's own internal routing (`app.use("/api/graph", ...)`, etc.) still does the actual dispatch exactly as before.

### Deploying your own instance

1. Push this repository to GitHub (or your Git provider of choice) and import it into Vercel as a new project. Vercel will read `vercel.json` and configure the build automatically — no dashboard build-settings changes are needed.
2. Add a Redis store: in the Vercel dashboard, open **Storage → Marketplace Database Providers → Upstash → Redis**, and connect it to your project. This injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
3. Add your Groq key: **Settings → Environment Variables → `GROQ_API_KEY_1`**.
4. Deploy. The build runs `npm run install:all` then `npm run build` (compiling the server and building the client), and the result is one Vercel project serving both the site and the API.

### Function duration

The knowledge-generation endpoints are configured for a 60-second function timeout (`vercel.json` → `functions["api/index.ts"].maxDuration`) — the maximum available on Vercel's Hobby plan, and comfortably above the couple of seconds a typical Groq call takes even with a validation retry. If you're on a Pro plan and generating unusually large graphs, this can be raised up to the plan's limit.

## The knowledge engine, in depth

The engine lives entirely under `server/src/knowledge-engine/ai-generation/` and is organized as a small pipeline rather than one monolithic function, so each stage can evolve independently:

- **`prompts/`** — the prompt is treated as a first-class, versioned system, not a single string. `base.ts` defines the model's identity and objective; `hierarchy.ts` renders depth/breadth rules parameterized by the current generation plan; `constraints.ts` covers naming conventions and hard output rules; `examples.ts` gives a worked anti-pattern; `fewShot.ts` provides genuine `{user, assistant}` message-pair conditioning in the exact target schema; `expansion.ts` renders the "graph awareness" context that keeps expansions from duplicating existing nodes; `validationFeedback.ts` builds the corrective message used on a retry; `index.ts` composes all of the above into the final request.
- **`schema.ts`** — the strict Zod schema every model response must satisfy before it is trusted.
- **`pipeline/plan.ts`** — deterministic, model-free logic that decides how much structure to ask for (target depth, breadth bounds, node-count budget) before any request is made.
- **`pipeline/request.ts`** — issues the Groq call, parses and validates the response, retries once with specific corrective feedback if validation fails, and dynamically clamps the completion budget so a single request never exceeds the account's token-per-request ceiling.
- **`pipeline/validate.ts`** — structural checks beyond what a shape schema can express: duplicate titles, dangling parent references, unreachable/cyclic nodes, and node-count sanity bounds.
- **`pipeline/merge.ts`** — materializes validated AI output into real graph nodes and edges: id assignment, category propagation from each depth-1 branch downward, difficulty inference, and bidirectional relationship linking. Also handles expansion merges, which only ever append.
- **`aiCache.ts`** — caches the AI's raw, already-validated output, independent of the fully materialized graph cache in `graphRepository.ts`. A topic's construction and an individual concept's expansion are each cached on their own, so the same concept expanded from different graphs can share one cache entry.
- **`graphGenerator.ts`** — the orchestrator that ties planning, caching, requesting, and merging together into `generateConstruction` and `generateExpansion`.

Conceptually, the pipeline is:

```
Topic -> Planning -> Hierarchy Design -> Node Metadata -> Edge Generation -> Validation -> Merge
```

Hierarchy Design, Node Metadata, and Edge Generation are currently issued as a single Groq call — splitting them into independent round-trips would multiply latency and cost without a clear quality gain at Axium's current scale — but they are three distinct, separately documented instruction blocks within that one prompt, and the pipeline is structured so any of them could become its own call in the future without touching Planning, Validation, or Merge.

## API reference

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Server health and whether the knowledge engine is configured. |
| `GET` | `/api/search?q=` | Fuzzy search over previously generated graphs. |
| `GET` | `/api/graph/:graphId` | Fetch a previously generated graph. |
| `GET` | `/api/graph/construct/stream?topic=` | Server-Sent Events stream that constructs a new graph, emitting `stage` events followed by a final `done` event. Reuses a cached graph when one already matches. |
| `POST` | `/api/graph/:graphId/expand` | Expands one node (`{ "conceptId": "..." }`) by exactly one layer and returns the updated graph. |
| `POST` | `/api/ai/tutor` | Streams an AI tutor response for a concept and intent (explain simpler, quiz, flashcards, free-form question, etc.). |
| `GET` | `/api/usage` | Aggregate usage counters. |

## Roadmap

Planned work is tracked in [ROADMAP.md](./ROADMAP.md). At a glance: filtering by semantic node type, exporting a graph or branch as a study document, and learning-path generation across prerequisite edges.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow, coding conventions, and what to include in a pull request (prompt changes in particular are easy to write and hard to verify, so example output matters). Everyone participating is expected to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

If you believe you've found a security issue, please see [SECURITY.md](./SECURITY.md) for how to report it responsibly rather than opening a public issue.

## Citation

If Axium is useful in academic or research work, citation information is available in [CITATION.cff](./CITATION.cff).

## License

Axium is released under the [MIT License](./LICENSE).

## Credits

Axium is created, developed, and maintained by **Ranasurya Ghosh** ([@NuclearVenom](https://github.com/NuclearVenom)).
