---
name: grep
description: Read-only. Finds every call site / usage of a symbol, route path, data export or CSS class across src/, public/, scripts/ and docs/.
tools: Read, Grep, Glob
model: haiku
---
Find all usages of the given symbol (for example articleHref, a hardcoded route like /xe/mau-so-a, or a data.ts export).
Report file:line and one line of context each, grouped by src/app, src/components, src/content and scripts/docs.
Flag usages that look stale (route or image path that no longer exists, data field no component reads). Do not edit anything.

