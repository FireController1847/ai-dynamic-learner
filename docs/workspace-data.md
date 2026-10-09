# Workspace data

The source validators are canonical. This document records only the durable backup/storage contract and compatibility rules.

## Top-level contract

The live workspace is stored as granular records in IndexedDB (`src/core/data/indexeddb.ts`), coordinated by `src/app/data/data-api.ts` and the transitional `src/app/data/workspace-observer.ts`. `workspace-format.ts` remains the portable JSON v1 interchange contract.

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

The legacy browser-local key `dynamic-learner.workspace.v1` is used only as a read-only migration/recovery source. IndexedDB `dynamic-learner-data` is authoritative after successful staged migration. The 32 MiB cap applies to uploaded JSON backups, **not** to ongoing IndexedDB writes; compressed backup support and a revised import limit remain separate work.

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

Word Search additionally records lifetime `wordsSolved` and `wordAttempts` counters per entry and globally. Each submitted selection counts as an attempt, including misses, invalid lines, and already-found words; canceled selections and actions blocked during loading or answer reveal do not count. A word is solved only when newly added to the current run's found list. Restarting permits solving those words again. Existing backups without these optional counters display zero; saved found-word progress is not retroactively counted.

Backups contain authored user content and saved feature preferences. They do **not** automatically contain transient/browser UI state.

Examples normally outside backups: active dialog, most review/study progress, temporary shuffle order, current side of a card, selected navigation tab, theme preference, Tips completion, panel widths/collapse state, and other local UI conveniences.

**Exception:** Guide Map adventures intentionally save the session in the guide model, including opened stops and reveal counts. The camera animation and whether the floating notes panel is currently visible remain transient; reopening a saved adventure shows the map without replaying its cinematic introduction.

If a feature intentionally persists a presentation option as part of its model (for example paper/display settings), that option travels with backups and must be validated.

## Storage failure behavior

If the legacy JSON cannot be parsed or IndexedDB fails to initialize, editing is blocked; the existing saved copy is never erased. After cutover, individual record writes commit through IndexedDB transactions. A failed save retains the in-memory user work and exposes an emergency backup path, without claiming it was saved to IndexedDB.

Backup replacement validates the entire workspace first, stages and independently verifies all records under a new workspace ID, then atomically switches the active-workspace pointer. Stale tabs' writes against the previous workspace are rejected.

## Backup UI

Download captures a consistent IndexedDB snapshot and emits the validated v1 workspace as timestamped JSON; in-memory emergency export is available if a record save fails. Upload reads and validates JSON, stages it, and replaces the active workspace only after user review/confirmation in the UI.

Keep import/export behavior centralized; features should not invent separate whole-workspace formats.

## Backup reminder tracking

`dynamic-learner.backup-reminders.v1` is a separate browser-local preference/history key, not part of the workspace contract or JSON export. It now stores the **last exported authored revision**, the last initiated backup-download time, the start of unbacked activity, snooze state and reminder frequency (default 3 days; off is allowed). Old SHA-256 fingerprint metadata is accepted for compatibility but no longer recomputed on ordinary edits.

The reminder service compares committed authored revisions with the exact revision included in the exported snapshot. Statistics and navigation selection do not count as authored changes. An imported workspace is always flagged as needing a fresh backup even if its revision happens to match an earlier export. The browser cannot confirm that a generated download was saved, so UI wording describes downloads as *started*, never as verified backups. Empty workspaces do not trigger reminders.

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

Every Review question may carry an optional plain-string `context` field of up to 12,000 characters containing GFM Markdown. Older questions without it remain valid. Context is supporting/descriptive material, separate from the required plain-text `prompt` and answer/explanation fields; it has no scoring or readiness effect except that an entered context makes a draft meaningful and still requires a complete question. Markdown is sanitized and converted into allowlisted VNodes at display time, never stored as trusted HTML. Context travels with normal backups and AI imports.

Study/Quiz/Test show context beneath the question title. Fill-in-the-Blanks keeps its canonical blank-aware prompt and shows optional context above it; Markdown does not replace blank parsing or answer matching. Full results and AI previews also render context; score-only Test results keep question content hidden. Builder context previews use the same shared renderer as Notebook, including tables, lists, code, links, task lists, and strikethrough.

Review also supports `dropdown` matching questions. They use one shared `choices` list (2–20 distinct non-empty choices when ready) and a `matches` array of 1–20 `{ label, answer }` rows. Row labels must be distinct and non-empty; every correct row answer must match a choice. The top-level `answer` remains empty. `matches` is allowed only on Dropdown questions; old question types/backups remain unchanged. Builder drafts deep-copy rows so canceling edits cannot change a saved set.

Dropdown responses are ordered arrays of selected choice text. The question is answered after every row has a selection and scores one point only when every match is correct; feedback reports individual matches. Choices may be reused across rows. Saved answer-choice shuffling also shuffles Dropdown options once per session while retaining label order and answer mappings. Study hints/reveals, Quiz attempts/locking, and Test result visibility apply normally. AI creation includes a Dropdown percentage, defaulting to 5%; generated Dropdown JSON supplies `choices` and `matches` without a top-level answer.

Review AI creation chooses overall-subject scope or one category using the shared category picker/history, then configures a question count and integer percentage weights always totaling 100%. Editing one weight immediately redistributes its change evenly across the other types, respecting 0–100 bounds and assigning whole-point rounding remainders in a stable type order. Decreasing a weight can enable previously zero-weight types; increasing one draws only from types with available weight. Empty or invalid input retains the current weight, and numeric input is rounded/clamped before the complete mix is replaced atomically. Defaults are 58% multiple choice, 23% true/false, 14% fill in the blanks, 5% Dropdown, and 0% short answer/statements. The requested count is allocated by largest remainder with a stable type order; disabled types stay at zero. These generation preferences are transient, independent of saved assessment/session settings.

A content-only `dynamic-learner-review` version-1 response includes a `title`, `description`, and `questions`. Each item uses only fields supported by its type. Multiple-choice answers must match a distinct choice; true/false answers use `True`/`False`; fill-in-the-blanks answers remain embedded in valid `{{answer}}` markers with visible context. Statements have no answer, choices, or explanation. Strict import validation enforces the selected item count and type allocation, creates local IDs, and applies the canonical question validator/readiness rules before insertion.

Creation produces a normal knowledge set with the supplied description and existing default set options. It uses the normal saved Review schema and Study/Quiz/Test modes. Existing Index Cards imports remain available independently.
