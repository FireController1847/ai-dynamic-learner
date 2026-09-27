# Workspace data

`src/app/workspace.js` owns one reactive workspace. It saves under `dynamic-learner.workspace.v1` in `localStorage`, scoped to the browser and site origin. Changing host or port uses different browser storage. There is no server-side storage or cross-device synchronization; use a downloaded backup to transfer data. Simultaneous tabs are not synchronized, so edit in one tab at a time.

## Backup format

Downloads are JSON files containing the current canonical workspace:

```json
{
  "format": "dynamic-learner",
  "version": 1,
  "features": {
    "index-cards": { "items": [] },
    "word-search": { "items": [] }
  }
}
```

Each directory entry has an `id`, `kind` (`group` or `set`), and `name`. A group has an ordered `children` array containing groups and sets. A set has an ordered `cards` array. Each card contains `id`, `front`, and `back`, plus optional `title` (front) and `backTitle` fields. Both sides and their titles are plain text; side content can include line breaks. New cards include two empty titles, each limited to 120 characters. Older cards remain valid: their existing `title` stays on the front and a missing `backTitle` displays as blank. Empty text is valid. Existing version-1 backups with empty sets or untitled cards remain valid without conversion. Array position is the manual order, including at the root; there is no alphabetical sorting or duplicate order field. IDs are unique across groups, sets, and cards and do not change on edit or move.

Backups include all currently implemented feature data. Index Cards stores groups, sets, names, nesting, order, and both titles and both sides of every card. Word Search stores its library hierarchy of groups and word-search records. URLs, open groups, selected groups, current card/side, active review status, review starting side and order, unfinished rename text, and drawer visibility are temporary UI state, not backup content. Resized Library and Cards panel widths are remembered separately in browser-local UI preferences and are also excluded from backups. Icons and app identity remain application code, not user data.

Version-1 backups created before Word Search persistence may omit the `word-search` feature entirely; loading one adds an empty Word Search library in memory without requiring a format-version migration.

The optional `lastSelectedSetId` field remembers the last opened set through the existing local-save and backup flow. It is a valid ID string or null; older backups may omit it. On a fresh page load, a surviving set is reopened and its parent groups are expanded. Selecting a group does not overwrite the remembered set. Deleted or unavailable references are cleared; selecting a surviving fallback set remembers that set instead. Card position, side, and review state are not persisted: a restored set opens at the first saved card, front side, outside review.

## Mutation and validation

Index Cards may also contain a `display` object, shared by all sets. It is optional for compatibility with older version-1 backups. When present, it contains exactly `font` (`serif` or `sans`), `textSize` (80–130 in steps of 5), `cardSize` (75–125 in steps of 5), `ink` (`pencil`, `dark`, or `black`), and `baseline` (integer -4–6 pixels). Defaults are defined in `display-options.js`, not duplicated in stored data until settings are changed. Percentages are relative to the standard card/text scale. Unknown keys, missing fields, wrong types, and out-of-range values reject the backup before replacement. Display options use the existing local save and backup flow.

New groups and sets are created relative to the current selection: a selected group receives the new item at the start of its children, a selected set receives the new item immediately after it among its siblings, and no selection inserts at the start of the root array. Moves preserve a group's entire subtree, reject self/descendant destinations, and maintain the destination's manual order. Names are limited to 120 characters; a blank rename preserves the previous name. The workspace supports up to 5,000 entries and 32 levels of nesting.

Word Search groups and word-search records use their own IDs and ordered hierarchy. Groups may contain groups or word searches, up to 32 levels deep and 5,000 total library items. The scaffold allows up to 1,000 word-search records. Creating a group mutates the library immediately, but **New word search** only opens a setup placeholder; no word-search record is saved until the future setup form completes.

Empty sets and groups delete immediately. Populated sets and groups open a fullscreen confirmation; Cancel or Escape leaves the directory untouched, while Delete removes the set or the group's entire subtree and saves locally. Selection and expansion state for removed entries are cleared. There is no undo or recycle bin; a previously downloaded backup can restore the workspace through the existing upload flow.

Uploads are limited to 32 MB so downloaded backups can preserve card text even when browser storage fills up. Parsing checks the format/version, allowed fields, unique IDs, names, tree shape, and limits before touching live data. A workspace supports up to 1,000 cards total and 2,000 characters per side. Card data must have valid IDs, string front/back values, and string title/backTitle values if present; unknown fields are rejected. Unsupported versions or feature data are rejected; there is no migration system.

The upload review shows the filename, Index Cards directory/card counts, and Word Search library/search counts. **Replace workspace** applies the entire validated backup, replacing rather than merging the current data. Cancel leaves the current workspace intact. Download the current workspace before replacement if it needs to be retained. Replacement clears cached feature UI and saves the new data locally.

When browser storage is unavailable or full, changes remain in memory and the UI asks the user to download a backup. An unreadable stored workspace is left untouched and automatic writes remain blocked until the user uploads and confirms a valid replacement. Errors do not silently discard the current in-memory workspace.

When extending card data or adding fields to saved word searches, update the owning feature validation, workspace format handling, documentation, and manual backup round-trip checklist together.

## Card editing and review

Card text updates the canonical workspace on input and uses the existing local-save watcher. New and duplicated cards are inserted after the current card in the saved array. Duplication copies both titles and both sides and creates a new ID. Forward, backward, and shuffled review never change saved order. Starting a review selects the first card of the chosen sequence and every navigation opens the chosen starting side. Canceling setup does not change the active review. Card deletion is immediate, removes both sides, and selects the next available card or the empty-set view. Current position, visible side, and review settings reset when a different set is selected or the workspace is restored.

The right-hand list displays every card in the selected set in the current review order. Titles and previews of the selected starting side update directly from canonical card data; blank titles use a display-only numbered fallback. List selection reveals the configured starting side, updates the active highlight, and does not change the saved order.

Review activity and its progress display are temporary UI state. Finish review and End review restore front-first, saved-order browsing while keeping the current card selected. Editing remains enabled throughout, and ending a review never rolls back edits or changes the saved card order.

Manually edit different front/back titles, flip repeatedly, duplicate, reload, and download/restore a backup. Check an older backup with only `title`: its front title should remain and its back title should be blank. Test back-first review: the list uses back titles, falling back to card numbers for blank titles without exposing front titles. Invalid or oversized back titles must reject uploads without replacing the workspace.
