# Workspace data

`src/app/workspace.js` owns one reactive workspace. It saves under `dynamic-learner.workspace.v1` in `localStorage`, scoped to the browser and site origin. Changing host or port uses different browser storage. There is no server-side storage or cross-device synchronization; use a downloaded backup to transfer data. Simultaneous tabs are not synchronized, so edit in one tab at a time.

## Backup format

Downloads are JSON files containing the current canonical workspace:

```json
{
  "format": "dynamic-learner",
  "version": 1,
  "features": {
    "notebook": { "items": [] },
    "index-cards": { "items": [] },
    "word-search": { "items": [] }
  }
}
```

Each directory entry has an `id`, `kind` (`group` or `set`), and `name`. A group has an ordered `children` array containing groups and sets. A set has an ordered `cards` array. Each card contains `id`, `front`, and `back`, plus optional `title` (front) and `backTitle` fields. Both sides and their titles are plain text; side content can include line breaks. New cards include two empty titles, each limited to 120 characters. Older cards remain valid: their existing `title` stays on the front and a missing `backTitle` displays as blank. Empty text is valid. Existing version-1 backups with empty sets or untitled cards remain valid without conversion. Array position is the manual order, including at the root; there is no alphabetical sorting or duplicate order field. IDs are unique across groups, sets, and cards and do not change on edit or move.

Backups include all currently implemented feature data. Notebook stores its grouped document library and each document's persistent type-owned data. Index Cards stores groups, sets, names, nesting, order, and both titles and both sides of every card. Word Search stores its library hierarchy of groups and word-search records. URLs, open groups, selected groups, current card/side, active review status, review starting side and order, unfinished rename text, and drawer visibility are temporary UI state, not backup content. Resized Library and Cards panel widths are remembered separately in browser-local UI preferences and are also excluded from backups. Icons and app identity remain application code, not user data.

Version-1 backups created before Notebook or Word Search persistence may omit those feature records entirely; loading one adds the missing library in memory without requiring a format-version migration.

Notebook document records contain `id`, `kind: "document"`, `name`, a stable `type` ID, and a `data` object owned by that document type. The initial type catalog is `markdown`, `lined`, `grid`, and `graph`. New documents currently default to `markdown` until a document-type picker is added. Markdown data stores `{ "markdown": "..." }`; the non-Markdown types currently store an empty object because their editors and content schemas have not been implemented yet. Unsupported type IDs, unexpected record keys, and editor data outside the currently defined schema reject an uploaded backup.

Notebook documents created before document types were introduced used a top-level `markdown` string. Loading one normalizes it in memory to `type: "markdown"` with `data.markdown` while preserving the text. This is a version-1 compatibility normalization rather than a workspace format-version change; the next normal save or downloaded backup uses the canonical typed shape.

The optional `lastSelectedSetId` field remembers the last opened set through the existing local-save and backup flow. It is a valid ID string or null; older backups may omit it. On a fresh page load, a surviving set is reopened and its parent groups are expanded. Selecting a group does not overwrite the remembered set. Deleted or unavailable references are cleared; selecting a surviving fallback set remembers that set instead. Card position, side, and review state are not persisted: a restored set opens at the first saved card, front side, outside review.

## Mutation and validation

Index Cards may also contain a `display` object, shared by all sets. It is optional for compatibility with older version-1 backups. When present, it contains exactly `font` (`serif` or `sans`), `textSize` (80–130 in steps of 5), `cardSize` (75–125 in steps of 5), `ink` (`pencil`, `dark`, or `black`), and `baseline` (integer -4–6 pixels). Defaults are defined in `display-options.js`, not duplicated in stored data until settings are changed. Percentages are relative to the standard card/text scale. Unknown keys, missing fields, wrong types, and out-of-range values reject the backup before replacement. Display options use the existing local save and backup flow.

