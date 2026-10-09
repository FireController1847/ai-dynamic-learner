# Workspace data

The source validators are canonical. This document records only the durable backup/storage contract and compatibility rules.

## Top-level contract

Workspace persistence is owned by `src/app/workspace.ts` and `workspace-format.ts`.

```ts
interface Workspace {
  format: 'dynamic-learner';
  version: 1;
  statistics?: StatisticsData;
  features: {
    notebook: Notebook;
    'todo-list': TodoLists;
    'index-cards': IndexCards;
    'word-search': WordSearch;
    crossword: Crossword;
    'guide': GuideModel;
    'knowledge-check': KnowledgeCheck;
  };
}
```

The browser-local key is `dynamic-learner.workspace.v1`. JSON backups and saved workspace data are limited to 32 MiB.

Uploaded or persisted data is untrusted: parse as `unknown`, reject unsupported top-level fields/version/format, then delegate to feature validators before replacing live state. Invalid replacement never partially mutates the current workspace.

For version-1 compatibility, missing Notebook, Todo List, Word Search, Crossword, Guide, or Review payloads normalize to empty models. Index Cards remains required because it existed in the original v1 contract. Unknown feature keys are rejected.

## Feature ownership

Each feature owns its saved model and runtime validation:

- Notebook: `src/features/notebook/library-model.ts` and document-type validators.
- Todo List: `src/features/todo-list/library-model.ts` / task model.
- Index Cards: `src/features/index-cards/tree-model.ts` / card and display models. The optional app-level `settings.answerStrictness` applies to every Fill-in-the-Blanks set. Older workspaces without it behave as level 4. Workspaces saved during the short-lived per-set strictness implementation are migrated on load: one consistent legacy value is promoted to the app setting; conflicting legacy values fall back to level 4, and the obsolete per-set fields are removed.
- Word Search: `src/features/word-search/library-model.ts` plus puzzle/game/display models.
- Crossword: `src/features/crossword/library-model.ts` plus puzzle/game/display models.
- Guide: `src/features/guide/library-model.ts`. Each Map guide can optionally save a resumable adventure with the current stop, opened/completed/skipped stop IDs, per-stop revealed bullet counts, and paused status. This progress travels with workspace backups; old maps without it start fresh.
- Review: `src/features/knowledge-check/library-model.ts`, question/options models. Statement items persist in the same ordered question array but carry only display text and are non-scorable. Review set options persist independent Short Answer and Fill-in-the-Blanks strictness levels, shared Quiz/Test assessment defaults (question order, optional question limit, and multiple-choice choice shuffling), Quiz attempts per question, and Test-only time/result settings. Older saved sets normalize missing strictness fields to level 4 and other missing fields to compatible defaults.

Do not duplicate feature schemas in `workspace-format.ts`; it coordinates them.

## Compatibility rules

- Existing valid v1 backups must continue to load unless a deliberate workspace-format migration is introduced.
- Guide is saved under `features.guide`; old backups with `features['study-guide']` migrate on load. New backups emit only the Guide key.
- Additive feature fields should default/normalize safely when older backups omit them.
- Saved IDs, feature IDs, route IDs, and mode IDs are compatibility-sensitive.
- Validation must reject malformed/unknown values rather than silently coercing arbitrary data.
- If changing a persisted shape, update its validator and normalization together.
- A new incompatible top-level format requires a new workspace version plus an explicit migration strategy.

## Saved vs transient state

Statistics are durable workspace data, included in JSON backups. The optional `statistics` field contains a version-1 ledger with an ISO `startedAt`, per-app counters, and per-entry counters/last-activity timestamps keyed by canonical library IDs. Old backups without it normalize to empty statistics; malformed counters, unknown fields/apps/metrics, invalid IDs/timestamps, and oversized entry ledgers are rejected before replacement. Counters are non-negative safe integers. Deleting an entry removes its detailed row while retaining lifetime app/global totals; group totals roll up current descendants without double-counting global activity.

Tracking starts with this feature; earlier activity is not fabricated. Opening visible library content increments an open count, including returning to an app or restoring it after reload; rerenders, edits, flips, and opening Statistics do not count as another entry visit. Index Cards counts card visits separately from completed review passes. Study passes count when every question has been visited and the learner loops or ends/leaves the session. Quiz/Test counts increment once on submission (including timeout), not on abandoned sessions; assessed question/correct totals ignore Statements. Puzzle and adventure completions increment once per run, without recounting already completed restored sessions. Todo counts explicit task-completion actions. Calculator counts successful history additions. Known tutorial review sessions do not contribute learning counters.

Statistics-only changes are excluded from authored-work fingerprints used by backup reminders, while remaining part of a downloaded backup. Upload replaces the complete ledger with the uploaded workspace's history; it does not merge or duplicate counts.

Backups contain authored user content and saved feature preferences. They do **not** automatically contain transient/browser UI state.

Examples normally outside backups: active dialog, most review/study progress, temporary shuffle order, current side of a card, selected navigation tab, theme preference, Tips completion, panel widths/collapse state, and other local UI conveniences.

