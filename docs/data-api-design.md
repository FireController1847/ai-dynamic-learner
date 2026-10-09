# Unified Data API — architecture proposal

> **Status: implementation integrated on this draft PR, not yet browser-validated.** `src/app/workspace.ts` now initializes the IndexedDB Data API; `workspace-observer.ts` translates existing Vue model mutations into targeted record writes. Live `localStorage` workspace writing and full-workspace backup fingerprinting have been replaced. The longer-term objective remains direct typed API commands from feature components, without the compatibility observer. Review alongside [IndexedDB design](indexeddb-design.md).

## Why this change

Before this PR, `src/app/workspace.ts` owned one reactive `Workspace` object, observed it deeply, and ran `JSON.stringify` plus synchronous `localStorage.setItem('dynamic-learner.workspace.v1', ...)` after edits. The old backup-reminder fingerprint in `src/app/backup-reminders.ts` separately serialized the entire authored workspace. As Notebook documents and other content grow, editing a small record continues to copy all content. Separate tabs also hold independent workspace snapshots and can overwrite each other's changes.

The intended model is **local-first, provider-independent data operations**. IndexedDB is the first persistence provider. An eventual account/HTTP sync backend attaches behind this contract; it does not require features to start issuing HTTP requests or abandon offline editing.

### Goals

1. Edit/save a document, card, task, puzzle progress, or question without serializing or rewriting unrelated workspace records.
2. Give every persistent feature typed, asynchronous queries and semantic mutations; support atomic multi-entity operations.
3. Support simultaneous tabs on the same origin, with a defined stale-write/conflict response and prompt visibility of committed changes.
4. Import every valid current/legacy version-1 workspace without dropping any persisted fields, ordering, optional-value distinctions, or statistics.
5. Continue explicit portable backups and preserve existing feature validators/compatibility rules.
6. Allow a future sync provider to plug into the same feature-facing contract without refactoring UI storage calls.

### Non-goals for the first implementation

- Accounts, server endpoints, network sync, collaborative real-time text editing, CRDTs, and conflict-free editing of the *same* document in different tabs.
- Replacing the existing typed domain models, changing study behavior, changing per-app versions, or migrating browser-local theme/Tips/panel preferences.
- Implementing a second full-workspace JSON storage engine disguised as IndexedDB.
- Committing runtime modules in this RFC PR.

## Ownership and module boundaries

Proposed locations (not created by this RFC):

| Location | Responsibility | Import rule |
| --- | --- | --- |
| `src/core/data/` | Feature-neutral types (`EntityKey`, revision, error codes, transaction result, subscriptions); no Vue or feature types | Core only |
| `src/core/storage/indexeddb/` | Raw IndexedDB connection, schema upgrades, transaction discipline, indexed record operations | Core only; cannot import features |
| `src/features/<feature>/data-contract.ts` | Feature-specific query/command DTOs referring to the existing feature models and validators | Feature -> core allowed |
| `src/app/data/` | Compose per-feature repositories, enforce domain invariants, bridge legacy import, backup, statistics and cross-tab events | App -> feature/core allowed |
| `src/app/workspace.ts` | Initially a compatibility adapter; ultimately startup/provider orchestration instead of canonical mutable storage | App layer |
| `src/app/app.ts` / `feature-registry.ts` | Provide per-feature service props or feature-owned injection adapters | No feature -> app imports |

Feature-neutral storage code must never import `src/features`. Feature-specific rules remain with their feature; `app` can assemble them. In particular, a generic component in `src/components` must not import the composite app repository. Feature components receive their own typed service via props or feature-owned injection, rather than importing `app` upward.

`Workspace` / `parseWorkspace` in `src/app/workspace-format.ts` remain the **version-1 portable interchange contract**, not the runtime database schema or a promise that every view loads all content. IDB schema versions, backup format versions, and individual app versions are independent.

## Feature-facing API shape (illustrative TypeScript, not implementation)

All data-changing calls return **after the IndexedDB transaction commits**, not merely after an operation is queued. The UI may still update optimistically while the command is pending.

