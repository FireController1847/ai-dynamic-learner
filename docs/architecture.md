# Architecture

This document records durable structure only. Current feature behavior belongs in source; implementation history belongs in Git.

## Runtime

Dynamic Learner is a browser-only Vue 3 application built with webpack and strict TypeScript. `src/app/app.ts` is the browser entry and `src/styles/index.css` is the stylesheet entry. Vue components use render functions; there is no SFC compiler, router library, or global application namespace.

Node.js 24+ runs build tooling. `npm start` launches webpack-dev-server, `npm run typecheck` checks browser and Node configurations, and `npm run build` emits production output to ignored `dist/`.

Markdown preview uses Marked plus DOMPurify. Sanitization stays explicit; generated preview HTML must not become an unchecked route to Vue props, handlers, styles, or arbitrary DOM behavior.

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
- `src/app/app-icon.ts`: visible 256px app artwork selection (WebP, then PNG, GIF fallback).

Reusable packages live under `packages/`. Tips owns guided-tutorial UI; `@dynamic-learner/answer-matching` owns generic answer equivalency. `src/components/answer-strictness-field.ts` provides the shared 1–4 UI control. Index Cards persists one app-wide Fill-in-the-Blanks strictness value; Review persists separate Short Answer and Fill-in-the-Blanks strictness values per knowledge set.

## Persistence

The workspace is browser-local. `src/app/workspace.ts` owns localStorage, import/export, and replacement; `workspace-format.ts` owns the top-level backup contract and delegates feature validation to feature models. See `workspace-data.md`.

Browser-local presentation state that is not part of user content (for example theme choice, panel widths, Tips state, or transient review state) stays outside workspace backups unless explicitly promoted into the saved contract.

## Build and assets

Webpack emits hashed JS/CSS bundles and copies `src/assets/` recursively to `dist/assets/` with stable asset paths. Full-resolution per-app PNGs live directly under `src/assets/app-icons/`; lightweight visible variants live in `app-icons/webp`, `app-icons/png`, and `app-icons/gif`.

`build/site-config.mts` and `build/page-metadata.mts` create route HTML and metadata. GitHub Pages uses the same production build; see `github-pages.md`.


## Review session configuration

Review keeps saved assessment defaults in the knowledge set but transient per-session choices outside persistence. `session-settings.ts` converts saved options into mode-specific runtime settings and prepares a stable question/choice order when a session starts. `session-setup.ts` owns pre-session choices: Study always chooses an order, Quiz chooses saved defaults or temporary customization, and Test bypasses customization and uses saved builder settings exactly.
