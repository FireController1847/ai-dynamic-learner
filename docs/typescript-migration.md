# TypeScript migration

The JavaScript-to-TypeScript migration is complete on `migration/typescript`. The pre-migration webpack baseline remains available on `migration/webpack`.

## Final state

All owned browser implementation modules under `src/` are strict TypeScript. Build configuration, page metadata generation, site configuration, and the production preview server use `.mts` where they run directly under Node.js 24.

`tsconfig.json` contains the shared strict options. `tsconfig.app.json` checks browser source and `tsconfig.node.json` checks Node/build tooling. There is no `allowJs` or `checkJs` migration boundary left. Webpack enters through `src/app/app.ts`; `ts-loader` compiles TypeScript and rewrites explicit `.ts` imports for the browser bundle.

The migration also established typed contracts at the existing module boundaries rather than changing product behavior:

- Workspace imports are accepted as `unknown` and narrowed through the version-1 workspace validator before replacing live state.
- Index Cards exports typed card, tree, display, and review-facing contracts while preserving legacy card compatibility.
- Notebook exports discriminated document data and typed Markdown/editor boundaries.
- Word Search exports typed puzzle, game, placement, display, and library contracts while preserving saved-game compatibility.
- Vue components use typed props, emits, DOM refs, and narrowed browser event targets.
- Tips/tutorial coordination is split into focused typed modules instead of one monolithic implementation.

## Compatibility

The migration does not intentionally change workspace storage keys, backup format version, feature IDs, route paths, or saved-data semantics. Existing version-1 backups continue to pass through the same compatibility normalization and runtime validation boundaries.

TypeScript types are not treated as validation for external data. Uploaded backups, persisted browser data, file contents, and other untrusted values continue to be validated at runtime before use.

## Verification policy

Repository verification is manual by default. Do not add or run automated tests, builds, browser checks, or other automated verification unless the user explicitly requests it; see `AGENTS.md`.

When automated verification is explicitly requested, the available checks are:

```sh
npm ci
npm run typecheck
npm run build
```

For the production Pages path, the build can additionally be prepared with:

```sh
PAGES_BASE_PATH=/ai-dynamic-learner PAGES_BASE_URL=https://firecontroller1847.github.io/ai-dynamic-learner/ npm run pages:prepare
npm run preview
```

A focused manual migration pass should cover direct route loads/reloads, navigation, backup export/import replacement, Index Cards editing/review/display preferences, Notebook Markdown editing/preview/Contents/import/export, Word Search creation/editing/play/display preferences, and the Tips flows touched by the extracted coordinator modules.
