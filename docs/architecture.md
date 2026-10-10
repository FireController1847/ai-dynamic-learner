# Architecture

This document records durable structure only. Current feature behavior belongs in source; implementation history belongs in Git.

## Runtime

Dynamic Learner is a browser-only Vue 3 application built with webpack and strict TypeScript. `src/app/app.ts` is the browser entry and `src/styles/index.css` is the stylesheet entry. Vue components use render functions; there is no SFC compiler, router library, or global application namespace.

Node.js 24+ runs build tooling. `npm start` launches webpack-dev-server, `npm run typecheck` checks browser and Node configurations, and `npm run build` emits production output to ignored `dist/`.

Markdown preview uses Marked plus DOMPurify. Sanitization stays explicit; generated preview HTML must not become an unchecked route to Vue props, handlers, styles, or arbitrary DOM behavior.

`src/components/markdown-renderer.ts` owns the shared synchronous GFM parser, DOMPurify allowlist, and safe DOM-to-VNode conversion. `MarkdownContent` gives independent rendered regions unique heading IDs; `src/styles/markdown-content.css` owns shared Markdown typography. Notebook retains an adapter for its existing outline heading IDs and paper presentation. Review stores optional question context as Markdown source and renders it separately from the plain-text question title and answer controls.

## Layers

| Layer | Owns | May import |
| --- | --- | --- |
| `src/app` | shell, composition, navigation, workspace coordination, cross-feature browser workflows | app, features, components, core |
| `src/features` | feature UI, models, feature behavior | features, components, core |
| `src/components` | reusable feature-neutral Vue components | components, core |
| `src/core` | feature-neutral utilities/data algorithms | core only |

Never import upward. In particular, `core` never imports Vue/features/app and generic components never import feature code.

Shared behavior belongs below features only when the abstraction is genuinely reusable. Keep canonical data/rules in one place instead of copying them between apps.

## Features and navigation

`src/features/feature-definitions.ts` is the browser-neutral source for feature IDs, labels, versions, paths, groups, descriptions, and metadata artwork. `feature-registry.ts` associates those definitions with Vue components.

The app shell derives the active feature from the canonical path. Home is `/`; each feature has its own slash-terminated route. `src/app/navigation.ts` coordinates History API navigation and leave guards.

When adding a feature:
1. add its definition;
2. register its component;
3. add its workspace data/validator if it persists data;
4. add concise Tips only when useful;
5. update change routing and version docs as needed.

## Shared infrastructure

Important shared modules include:

- `src/core/tree.ts`: generic grouped-tree lookup, movement, deletion, counting, and options.
- `src/core/ids.ts`: IDs and validation.
- `packages/@dynamic-learner/answer-matching/`: reusable strict-to-semantic answer equivalency; `src/core/answer-matching.ts` is a compatibility adapter that preserves the existing level-3 behavior for remaining legacy callers.
- `src/core/fill-blank.ts`: shared blank parsing/masking/restoration/matching.
- `src/core/leave-guards.ts`: feature-provided navigation guards.
- `src/components/use-dialog.ts`: native dialog lifecycle.
- `src/components/delete-confirmation.ts`: shared destructive confirmation.
- `src/components/use-persisted-panel-resize.ts`: shared persisted panel resizing.
- `src/components/ai-prompt-exchange.ts`: common AI prompt/JSON tabs, clipboard handoff, validation/preview slots, and reduced-motion-aware transitions for Guide, Index Cards, and Review. Features own prompt contracts and validators.
- `src/components/ai-category-picker.ts`: category selection shared by Index Cards and Review, using the validated content-only category contract and local history in `src/core/ai-study-categories.ts` / `ai-category-history.ts`. `src/core/ai-json.ts` owns bounded bare/fenced JSON parsing. Review and Index Cards retain their own generated-content validators.
- `src/app/app-icon.ts`: visible 256px app artwork selection (WebP, then PNG, GIF fallback).

Reusable packages live under `packages/`. Tips owns guided-tutorial UI; `@dynamic-learner/answer-matching` owns generic answer equivalency. `src/components/answer-strictness-field.ts` provides the shared 1–4 UI control. Index Cards persists one app-wide Fill-in-the-Blanks strictness value; Review persists separate Short Answer and Fill-in-the-Blanks strictness values per knowledge set.

## Persistence

Workspace statistics use one optional top-level `statistics` ledger validated in `src/core/statistics.ts`. The app provides the live library inventory and statistics context; features record semantic activity events without importing the app layer. Entry counters use canonical library IDs, groups aggregate their current descendants, and global app totals retain activity when entries are deleted. `EntryStatistics` presents compact inline progress notes beside feature-specific actions; `GlobalStatistics` is available from the app header on every route.

