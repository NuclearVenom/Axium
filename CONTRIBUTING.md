# Contributing to Axium

Thank you for considering a contribution. This document covers how to propose changes, the conventions the codebase follows, and what makes a pull request easy to review.

Everyone participating in this project is expected to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Before you start

For anything beyond a small fix — a new feature, a change to the graph generation pipeline, a UI redesign — please open an issue first describing what you'd like to change and why. It's much easier to agree on a direction before code exists than to reconcile two different visions after the fact.

For typos, broken links, and other small corrections, a pull request without a preceding issue is fine.

## Development setup

Follow the [Getting started](./README.md#getting-started) section of the README to run the client and server locally. In short:

```bash
npm run install:all
npm run dev
```

You'll need a Groq API key to exercise graph generation end to end; the server starts without one, but graph requests will fail until `GROQ_API_KEY_1` is set in `server/.env`. Redis is not required for local development — see [Deployment in the README](./README.md#deployment) for when it's needed.

## Before opening a pull request

Run the following from the relevant package directory, and make sure all of them pass:

```bash
npm run typecheck   # both client/ and server/
npm run verify       # server/ — offline pipeline checks, no API key required
npm run build        # both client/ and server/, same as the Vercel build
```

## Coding conventions

- **TypeScript, strictly.** Both packages compile under `strict: true`. Avoid `any` unless there's a genuinely good reason, and prefer narrowing types over casting.
- **Modular over monolithic.** The knowledge engine in particular is deliberately split into small, single-purpose modules (planning, prompting, requesting, validating, merging) rather than one large function. New functionality should follow that pattern rather than growing an existing module past its original responsibility.
- **Comment for understanding, not narration.** Comments should explain *why* something is done a particular way when that isn't obvious from the code itself — not restate what the next line already says.
- **Match the existing structure before introducing a new one.** If you're adding a new prompt concern, a new API route, or a new graph component, look at how similar things are already organized first.

## Contributing to prompt engineering

Changes to anything under `server/src/knowledge-engine/ai-generation/prompts/` are worth extra care. Prompt changes are easy to write and hard to verify — a change that reads well can still degrade output quality in ways that only show up on certain topics. When submitting one:

- Include a few example topics you generated with the change and, ideally, the same topics generated without it, so the reviewer can compare.
- Note anything you specifically tested for: duplicate-node avoidance, depth consistency, category assignment, edge quality, and so on.
- Keep prompt token budgets in mind — `pipeline/request.ts` has a hard ceiling on prompt-plus-completion tokens per request; a prompt addition that pushes past it will silently shrink the completion budget rather than fail loudly, which is easy to miss without checking.

## Pull request expectations

- Keep pull requests focused. A PR that does one thing is much faster to review — and more likely to be merged — than one that bundles several unrelated changes.
- Describe what changed and why, not just what files were touched.
- Screenshots or short clips are appreciated for anything visual.
- Be responsive to review feedback; if a PR goes quiet for an extended period it may be closed and can always be reopened later.

## Reporting bugs and requesting features

Use GitHub Issues for both. For bugs, include steps to reproduce, what you expected, and what actually happened. For feature requests, a short description of the problem you're trying to solve is more useful than a fully-specified solution — there's often more than one way to address it.

For security vulnerabilities specifically, please do not open a public issue — see [SECURITY.md](./SECURITY.md).