New groups and sets are created relative to the current selection: a selected group receives the new item at the start of its children, a selected set receives the new item immediately after it among its siblings, and no selection inserts at the start of the root array. Moves preserve a group's entire subtree, reject self/descendant destinations, and maintain the destination's manual order. Names are limited to 120 characters; a blank rename preserves the previous name. The workspace supports up to 5,000 entries and 32 levels of nesting.

Word Search groups and word-search records use their own IDs and ordered hierarchy. Groups may contain groups or word searches, up to 32 levels deep and 5,000 total library items, including at most 1,000 word searches. Creating a group mutates the library immediately. **New word search** stages a form and appends a record to the chosen destination only on valid submission: the selected group, the selected word search's parent, or the root. Limits and destination existence are checked again when saving. Editing preserves the record ID and location; Cancel discards the draft. Form drafts are not saved in backups.

Word-search records optionally contain `puzzle`, with `words`, `size`, `difficulty`, and `instructions`, plus optional `studyMode` and `hints`. `words` contains 3–40 distinct uppercase A–Z strings, each 2–24 letters and no longer than `size`. The square grid `size` is 10, 15, 20, or 24. Difficulty is `easy` (across/down), `medium` (adds forward diagonals), or `hard` (all eight directions). `instructions` is plain text up to 500 characters, including an empty string. `studyMode` is `words` or `hints`; missing values from older backups resolve to `words`. `hints` maps configured words to plain-text descriptions up to 240 characters. Hint mode requires a nonblank hint for every configured word, while word-list mode may retain optional hints for later reuse. Older version-1 records without `puzzle` or without the newer study fields remain valid. Unknown keys, partial settings, invalid word lists, and unsupported values reject the entire backup before replacement.

An optional `game` stores exactly `rows`, `placements`, and `found`, and requires valid `puzzle` settings. `rows` contains `size` strings, each exactly `size` uppercase English letters. `placements` contains exactly one `{ word, start, end }` for every configured word; endpoints are zero-based row-major cell indices. Every location must spell its word along a straight line in a direction allowed by the difficulty. `found` contains unique `{ word, start, end }` records for discovered words. Found locations may read either way and may identify incidental occurrences in the filler, but must spell a configured word in the actual grid. Imports validate these relationships without regeneration. Missing game data is supported; opening a configured puzzle generates its first grid. Invalid grids, directions, duplicate locations for a word, mismatched letters, or unknown fields reject the backup.

Found words save immediately through the workspace watcher. Start over clears progress on the same grid after confirmation. New layout replaces the grid and clears progress only after generation succeeds; failure preserves the existing game. Changed words, size, or difficulty invalidate the old game on Save; title, instructions, study display, and descriptive-hint edits preserve it. Grid-start hints, per-clue answer reveals, global answer visibility, current selection, focus, and pending restart confirmation are transient and are not saved.

The form accepts words separated by newlines, commas, or semicolons, strips spaces/apostrophes/hyphens, uppercases letters, and combines duplicate normalized words. It previews the exact saved list and reports invalid characters or words too long for the grid. Normalization belongs to form input; imports must already contain canonical words.

Word Search may also contain a feature-level `display` object, separate from library records. It has `font` (`mono`, `sans`, `serif`), optional `weight` (`regular`, `medium`, `semibold`, `bold`), `textSize` (85–125 in steps of 5), `cellSize` (30–48 pixels in steps of 2), `fit` (`screen`, `preferred`), `highlight` (`blue`, `green`, `purple`), and `motion` (`smooth`, `none`). Defaults come from `word-search/display-options.js`, including 95% text size, regular weight, and instant movement. Older display objects without `weight` use regular weight. Legacy 28px cell preferences remain valid on import and resolve to 30px in the UI; the next settings edit saves the normalized value. Existing explicit text-size and motion choices remain unchanged until edited or reset. Fit mode ignores the saved preferred cell size. Missing display settings in older backups use defaults; partial, unknown, or out-of-range settings reject an upload. Appearance edits save immediately across puzzles and travel in backups without changing grid letters or found words. Measured pixel dimensions, preview state, and pointer positions are not stored.

