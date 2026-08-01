# Roadmap

This document tracks the direction Axium is heading in. It is a statement of intent, not a commitment with dates attached — priorities shift, and items may be reordered, merged, or dropped as the project evolves. Suggestions are welcome; see [CONTRIBUTING.md](./CONTRIBUTING.md) for how to propose additions.

## Near term

- **Filtering and highlighting by semantic node type** — dim or isolate the graph to just algorithms, just people, just formulas, and so on.
- **Exporting a graph or a single branch** as a standalone study document (Markdown or PDF), for offline reading or sharing.
- **Refinements to the generation prompt** based on real-world output review across a wider range of topics — particularly around edge quality (fewer, more meaningful relationships) and consistency of depth across sibling branches.

## Mid term

- **Learning-path generation** — given a target concept, surface a suggested reading order across its prerequisite edges rather than requiring manual navigation.
- **User-suggested corrections** that feed back into future generations of the same topic, so recurring issues with a specific subject don't repeat indefinitely.
- **Multi-topic graph merging** — viewing two related subjects (e.g. "Linear Algebra" and "Machine Learning") as one connected atlas rather than two separate graphs.
- **Persistent accounts and saved graphs**, so a generated atlas can be revisited without regenerating it.

## Exploratory

These are directions under consideration, not committed work:

- Optional collaborative graphs, shared and expanded by more than one person.
- A lightweight API/embed mode for using a generated graph outside of Axium itself.
- Source-grounding for individual nodes — optionally cross-checking AI-generated claims against a real reference (see `server/src/deprecated/` for the retrieval-engine groundwork this could build on).

## Out of scope (for now)

- Manual graph authoring/editing tools. Axium's premise is that the structure is generated, not hand-built; a full authoring UI would be a different product.
- User-generated content moderation infrastructure, until there is an actual need for it (e.g. shared/collaborative graphs shipping).
