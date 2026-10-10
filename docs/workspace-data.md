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

The legacy browser-local key `dynamic-learner.workspace.v1` is used only as a read-only migration/recovery source. IndexedDB `dynamic-learner-data` is authoritative after successful staged migration. The 128 MiB cap applies to uploaded JSON backups, **not** to ongoing IndexedDB writes; compressed backup support and a revised import limit remain separate work.

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
- Review: `src/features/knowledge-check/library-model.ts`, question/options models. Statement items persist in the same ordered question array but carry only display text and are non-scorable. Review set options persist separate Quiz/Test presentation (all questions or one at a time) and one-at-a-time backward-navigation preferences, defaulting to scrolling for existing sets. Review set options persist independent Short Answer and Fill-in-the-Blanks strictness levels, shared Quiz/Test assessment defaults (question order, optional question limit, and multiple-choice choice shuffling), Quiz attempts per question, and Test-only time/result settings. Older saved sets normalize missing strictness fields to level 4 and other missing fields to compatible defaults.

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

Changes committed in another tab are broadcast as invalidations and fetched from the same-origin IndexedDB database. For normal updates to the **same workspace**, the app applies the newly saved data **in place** to existing Vue objects, including items added, deleted, reordered, or edited. Current editors stay mounted, so users can keep working in one tab while changes appear in the other. Each tab retains its own selected library item instead of following the other tab's navigation. Active study sessions defer incoming data until they end.

Before integrating a remote snapshot, the app flushes pending local saves and checks for any additional typing that occurred while the snapshot was loading. Independent edits synchronize automatically. If both tabs race to save incompatible changes to the **same record**, revision checks still reject the stale write; the on-screen draft is preserved with an explicit export/recovery option. A full workspace restore is not a live merge and continues to require special protection for locally focused drafts.

When a record save or cross-tab reconciliation fails, the app preserves the visible in-memory workspace and offers **Download unsaved draft**. The user can then explicitly confirm **Discard draft and reload** to load the latest committed IndexedDB workspace; it never silently merges or overwrites simultaneous edits to the same record. Another tab upgrading the IndexedDB schema produces a warning advising a draft download and page reload.



If the legacy JSON cannot be parsed or IndexedDB fails to initialize, editing is blocked; the existing saved copy is never erased. A valid user-confirmed upload may recover a failed initialization by staging and activating a verified replacement without deleting the previous copy. After cutover, individual record writes commit through IndexedDB transactions. A failed save retains the in-memory user work and exposes an emergency backup path, without claiming it was saved to IndexedDB.

Backup replacement validates the entire workspace first, stages and independently verifies all records under a new workspace ID, then atomically switches the active-workspace pointer. Stale tabs' writes against the previous workspace are rejected.

## Backup UI

Download captures a consistent IndexedDB snapshot and emits the validated v1 workspace as timestamped JSON; in-memory emergency export is available if a record save fails. Upload reads and validates JSON, stages it, and replaces the active workspace only after user review/confirmation in the UI.

Keep import/export behavior centralized; features should not invent separate whole-workspace formats.

## Backup reminder tracking

`dynamic-learner.backup-reminders.v1` is a separate browser-local preference/history key, not part of the workspace contract or JSON export. It now stores the **last exported workspace identity and authored revision**, the last initiated backup-download time, the start of unbacked activity, snooze state and reminder frequency (default 3 days; off is allowed). Old SHA-256 fingerprint metadata is accepted for compatibility but no longer recomputed on ordinary edits.

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

Review AI creation chooses overall-subject scope or one category using the shared category picker/history, then configures a question count and integer percentage weights always totaling 100%. Single-percentage edits are drafts until blur or Enter, then replace the mix atomically after redistributing the change evenly across only the other currently enabled types. Types at 0% remain excluded unless explicitly edited above 0. The last enabled type stays at 100% until another is enabled. Empty/invalid input retains the current value; numeric input is rounded/clamped. Equalize enabled types divides 100 across only the enabled types, with deterministic whole-point rounding. Edit whole mix permits independent relative-weight drafts, previews a proportional normalization to 100%, and commits only with Apply mix; Cancel leaves the active mix unchanged. Zero/blank relative weights remain excluded; all-zero or invalid drafts cannot be applied. The active percentage mix always remains at 100%. Defaults are 58% multiple choice, 23% true/false, 14% fill in the blanks, 5% Dropdown, and 0% short answer/statements. The requested count is allocated by largest remainder with a stable type order; disabled types stay at zero. These generation preferences are transient, independent of saved assessment/session settings.

