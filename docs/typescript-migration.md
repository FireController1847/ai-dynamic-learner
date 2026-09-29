# TypeScript migration

The migration is intentionally incremental. Production builds remain usable at each stage. The webpack baseline is preserved on `migration/webpack`; TypeScript work lives on `migration/typescript` until the remaining conversion is complete.

## Current boundary

19 existing implementation modules have been converted to strict TypeScript; 37 JavaScript modules remain. Two new shared TypeScript contracts (`src/core/metadata.ts` and `src/core/validation.ts`) support those modules.

Converted modules cover:

- All neutral utilities in `src/core`, app identity, browser navigation, and canonical feature definitions.
- Index Cards card creation, title lookup, shuffling, and import validation, with exported `Card` and `CardSide` contracts.
- Notebook document types and their discriminated storage contract, Markdown file import/export helpers, safe Markdown rendering/heading metadata, and the Contents component with typed props/events.
- Word Search puzzle settings, generation, saved-game validation, selection matching, and SVG word outlines, with exported puzzle/game/placement/direction contracts.
- Webpack configuration, page metadata generation, site configuration, and the production preview server (`.mts`).

Browser TypeScript is checked with `tsconfig.app.json`; tooling and model tests use `tsconfig.node.json`. The root `tsconfig.json` provides shared options. Use `npm run typecheck` to check both projects. All converted modules use `strict: true`; `allowJs: true` and `checkJs: false` permit the remaining JavaScript, which is not yet type-checked. A passing type check therefore does not mean the full migration is complete.

`ts-loader` checks and compiles TypeScript in webpack, including development rebuilds. Production builds additionally run both type-check projects before bundling. Explicit `.ts`/`.mts` imports support Node 24's native type stripping; webpack resolves `.js` imports rewritten by TypeScript back to `.ts` through `extensionAlias`. Tooling uses erasable syntax and `--disable-interpret`, with no ts-node dependency. Emission belongs to webpack; the standalone checkers use `noEmit`.

## Remaining conversion

Continue from data models outward so Vue props and reactive state can consume real domain contracts:

1. Convert the three hierarchical library/tree models and the two display-options modules. Preserve strict upload validation and compatibility normalization. Reuse `Card`, `NotebookDocument`, `Puzzle`, and `Game`; keep feature-specific contracts beside their owners.
2. Convert `src/app/workspace.js` and workspace tools. Define the canonical version-1 workspace shape and validate imported JSON from `unknown` before replacing live state. Keep browser persistence keys and backup formats unchanged.
3. Convert generic icons, the feature registry, tips/content, and app composition/navigation UI. Convert each remaining feature component with `defineComponent`, typed props/emits, typed DOM refs, and event targets narrowed before use. `markdown-outline.ts` provides a small example.
4. Convert the remaining library, editing, review, display-settings, grid, and feature-entry components. Separate reusable behavior only where it provides a real API; avoid an unrelated redesign or package split.
5. Remove `allowJs` and JavaScript includes only when all owned `.js`/`.mjs` files have been converted and both type-check projects and builds pass. Update routing documentation as each owner is renamed.

Find the remaining source files with:

```sh
rg --files src -g '*.js'
```

Do not rename files wholesale and suppress errors with `@ts-nocheck`, `any`, or disabled strictness. Runtime validation remains necessary even with TypeScript. Use type assertions only after validation or at constrained framework boundaries, such as Vue `PropType` declarations.

## Verification

```sh
npm ci
npm run typecheck
npm test
npm run build
npm start
```

`tests/models.test.mts` covers legacy card imports, duplicate/unknown-field rejection, document data shapes, word normalization, saved-game validation, reverse selections, generation/cancellation, and Pages metadata/path validation. Add focused coverage as the remaining model APIs become typed.

For the production Pages path, run:

```sh
PAGES_BASE_PATH=/ai-dynamic-learner PAGES_BASE_URL=https://firecontroller1847.github.io/ai-dynamic-learner/ npm run pages:prepare
npm run preview
```

Actions continues to build the selected source commit; no committed output or deploy branch is required. Existing webpack artwork/entry-size advisories are nonfatal and are separate from this migration.

Manually check direct routes/reloads, Markdown preview and Contents navigation, card review, Word Search play, display preferences, and backup round trips as their owners are converted. The initial model tests do not replace those browser workflows.
