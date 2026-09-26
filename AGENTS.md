# Maintenance rules

- Runtime: `npm start` runs `node server.mjs`; `HOST` and `PORT` override `127.0.0.1:3000`. No build step, bundler, TypeScript, or compiled Vue single-file components.
- Read [docs/change-routing.md](docs/change-routing.md) before changing code. Read [docs/architecture.md](docs/architecture.md) for dependency or structural changes, not every routine edit.
- Start with the smallest relevant file set. Use targeted `rg` searches and file discovery before reading directories; expand only when imports or behavior require it. Search by stable identifiers, exports, and field keys. Do not load every document, feature, or schema for a local change.
- Keep composition, root Vue state, and browser workflow coordination in `app`; feature behavior in `features`; generic components in `components`; neutral utilities in `core`. Lower layers never import from `app`. Generic components import only `core` or other generic components; `core` never imports upper layers.
- Register future features in `src/features/feature-registry.js`. Use ES module exports instead of new application globals. Vue owns reactive state and UI rendering; isolate imperative browser operations when needed. Keep schemas declarative and shared data canonical.
- Prefer focused modules below 400 lines; split large schemas by section around 500 lines. Split by responsibility, avoiding monoliths and unnecessary one-function wrappers.
- Make focused edits without unrelated refactors or formatting churn. Keep tool output bounded and progress updates concise.
- Update routing documentation when file ownership changes. Add specialized documentation and infrastructure only when corresponding functionality exists.
- Verification is manual unless the user explicitly requests automated checks. Do not run builds, tests, browser checks, or other automated verification without that request. Provide a focused manual checklist at handoff.