```ts
type DataKey = { workspaceId: string; app: string; id: string };
type Versioned<T> = { value: T; revision: number };
type DataErrorCode =
  | 'not-found' | 'conflict' | 'validation' | 'quota'
  | 'unavailable' | 'upgrade-blocked' | 'migration-required';

type DataResult = {
  changed: DataKey[];
  commitSequence: number;
  authoredRevision: number; // Unchanged by statistics-only and selection-only writes.
};
type MutationPrecondition = { expectedRevision: number };
type CollectionQuery = {
  parentId: string | null;
  cursor?: string;
  limit?: number;
};
type DataChange = {
  workspaceId: string;
  commitSequence: number;
  affected: DataKey[];
};

interface NotebookDataApi {
  listItems(query: CollectionQuery): Promise<Versioned<NotebookItemSummary>[]>;
  getDocument(id: string): Promise<Versioned<NotebookDocument> | null>;
  saveDocument(id: string, data: NotebookDocument['data'], ifMatch: MutationPrecondition): Promise<DataResult>;
  createDocument(command: CreateDocumentCommand): Promise<DataResult>;
  moveItem(command: MoveLibraryItemCommand): Promise<DataResult>;
  deleteItem(command: DeleteLibraryItemCommand): Promise<DataResult>;
  subscribe(listener: (change: DataChange) => void): () => void;
}

interface WorkspaceDataApi {
  ready(): Promise<void>;
  readonly notebook: NotebookDataApi;
  // Corresponding typed services for todoLists, indexCards,
  // wordSearch, crossword, guide, review, statistics and backups.
  exportBackup(): Promise<Blob>;
  previewImport(file: Blob): Promise<ImportPreview>;
  replaceFromImport(preview: ImportPreview): Promise<DataResult>;
  close(): void;
}
```

The exact names are reviewable, not promises of exported runtime symbols. The **semantics** are important:

- Queries retrieve summaries, one record, or paginated children. Opening a large Notebook document does not hydrate all other document bodies.
- Mutations are semantic commands: create, update, reorder, move, delete, set options, record progress, and feature-specific multi-record imports. Avoid public `putRow` / raw IDB transaction / arbitrary JSON patch APIs.
- IDs are generated once and remain stable. The existing `createId`/`isValidId` behavior and feature-specific ID scopes remain authoritative. Do not change IDs merely because storage keys are composite.
- Input is treated as `unknown` at persistence/import boundaries, cloned away from Vue proxies, and validated with existing feature validators plus command-level invariants. Reads return safe snapshots, not live IDB records that can be mutated to save implicitly.
- Commands affecting multiple entities (group move/delete, reorder, card import into Review, replacement) commit atomically or fail atomically.
- `expectedRevision` is required for writes from potentially stale editors. Missing/deleted records and revision mismatches are typed errors, never silent overwrites.
- UI errors visibly distinguish unsaved changes/conflicts from successful saves. A failed store open must not render an empty **editable** replacement workspace.

## State and subscriptions

- Keep Vue for **local draft/editing state** and optimistic rendering; remove the whole-workspace deep persistence watcher after the transition.
- Debounce frequent updates **per record** (e.g. current Markdown document), not per entire workspace. Serialize only the target record; queued edits to the same record are ordered and coalesced, and errors preserve the draft.
- Subscriptions deliver **committed invalidations** (keys/scope/revision), not copies of the whole workspace. Consumers re-query the affected records. Signals can coalesce rapid updates.
- When an invalidation arrives for a dirty open editor, do **not** silently replace its draft. Compare revisions and offer reload/resolve/keep-local-draft behavior. Distinct records can be edited concurrently in different tabs.
- A write's optimistic display is not a durable-save indicator; use committed/dirty/failed states based on the returned transaction result.
- Maintain a clear separation between persistent authored data, statistics/progress, selected-item conveniences, and transient UI state. Statistics may persist, but do not count as authored edits for backup reminders.

### Implemented semantic commands (current PR)

Beyond the initial record-level save APIs, the repository now exposes explicit
grouped-library and Todo transaction families. These are available to future
feature adapters; existing feature UI still operates through the temporary
per-record Vue observer.

- `data.library.createGroup`, `createEntry`, `renameItem`, `moveItem`, and
  `deleteItem` support Notebook, Index Cards, Word Search, Crossword, Guide,
  and Review. Entry creation uses existing feature validators, creates
  dependent records atomically, and maintains revisioned sibling collections.
  Deletion cascades through dependent cards, questions, game progress, map
  sessions, child groups, and per-entry statistics.