A content-only `dynamic-learner-review` version-1 response includes a `title`, `description`, and `questions`. Each item uses only fields supported by its type. Multiple-choice answers must match a distinct choice; true/false answers use `True`/`False`; fill-in-the-blanks answers remain embedded in valid `{{answer}}` markers with visible context. Statements have no answer, choices, or explanation. Import validation enforces supported schemas, 1–200 items, and canonical question validator/readiness rules, creating local IDs before insertion. Differences from the selected count or type allocation (including otherwise supported types disabled in the current mix) are non-blocking preview warnings. The user may create the knowledge set anyway without dropping or rewriting questions. Valid unused solver packages also produce a warning and are not retained; malformed or conflicting solver data remains blocked. Warnings are transient preview metadata, outside the saved knowledge set.

Creation produces a normal knowledge set with the supplied description and existing default set options. It uses the normal saved Review schema and Study/Quiz/Test modes. Existing Index Cards imports remain available independently.

## Parameterized Review templates and sessions

Review's additive `parameterized` question type persists `parameters` containing a presentation, version-1 generation rules, and optional dropdown rows. The canonical prompt, context, and explanation become templates; `answer` is empty and `choices` is empty. Rules persist numeric ranges, scalar selections, derived expressions, constraints, computed answer definitions, tolerances/formatting, calculated distractors, and optional versioned solver references/parameter expressions. Existing static types retain their schemas; `parameters` is forbidden on static questions. Runtime `generated` metadata is rejected by workspace question validation.

Mixed/generated sessions use a separate bounded browser-local `dynamic-learner.review.generated-session.v1:<setId>:<mode>` snapshot, outside backups. It saves ordered template copies, effective seeds, settings, response/feedback/attempt state, position, study counters/pass state, and an absolute test deadline. Restore validates unknown data before regenerating answers; missing or changed solver versions produce an explicit error. Choice shuffling uses a separate seeded stream. Reload resumes only after the learner selects Resume saved session; timed tests submit on resume if their deadline passed. Explicit End discards the snapshot; Start replaces it with a fresh run. Completed assessment results can also be restored without recounting submissions.

Only sessions containing parameterized questions are saved. Storage failures report a message while keeping the live session usable. No source document, arbitrary executable code, or generated trusted HTML is stored. Template edits do not rewrite an interrupted session's captured templates. Solver registration is trusted application code, not imported data.

### Uploaded Review solver packages

A solver reference may additionally contain `package`, a version-1 `dynamic-learner-solver` object with bounded id/solverVersion/label/output names and JavaScript function `source` text (64 KiB maximum). Package identity must match its solver reference. These self-contained definitions travel in authored question records and workspace backups; validation never executes source. Same-set editor choices reuse referenced packages, while unreferenced draft uploads are not separately persisted. Uploaded definitions never enter the global trusted TypeScript solver registry.

Generated-session snapshots now optionally include validated `instances` keyed by question ID, with seed/attempt, scalar values, rendered text, formatted answers/tolerances, choices, and trace. Instance seeds, answer keys/order, and formatting/tolerances must match the saved template. Older seed-only snapshots remain compatible; new snapshots replay the observed instance rather than invoking uploaded code again. Storage remains bounded and outside workspace backups.

Review AI import optionally accepts up to 20 solver packages in a top-level `solvers` array, resolving id/version references into embedded packages atomically before creating a set. Missing, duplicate, conflicting, or malformed packages are rejected; valid unused packages produce a warning and are omitted. The Parameterized mix weight defaults to 0%; prior percentage defaults stay unchanged.


## Paused Review sessions

Study and untimed Quiz can explicitly pause and resume on the same browser. The existing bounded `dynamic-learner.review.generated-session.v1:<setId>:<mode>` snapshot format adds an optional `paused` flag. For ordinary (non-parameterized) question sets, snapshot validation permits saved templates **only** when `paused: true`; historical automatically saved parameterized sessions remain compatible. Snapshots retain ordered templates, selected answers, checked feedback/attempts, hints/reveals, session settings, and Study counters. Resume consumes ordinary paused snapshots so the mode picker doesn't falsely report them as paused while live. Test never offers Pause; builder edits invalidate previous Study/Quiz pauses to prevent stale questions from reappearing. Pause data is browser-local transient session state, not part of workspace backups.


Review session snapshot `flagged?: string[]` stores session-only flagged question IDs alongside answers, checks and hints. Validation accepts the missing field in older snapshots, but rejects unknown, repeated, or malformed question IDs. Flags are restored with Pause/Resume and generated-question recovery; they are never part of authored knowledge sets or graded scores.


Review Multiple Choice adds an optional `correctAnswers: string[]` question property. Absence means the legacy single-answer `answer: string` and radio-button response; presence switches to checkbox responses and requires `answer: ''`. This remains an optional backward-compatible field in workspace question records and paused-session templates; selected responses already use the existing `string | string[]` representation. Review AI JSON import accepts `correctAnswers` instead of `answer` for multi-answer Multiple Choice, while existing imports remain unchanged.
