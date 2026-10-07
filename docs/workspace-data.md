# Workspace data

The source validators are canonical. This document records only the durable backup/storage contract and compatibility rules.

## Top-level contract

Workspace persistence is owned by `src/app/workspace.ts` and `workspace-format.ts`.

```ts
interface Workspace {
  format: 'dynamic-learner';
  version: 1;
  features: {
    notebook: Notebook;
    'todo-list': TodoLists;
    'index-cards': IndexCards;
    'word-search': WordSearch;
    crossword: Crossword;
    'study-guide': StudyGuideModel;
    'knowledge-check': KnowledgeCheck;
  };
}
```

The browser-local key is `dynamic-learner.workspace.v1`. JSON backups and saved workspace data are limited to 32 MiB.

Uploaded or persisted data is untrusted: parse as `unknown`, reject unsupported top-level fields/version/format, then delegate to feature validators before replacing live state. Invalid replacement never partially mutates the current workspace.

For version-1 compatibility, missing Notebook, Todo List, Word Search, Crossword, Study Guide, or Review payloads normalize to empty models. Index Cards remains required because it existed in the original v1 contract. Unknown feature keys are rejected.

## Feature ownership

Each feature owns its saved model and runtime validation:

- Notebook: `src/features/notebook/library-model.ts` and document-type validators.
- Todo List: `src/features/todo-list/library-model.ts` / task model.
- Index Cards: `src/features/index-cards/tree-model.ts` / card and display models. The optional app-level `settings.answerStrictness` applies to every Fill-in-the-Blanks set; older workspaces without it behave as level 4.
- Word Search: `src/features/word-search/library-model.ts` plus puzzle/game/display models.
- Crossword: `src/features/crossword/library-model.ts` plus puzzle/game/display models.
- Study Guide: `src/features/study-guide/library-model.ts`.
- Review: `src/features/knowledge-check/library-model.ts`, question/options models. Review set options persist independent Short Answer and Fill-in-the-Blanks strictness levels, shared Quiz/Test assessment defaults (question order, optional question limit, and multiple-choice choice shuffling), Quiz attempts per question, and Test-only time/result settings. Older saved sets normalize missing strictness fields to level 4 and other missing fields to compatible defaults.

Do not duplicate feature schemas in `workspace-format.ts`; it coordinates them.

## Compatibility rules

- Existing valid v1 backups must continue to load unless a deliberate workspace-format migration is introduced.
- Additive feature fields should default/normalize safely when older backups omit them.
- Saved IDs, feature IDs, route IDs, and mode IDs are compatibility-sensitive.
- Validation must reject malformed/unknown values rather than silently coercing arbitrary data.
- If changing a persisted shape, update its validator and normalization together.
- A new incompatible top-level format requires a new workspace version plus an explicit migration strategy.

## Saved vs transient state

Backups contain authored user content and saved feature preferences. They do **not** automatically contain transient/browser UI state.

Examples normally outside backups: active dialog, current review/study progress, temporary shuffle order, current side of a card, selected navigation tab, theme preference, Tips completion, panel widths/collapse state, and other local UI conveniences.

If a feature intentionally persists a presentation option as part of its model (for example paper/display settings), that option travels with backups and must be validated.

## Storage failure behavior

If the existing saved workspace cannot be parsed, leave that stored copy untouched and warn the user. If saving later fails because browser storage is unavailable/full, keep the live in-memory state and tell the user to download a backup.

Workspace replacement revalidates a copy, clears protected-storage mode only after validation succeeds, increments the workspace revision, and then saves.

## Backup UI

Download emits the current validated workspace as JSON with a timestamped filename. Upload reads a file, validates it, and replaces the entire workspace only after user review/confirmation in the UI.

Keep import/export behavior centralized; features should not invent separate whole-workspace formats.