- `data.todo.createList`, `createSection`, `createTask`, `deleteTask`,
  `deleteSection`, `deleteList`, `moveTask`, and `reorderList` provide
  equivalent commands for Todo's flat list/section/task hierarchy.
- The read/backup hydration layer rejects orphaned leaf payloads, missing
  children, inconsistent collection ordering, dangling Todo records, and
  orphaned statistics rather than silently omitting them from backups.
- Callers supply revision preconditions. A command changes all related rows
  in one transaction or rejects them together.

The current Vue compatibility observer remains the live bridge for existing feature components. The app now provides non-destructive conflict recovery: download the current in-memory draft, then explicitly confirm a reload of saved IndexedDB content. It does not automatically merge two competing edits to the same record. Targeted cross-tab hydration and direct feature-owned calls remain optional later optimizations, rather than prerequisites for exercising the migration. No browser-level acceptance runs have been performed.

### Concrete feature operation families

| Domain | Minimum query/mutation families |
| --- | --- |
| Notebook | Paginated library; fetch/save individual Markdown/Lined/Graph data; create/rename/move/reorder/delete documents and groups; persisted display/last selection |
| Todo List | List/sort/archive metadata; fetch list sections/tasks; create/edit/check/skip/reorder/delete task and section; list settings |
| Index Cards | Library/set settings; fetch/save single card; set mode; card order; group/set moves; bulk create; Fill-in-the-Blanks settings |
| Word Search | Puzzle definition vs saved game/progress; individual found-word attempts and rotations; display settings |
| Crossword | Puzzle definition vs saved game/entered-cell progress; display settings |
| Guide | List sections/map topics/connections; persisted map-study session; move/rename/delete guide |
| Review | Library/knowledge-set settings; fetch/edit/reorder question; bulk import from Index Cards atomically; quiz/test session remains transient unless contract explicitly changes |
| Statistics | Atomic increment with per-app and per-entry counters; update last activity; prune deleted entry detail without resetting lifetime totals |
| Workspace | Startup, subscription, status/errors, legacy import, backup snapshot, atomic full restore, provider lifecycle |

Calculator's successful operations affect statistics, not a new persistent Calculator content collection. Feature-native validation and max item/depth/size limits apply to every command, not just JSON restore.

## Multi-tab, concurrency and conflict contract

IndexedDB transactions are the authoritative arbiter. Every mutation reads the record's current revision and applies its precondition **in the same readwrite transaction** as the write. Increment the revision and commit sequence exactly once per command; reject stale edits with `conflict`. Coordinated operations spanning multiple stores keep all changes in one transaction.

For structural edits, also compare the relevant parent/collection revision. Reordering siblings atomically updates their positions; moving a subtree must reject cycles, missing targets, exceeding depth, and stale collections. Deletion is atomic across descendants and dependent content; IndexedDB does not enforce SQL foreign keys.

After a successful commit, broadcast small invalidation messages through `BroadcastChannel` and also publish locally. This channel is a notification optimization, **never the source of truth**. On tab resume, visibility/focus, reconnect, or a missed notification, compare the persisted workspace commit sequence and re-query changed scopes or reload indexes. Do not infer safety solely from a broadcast event. Keep the older `storage` event mechanism only for remaining localStorage preferences as needed.

IDB schema upgrades: close connections on `versionchange`; display an actionable `blocked`/`VersionError` state when an older tab prevents an upgrade. Never automatically wipe a database. Concurrent tabs during a legacy-to-IDB cutover must not each re-import the old JSON; the migration marker and data installation are serialized in one IDB transaction. **Older versions of the app that still write localStorage cannot participate in this protocol**; instruct users to close/reload those tabs during cutover.

Same-record, different-tab live co-authoring is intentionally deferred. The baseline policy is **detect and stop**, not last-write-wins.

## Backups, reminders and statistics

