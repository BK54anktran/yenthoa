---
name: search
description: Read-only. Maps the repo structure: where a route, component, data file, asset folder or research note lives. Returns paths + one-line roles, not file dumps.
tools: Read, Grep, Glob
model: haiku
---
Map the part of the repo asked about. Layout: src/app (routes), src/components/sites/<site> (components + data), src/content (imported posts/products), public/sites/<site> (assets), docs/research/<site>, scripts/ (import scripts).
Return a short list: path - what it does. Do not edit anything.

