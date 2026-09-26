# Workspace data

`src/app/workspace.js` owns one reactive workspace. It saves under `dynamic-learner.workspace.v1` in `localStorage`, scoped to the browser and site origin. Changing host or port uses different browser storage. There is no server-side storage or cross-device synchronization; use a downloaded backup to transfer data. Simultaneous tabs are not synchronized, so edit in one tab at a time.

## Backup format

Downloads are JSON files containing the current canonical workspace:

```json
{
  "format": "dynamic-learner",
  "version": 1,
  "features": {
    "index-cards": { "items": [] }
  }
}
```

Each directory entry has an `id`, `kind` (`group` or `set`), and `name`. A group has an ordered `children` array containing groups and sets. A set has an ordered `cards` array. Each card contains `id`, `front`, and `back`, plus an optional `title`. Both sides and the title are plain text; side content can include line breaks. New cards include an empty title, and older cards without a title remain valid. A title is shared by both sides and limited to 120 characters. Empty text is valid. Existing version-1 backups with empty sets or untitled cards remain valid without conversion. Array position is the manual order, including at the root; there is no alphabetical sorting or duplicate order field. IDs are unique across groups, sets, and cards and do not change on edit or move.

Backups include all currently implemented feature data: groups, sets, names, nesting, order, and the title and both sides of every card. Word Search has no data yet. URLs, open groups, selected items, current card/side, active review status, review starting side and order, unfinished rename text, and drawer visibility are temporary UI state, not backup content. Icons and app identity remain application code, not user data.

## Mutation and validation

New groups and sets are inserted at the start of the root array. Moves preserve a group's entire subtree, reject self/descendant destinations, and maintain the destination's manual order. Names are limited to 120 characters; a blank rename preserves the previous name. The workspace supports up to 5,000 entries and 32 levels of nesting.

The trash button opens a fullscreen confirmation before deletion. Cancel or Escape leaves the directory untouched; Delete removes the set or the group's entire subtree and saves the change locally. Selection and expansion state for removed entries are cleared. There is no undo or recycle bin; a previously downloaded backup can restore the workspace through the existing upload flow.

Uploads are limited to 32 MB so downloaded backups can preserve card text even when browser storage fills up. Parsing checks the format/version, allowed fields, unique IDs, names, tree shape, and limits before touching live data. A workspace supports up to 1,000 cards total and 2,000 characters per side. Card data must have valid IDs, string front/back values, and a string title if present; unknown fields are rejected. Unsupported versions or feature data are rejected; there is no migration system.

The upload review shows the filename, directory entry count, and card count. **Replace workspace** applies the entire validated backup, replacing rather than merging the current data. Cancel leaves the current workspace intact. Download the current workspace before replacement if it needs to be retained. Replacement clears cached feature UI and saves the new data locally.

When browser storage is unavailable or full, changes remain in memory and the UI asks the user to download a backup. An unreadable stored workspace is left untouched and automatic writes remain blocked until the user uploads and confirms a valid replacement. Errors do not silently discard the current in-memory workspace.

When extending card data or adding Word Search data, update the feature validation, workspace format handling, documentation, and manual backup round-trip checklist together.

## Card editing and review

Card text updates the canonical workspace on input and uses the existing local-save watcher. New and duplicated cards are inserted after the current card in the saved array. Duplication copies the title and both sides and creates a new ID. Forward, backward, and shuffled review never change saved order. Starting a review selects the first card of the chosen sequence and every navigation opens the chosen starting side. Canceling setup does not change the active review. Card deletion uses the fullscreen confirmation, removes both sides, and selects the next available card or the empty-set view. Current position, visible side, and review settings reset when a different set is selected or the workspace is restored.

The right-hand list displays every card in the selected set in the current review order. Titles and previews of the selected starting side update directly from canonical card data; blank titles use a display-only numbered fallback. List selection reveals the configured starting side, updates the active highlight, and does not change the saved order.

Review activity and its progress display are temporary UI state. Finish review and End review restore front-first, saved-order browsing while keeping the current card selected. Editing remains enabled throughout, and ending a review never rolls back edits or changes the saved card order.
