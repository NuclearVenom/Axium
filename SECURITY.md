# Security Policy

## Supported versions

Axium does not yet have tagged releases; the `main` branch is the only supported line, and security fixes are applied there.

## Reporting a vulnerability

If you believe you've found a security vulnerability in Axium, please **do not** open a public GitHub issue for it.

Instead, use GitHub's private vulnerability reporting for this repository:

1. Go to the [Security tab](https://github.com/NuclearVenom/Axium/security) of the repository.
2. Select **Report a vulnerability**.
3. Include as much detail as you can: the affected component, steps to reproduce, and the potential impact.

This opens a private conversation with the maintainer and keeps the report out of public view until a fix is available.

## Scope

Axium is a knowledge-graph generation tool backed by a third-party AI API (Groq). A few things worth knowing when evaluating impact:

- The application does not implement user authentication or store personal accounts; the primary sensitive value in a typical deployment is the Groq API key held server-side in `server/.env`, which is never exposed to the client.
- Generated content comes from a language model and is not guaranteed to be factually correct — this is a content-quality concern, not a security one, and is tracked separately (see [ROADMAP.md](./ROADMAP.md)).
- Reports involving dependency vulnerabilities (npm advisories) are welcome and can go through the same private channel if they're not already publicly tracked upstream.

## Response expectations

This is a small, actively maintained project without a dedicated security team. Reports will be acknowledged as soon as reasonably possible and kept updated as a fix is developed. Please allow time for a fix to be released before any public disclosure.