Manual display checks: change every setting, close with Done and Escape, and confirm trigger focus returns. Reload and restore a backup to check settings persist alongside unchanged puzzle progress; restore an older backup without display settings to check defaults. Upload an invalid display value and confirm no replacement occurs. Reset defaults and verify words, grid, and progress stay intact.

Manual Word Search checks: create a puzzle in a nested group, edit its words/settings, cancel another edit, reload and reopen it, then download and restore a backup. Confirm title, words, grid size, difficulty, instructions, and location survive. Restore an older record without `puzzle` and complete its setup. Try an invalid size, unknown field, duplicate word, or oversized word in an uploaded backup; replacement must be rejected without modifying current data.

Find several words, reload and reopen the puzzle, and round-trip a backup: grid letters and found locations must remain identical. Restore a settings-only record and confirm it generates on opening. Try malformed rows, out-of-range endpoints, invalid solution directions, and a found word whose letters do not match the grid; uploads must fail without replacement. Edit only instructions and confirm progress stays; change words and confirm a fresh game. Cancel both restart actions, then confirm each and inspect the appropriate progress reset.

Empty sets and groups delete immediately. Populated sets and groups open a fullscreen confirmation; Cancel or Escape leaves the directory untouched, while Delete removes the set or the group's entire subtree and saves locally. Selection and expansion state for removed entries are cleared. There is no undo or recycle bin; a previously downloaded backup can restore the workspace through the existing upload flow.

Uploads are limited to 32 MB so downloaded backups can preserve card text even when browser storage fills up. Parsing checks the format/version, allowed fields, unique IDs, names, tree shape, and limits before touching live data. A workspace supports up to 1,000 cards total and 2,000 characters per side. Card data must have valid IDs, string front/back values, and string title/backTitle values if present; unknown fields are rejected. Unsupported versions or feature data are rejected; there is no migration system.

The upload review shows the filename, Index Cards directory/card counts, and Word Search library/search counts. **Replace workspace** applies the entire validated backup, replacing rather than merging the current data. Cancel leaves the current workspace intact. Download the current workspace before replacement if it needs to be retained. Replacement clears cached feature UI and saves the new data locally.

When browser storage is unavailable or full, changes remain in memory and the UI asks the user to download a backup. An unreadable stored workspace is left untouched and automatic writes remain blocked until the user uploads and confirms a valid replacement. Errors do not silently discard the current in-memory workspace.

When extending card data, Notebook document types/data, or saved word searches, update the owning feature validation, workspace format handling, documentation, and manual backup round-trip checklist together.

## Card editing and review

Card text updates the canonical workspace on input and uses the existing local-save watcher. New and duplicated cards are inserted after the current card in the saved array. Duplication copies both titles and both sides and creates a new ID. Forward, backward, and shuffled review never change saved order. Starting a review selects the first card of the chosen sequence and every navigation opens the chosen starting side. Canceling setup does not change the active review. Card deletion is immediate, removes both sides, and selects the next available card or the empty-set view. Current position, visible side, and review settings reset when a different set is selected or the workspace is restored.

The right-hand list displays every card in the selected set in the current review order. Titles and previews of the selected starting side update directly from canonical card data; blank titles use a display-only numbered fallback. List selection reveals the configured starting side, updates the active highlight, and does not change the saved order.

Review activity and its progress display are temporary UI state. Finish review and End review restore front-first, saved-order browsing while keeping the current card selected. Editing remains enabled throughout, and ending a review never rolls back edits or changes the saved card order.

Manually edit different front/back titles, flip repeatedly, duplicate, reload, and download/restore a backup. Check an older backup with only `title`: its front title should remain and its back title should be blank. Test back-first review: the list uses back titles, falling back to card numbers for blank titles without exposing front titles. Invalid or oversized back titles must reject uploads without replacing the workspace.