- Manual export enumerates a consistent committed workspace snapshot and reconstructs the canonical version-1 JSON shape **only on demand**; preserve current validators, legacy `study-guide` normalization, optional fields and exact array order.
- Continue accepting existing `.json` backups. An optional future `.bak` may contain gzip-compressed versioned **JSON**, not a mislabelled SQLite file. Validate header/version, checksum where present, decompressed size, and full content *before* the atomic replace.
- IDB quota/live capacity must **not** inherit the old 32 MiB JSON/localStorage limit. Import/decompression protection and export memory limits should be reconsidered independently, with explicit failure UX and large-backup tests.
- Export completion means a download was **initiated**, not confirmed saved. Track the exact authored revision included in the exported snapshot; concurrent/new edits remain unbacked.
- Replace backup reminders' whole-workspace fingerprint with a persisted monotonic **authoredRevision** (advanced only by authored-content/settings mutations), plus `lastExportedAuthoredRevision` and local reminder timing/snooze preferences. Track a restore as needing a new backup even if it coincidentally has the same revision number. Statistics and selection-only writes advance commit sequencing but do not advance authored revision.
- Keep statistics per app/entry and record semantic increments in small transactions rather than rewriting the entire statistics ledger.
- A future server sync layer may consume committed change metadata; user-visible API contracts remain local-first. Global revision alone is **not** a replacement for per-record server conflict detection.

## Legacy migration and staged rollout

1. Introduce contracts/connection/schema with **no UI changes**. Determine data mapping from the current validators, not the obsolete closed SQLite PR.
2. On first opening a new local DB, inspect `dynamic-learner.workspace.v1` without writing to it. Parse/normalize with current `parseWorkspace` rules; explicit damaged-data recovery is a separate flow, never silent data loss.
3. Stage all current domains, statistics, options, ordering and optional fields into an **inactive workspace** (in bounded transactions if necessary). Reconstruct and validate the staged version-1 workspace independently. Activate its pointer and migration-complete marker together in **one final guarded transaction**; incomplete staging never becomes the live workspace.
4. Keep the legacy localStorage value unchanged as a rollback/recovery copy during rollout. Do not keep writing both authorities, or silently choose the old value after successful migration. Retire the copy only under an explicit post-release retention/backup policy.
5. Migrate one feature at a time from mutable model props to explicit commands and scoped reads. A temporary compatibility bridge is acceptable, but **is not considered a performance fix** while it still snapshots/stringifies every document on unrelated changes.
6. Move statistics, backup reminders, and cross-feature Review/Index Cards operations behind the API before retiring `useWorkspace` deep watching.
7. Add cross-tab invalidation, stale-editor protection, simulated failure paths, and rollout QA before switching live reads/writes to IDB alone.
8. Add the sync provider later. On first account enrollment, establish a server baseline from a validated local snapshot; subsequently use stable operation IDs, per-entity revisions, durable outbox/tombstones, retry/backoff and explicit conflict resolution. Never assume the server will share the browser's IndexedDB schema.

### Acceptance gates for a subsequent implementation PR

- Version-1 JSON -> IDB -> version-1 JSON round-trip passes across all **seven** persisted features plus statistics, including legacy aliases, empty fields, ordering, advanced Notebook data, Guide map sessions, Review question types/settings, puzzle progress, Todo archive data, and cross-feature imports.
- Editing one large Markdown document writes only its relevant record(s); edits to another document do not deep-copy the first. Neither ordinary saves nor backup-change detection stringify the entire workspace.
- Two tabs edit different records without loss; two tabs edit the same record produce a detectable conflict; close/reopen/upgrade-blocked and missed-broadcast cases remain safe.
- A malformed localStorage source, aborted transaction, quota failure, invalid backup, and failed restore do not destroy either the previous authoritative data or the user's unsaved draft.
- Restore/replacement is atomic and cannot race a pending editor autosave into reverting it.
- Backup-export revision tracking is accurate when other tabs edit during export. Legacy and current backups remain readable.
- Existing app workflows, cross-feature Review imports, navigation guards, and statistics are preserved. No feature version bump solely for internal infrastructure.

## Open implementation decisions

1. Whether IDB should use the native API directly with a small local wrapper, or a lightweight typed helper. The public Data API must not expose this choice.
2. Precise per-record debounce and dirty-draft conflict UX (especially large Markdown/Lined/Graph editors).
3. Backup `.bak` envelope, compressed/uncompressed size limits and streaming strategy.
4. Whether to create dormant sync/outbox stores at schema v1 or add them when server sync is implemented.

See [IndexedDB design](indexeddb-design.md) for the proposed stores, keys, indexes and transactional invariants.