The workspace is browser-local. `src/app/workspace.ts` initializes the local-first Data API and coordinates backup/restore. `src/app/data/data-api.ts` owns typed repository operations; `src/core/data/indexeddb.ts` provides IndexedDB transactions, schema upgrades, revisions, and cross-tab invalidation. `src/app/data/workspace-mapping.ts` maps the feature models to granular records and rebuilds the canonical backup model; `workspace-observer.ts` temporarily adapts legacy Vue model mutations into record-level writes. `workspace-format.ts` remains the top-level JSON import/export contract and delegates validation to feature models. Existing localStorage workspace JSON is preserved read-only as a migration recovery source. See `workspace-data.md` and `data-api-design.md`.

Browser-local presentation state that is not part of user content (for example theme choice, panel widths, Tips state, or transient review state) stays outside workspace backups unless explicitly promoted into the saved contract.

## Build and assets

Webpack emits hashed JS/CSS bundles and copies `src/assets/` recursively to `dist/assets/` with stable asset paths. Full-resolution per-app PNGs live directly under `src/assets/app-icons/`; lightweight visible variants live in `app-icons/webp`, `app-icons/png`, and `app-icons/gif`.

`build/site-config.mts` and `build/page-metadata.mts` create route HTML and metadata. GitHub Pages uses the same production build; see `github-pages.md`.


## Review session configuration

Review keeps saved assessment defaults in the knowledge set but transient per-session choices outside persistence. Study always uses the all-questions scrolling layout; Quiz/Test persist separate scroll-or-one-at-a-time layouts and backward-navigation settings in `set-options.ts`. A Quiz may temporarily override its saved layout through Customize Settings; Test has no session override. `knowledge-session.ts` renders question controls from one shared per-question renderer in either a complete vertical list or one-at-a-time flow. `session-state.ts` accepts per-question check targets and prepares all generated variants before starting scrolling sessions, including on resume; older saved parameterized sessions retain one-at-a-time presentation by default. `session-settings.ts` converts saved options into mode-specific runtime settings and prepares a stable question/choice order when a session starts. `session-setup.ts` owns pre-session choices: Study always chooses an order, Quiz chooses saved defaults or temporary customization, and Test bypasses customization and uses saved builder settings exactly.


## Review Statements and Fill-in-the-Blanks import resolution

Review `statement` items use the normal question model/order pipeline but are intentionally non-scorable and require no response. They count toward session length, ordering, limits, and navigation while remaining outside answered/scored denominators. Fill-in-the-Blanks Index Card imports preserve cards with authored blanks normally; visible cards without blanks require an explicit per-card transient decision to convert to Statement or discard before the import is created.

## Parameterized Review questions

`src/core/parameterized/` is a Vue- and subject-independent procedural engine: template rules, seeded RNG, restricted expressions, trusted versioned solver registration, concrete instance generation, and computed answer matching. Review's `parameterized-model.ts` adapts generated instances into the existing question/feedback/scoring pipeline. The editor uses focused variable/answer controls with an advanced JSON escape hatch; template strings stay canonical in the question's prompt/context/explanation.

`parameterized-session.ts` owns the bounded browser-local session snapshot and deterministic choice order. `session-state.ts` generates a question on first presentation, caches it for retries/revisits, and saves template snapshots plus effective seeds and session state. Static-only sessions retain transient behavior. Templates are workspace content; generated instances are runtime data and are never saved into the authored question array. See `parameterized-questions.md` for the extension contract.

Uploaded solver definitions live inside their question's `rules.solver.package`; they never register as trusted application functions. `solver-package.ts` owns metadata/result validation and `solver-sandbox.ts` owns the browser boundary (opaque sandbox frame, inherited restrictive CSP, dedicated Worker, cancellation/time limits). The core generator shares one procedural pipeline between its synchronous trusted entry point and asynchronous uploaded-code entry point. `solver-editor.ts` handles upload/selection/input mappings; `ai-parameterized-format.ts` owns the AI solver contract and reference resolution. Resumable generated sessions retain validated concrete instances alongside templates/seeds, avoiding code re-execution for already presented questions.


Study question selection: `session-settings.ts` uses contiguous-section sampling when Study's configured question limit is smaller than the authored set, one draw from each section before applying requested display order. `session-state.ts` generates the sample only on Start; generated question templates remain stable while navigating. In revisitable one-at-a-time Quiz, `knowledge-session.ts` clears finalized status and prior feedback upon answer revision so checking and per-question score state remain coherent.


`parameterized-session.ts` is also Review's validated, bounded browser-local session persistence layer. Explicit Study and untimed Quiz pauses serialize the existing session fields, including static-only question sets, using `paused: true`; the mode picker only advertises snapshots with this flag. `knowledge-set.ts` routes the paused mode directly back to the saved effective settings, and `knowledge-session.ts` resumes rather than rebuilding the randomized session. Ordinary sessions cease being marked paused on resume; automatic generated-session interruption recovery remains separate.