**Exception:** Guide Map adventures intentionally save the session in the guide model, including opened stops and reveal counts. The camera animation and whether the floating notes panel is currently visible remain transient; reopening a saved adventure shows the map without replaying its cinematic introduction.

If a feature intentionally persists a presentation option as part of its model (for example paper/display settings), that option travels with backups and must be validated.

## Storage failure behavior

If the existing saved workspace cannot be parsed, leave that stored copy untouched and warn the user. If saving later fails because browser storage is unavailable/full, keep the live in-memory state and tell the user to download a backup.

Workspace replacement revalidates a copy, clears protected-storage mode only after validation succeeds, increments the workspace revision, and then saves.

## Backup UI

Download emits the current validated workspace as JSON with a timestamped filename. Upload reads a file, validates it, and replaces the entire workspace only after user review/confirmation in the UI.

Keep import/export behavior centralized; features should not invent separate whole-workspace formats.

## Backup reminder tracking

`dynamic-learner.backup-reminders.v1` is a separate browser-local preference/history key, not part of the workspace contract or the JSON export. It stores the last initiated backup-download time, a SHA-256 fingerprint of the exported authored workspace, the start of the current unbacked-activity period, snooze state, and reminder frequency (default 3 days; off is allowed).

The reminder service compares the current workspace with that exported snapshot. Navigation selection alone does not count as new authored work. An imported workspace is always flagged as needing a fresh backup even if its content matches an earlier download. The browser cannot confirm that a generated download was saved, so UI wording describes downloads as *started*, never as verified backups. Empty workspaces do not trigger reminders.

First-time work starts the clock when saved content appears; already-stored work without metadata gets a quiet immediate reminder instead of a fabricated export date. Urgency rises after 1, 2, and 3 configured intervals. Dismissal lasts the current session; snoozing lasts 24 hours without changing backup history. Study/review sessions suppress the banner; the overdue header indicator remains available.

## Index Cards AI import

AI creation first selects Flash Cards or Fill in the Blanks, then discovers categories from the source material. The first AI response is a `dynamic-learner-index-card-categories` version-1 object with a subject `title` and `categories` containing unique `key`/`title` pairs and a scope `description`. It accepts 1–40 categories and does not create library content.

The user chooses one validated category. The second prompt includes its title and scope and asks for cards only within that category, using the matching source in the AI conversation. Back preserves the category list for another choice. Selection, both prompts, and pasted card JSON remain transient.

Index Cards and Review share validated category lists, remembered outside workspace backups in browser-local history under `dynamic-learner.ui.index-cards.category-history.v1`. The 20 most recent distinct lists are retained across reloads; repeats move to the top. Reuse restores validated category JSON without another paste. History contains category lists and save timestamps, not source documents or AI conversations. Clear history removes the stored lists while preserving the active list and existing card sets. Storage failures leave the current session usable and report that history could not be saved. Category prompts request compact descriptions of 3–8 words, at most 80 characters; validation continues accepting older descriptions up to 500 characters for reuse compatibility.

Both card modes accept bare JSON or a single JSON code block and create a new set at the selected library location without replacing the workspace.

Flash Cards accepts a content-only `dynamic-learner-flash-cards` version-1 object with a set `title` and `cards` containing only `question` and `answer` strings. Questions become fronts and answers become backs.

Fill in the Blanks accepts `dynamic-learner-fill-in-the-blanks` version 1 with a set `title` and `cards` containing only `text` strings. Each card must contain at least one valid `{{answer}}` marker and visible context outside the blanks. Empty/nested/multiline blanks and stray braces are rejected. The text becomes the card front; the back remains blank because answers are embedded in the front. Blank recognition uses the canonical core parser.

Import validation enforces card/name/text limits and remaining workspace capacity before insertion. Front/back titles stay blank and IDs are generated locally. Both modes use the existing Index Cards backup schema and preserve the app's answer-strictness setting. Prompt preferences, pasted JSON, and preview state remain transient.


## Review AI import

Review AI creation chooses overall-subject scope or one category using the shared category picker/history, then configures a question count and integer percentage weights totaling 100%. Defaults are 60% multiple choice, 25% true/false, 15% fill in the blanks, and 0% short answer/statements. The requested count is allocated by largest remainder with a stable type order; disabled types stay at zero. These generation preferences are transient, independent of saved assessment/session settings.

A content-only `dynamic-learner-review` version-1 response includes a `title`, `description`, and `questions`. Each item uses only fields supported by its type. Multiple-choice answers must match a distinct choice; true/false answers use `True`/`False`; fill-in-the-blanks answers remain embedded in valid `{{answer}}` markers with visible context. Statements have no answer, choices, or explanation. Strict import validation enforces the selected item count and type allocation, creates local IDs, and applies the canonical question validator/readiness rules before insertion.

Creation produces a normal knowledge set with the supplied description and existing default set options. It uses the normal saved Review schema and Study/Quiz/Test modes. Existing Index Cards imports remain available independently.
