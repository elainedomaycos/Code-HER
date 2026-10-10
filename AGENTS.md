# AGENTS.md — Code:HER

This project is **local-only**. It was scaffolded by Lovable but is no longer
connected to the Lovable editor — do not add Lovable wiring back
(`@lovable.dev/*` packages, `.lovable/`, `*.asset.json` proxies, `__lovable*`
telemetry hooks, `__l5e` asset URLs).

Rules for coding agents:

- `codeHER.md` is the source of truth for scope, architecture, and workflow.
  Read it fully before making changes.
- Install and run with **bun** (`bun install`, `bun run dev`). Do not add
  `package-lock.json`.
- Dev server runs at `http://localhost:8080/` (see `vite.config.ts`).
- Keep commits on a working branch state; do not rewrite published history
  (no force-push, no rebase/amend/squash of pushed commits).
- UI components must never import native/Capacitor plugins directly — all app
  logic goes through `src/services/` (interface + mock + native).
- Strict TypeScript, no `any` without a comment. Unit tests for the state
  machine and the SMS template.
