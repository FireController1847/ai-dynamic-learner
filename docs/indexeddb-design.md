# IndexedDB persistence — physical design proposal

> **Status: IndexedDB cutover integrated on this draft PR, not yet browser-validated.** The schema, transaction provider, staging/activation, model mapping and compatibility observer are implemented. `src/app/workspace.ts` now uses IndexedDB as the live persistence provider. Direct feature command integration and polished same-record conflict resolution UX remain future work. Read with [Unified Data API](data-api-design.md).

## Selected storage model

Use one same-origin IndexedDB database named `dynamic-learner-data`, currently at **IDB schema version 2**. Store **individual semantic records** rather than one JSON workspace or one giant item blob. No IndexedDB structure is exposed to feature UI.

- IndexedDB is the local working database. Persistent data is stored using structured clone, not `JSON.stringify`.
- Every record is scoped by a stable local `workspaceId`. This permits safe staged restore and, later, separate local/account workspaces without key collisions.
- Preserve the current external `{format:'dynamic-learner',version:1,...}` JSON format *only for exports/imports*. The IDB schema version is unrelated to backup/app versions.
- IDs inside features retain their existing formats and validation. Composite storage keys add scope; they do **not** rewrite user-facing IDs.
- Avoid unbounded duplication of Markdown/Lined/Graph bodies or question collections across parents. Project summaries/metadata separately and read large content on demand.
- Entries are immutable snapshots from the persistence layer; mutations use explicit commands and write back validated plain objects, never Vue proxies.

### Logical layout

```text
dynamic-learner-data (IDB schema v2)
  control                 (active workspace pointer; local-wide state)
  workspaceMeta           (workspace identity; revisions and cutover marker)
  libraryNodes            (ordered groups/leaf metadata across library apps)
  collections             (parent/sibling order revisions across tabs)
  featureState            (saved feature-level display/settings/selection)
  notebookDocuments       (one document body/data per record)
  todoLists               (one list's metadata per record)
  todoSections            (one section per record)
  todoTasks               (one task per record)
  indexCardSets           (mode/settings tied to each set)
  indexCards              (one card per record)
  wordSearches            (puzzle definition; saved rotation)
  wordSearchGames         (grid/found progress)
  crosswords              (puzzle definition)
  crosswordGames          (grid/answers/progress)
  guides                  (list sections or map authored graph)
  guideSessions           (resumable map-adventure progress)
  reviewSets              (mode and saved assessment options)
  reviewQuestions         (one question per record)
  statisticsMeta          (ledger version/startedAt)
  statisticsApps          (lifetime app counters)
  statisticsEntries       (entry counters/last activity)
  changeJournal           (small committed invalidation history)
```

The division is intentional: Todo List is a **flat date-oriented library**, not the generic nested group hierarchy. Calculator has no persistent content store; its activity goes into statistics.

## Exact keys, indexes and payload mapping

`workspaceId` is a string UUID stored in `workspaceMeta`, not a user-account ID. The table uses `[a,b]` to denote an IndexedDB compound key path.

| Store | Primary key | Essential record fields / queries | Required secondary index |
| --- | --- | --- | --- |
| `control` | `key`, singleton `'local'` | `activeWorkspaceId`; guard against writes by obsolete tabs after restore; app metadata | none |
| `workspaceMeta` | `id` | `createdAt`, `commitSequence`, `authoredRevision`, `lastExportedAuthoredRevision`, `restoreEpoch`, `legacyMigration` | none |
| `libraryNodes` | `[workspaceId,app,id]` | `kind`, `name`, `parentKey`, `position`, `revision` for Notebook, Index Cards, Word Search, Crossword, Guide, Review | `[workspaceId,app,parentKey,position]` |
| `featureState` | `[workspaceId,app]` | Existing optional persisted `display`, `settings`, `lastSelected...` fields, presence preserved; `revision` | none |
| `notebookDocuments` | `[workspaceId,id]` | `type` = Markdown/Lined/Graph, entire type-owned `data`, `revision`; no other documents' content | none |
| `todoLists` | `[workspaceId,id]` | `name`, `createdAt`, optional `sectionSort`, `position`, `revision` | `[workspaceId,position]`; date index optional |
| `todoSections` | `[workspaceId,listId,id]` | `title`, optional `priority`, `position`, `revision` | `[workspaceId,listId,position]` |
| `todoTasks` | `[workspaceId,listId,sectionId,id]` | `text`, `done`, optional `skipped`/`priority`, `position`, `revision` | `[workspaceId,listId,sectionId,position]` |
| `indexCardSets` | `[workspaceId,id]` | Optional `mode`, `revision`; ordered membership comes from cards | none |
| `indexCards` | `[workspaceId,setId,id]` | Optional `title`/`backTitle`, `front`, `back`, `position`, `revision` | `[workspaceId,setId,position]` |
| `wordSearches` | `[workspaceId,id]` | Optional `puzzle` and `boardRotation`, `revision` | none |
| `wordSearchGames` | `[workspaceId,id]` | Optional saved game `rows`/`placements`/`found`, `revision` | none |
| `crosswords` | `[workspaceId,id]` | Optional `puzzle`, `revision` | none |
| `crosswordGames` | `[workspaceId,id]` | Optional saved `game` and `revision` | none |
| `guides` | `[workspaceId,id]` | `mode` plus authored List sections or Map topics/connections/start ID, `revision` | none |
| `guideSessions` | `[workspaceId,id]` | Optional Map `session` (current/opened/visited/skipped/revealed/paused), `revision` | none |
| `reviewSets` | `[workspaceId,id]` | Optional `mode`, optional saved `options`, `revision` | none |
| `reviewQuestions` | `[workspaceId,setId,id]` | `position`, `type`/`prompt`/`answer`/`explanation`/`choices`, optional `context`/`matches`, `revision` | `[workspaceId,setId,position]` |
| `statisticsMeta` | `workspaceId` | `version`, `startedAt` | none |
| `statisticsApps` | `[workspaceId,app]` | App-level `counts` | none |
| `statisticsEntries` | `[workspaceId,app,id]` | `counts`, `lastActivityAt` | `[workspaceId,app]` for pruning/rollup |
| `changeJournal` | `[workspaceId,commitSequence]` | `clientId`, `affectedScopes` (bounded), `authored`, `createdAt`; fallback if a tab misses BroadcastChannel messages | none |

`app` values are exact saved feature IDs: `notebook`, `todo-list`, `index-cards`, `word-search`, `crossword`, `guide`, and `knowledge-check`; `calculator` is valid only as a statistics app. `libraryNodes.kind` is the original saved kind for that app (e.g. `set` for Review or Index Cards); it is not a new public kind. Store children of root under the **string** sentinel `'@root'`, not a null index key (IDB index keys cannot use null). All source IDs continue to be nonempty validated strings; the sentinel is reserved for a parent key only.

Positions are non-negative **integer sibling indexes**. A reorder/insert/move can renumber the affected small sibling collections inside one transaction; this avoids floating-point fractional rank collisions and preserves exact JSON array order. Paginated list reads use the parent+position index, never materialize the entire tree merely to display one group.

For document and other large edited-body records, `revision` applies to the body independently of the corresponding `libraryNodes` title/location revision. This permits a rename in one tab and Markdown edits in another without a false conflict. Moving/deleting still checks ownership and structural preconditions.

### Representative storage records (illustrative only)

```ts
// A Notebook group/document is in the library index without its full editor data:
{ workspaceId: 'local-uuid', app: 'notebook', id: 'doc-id',
  kind: 'document', name: 'Operating Systems', parentKey: '@root',
  position: 2, revision: 4 }

// The potentially large document body lives in its own record:
{ workspaceId: 'local-uuid', id: 'doc-id', type: 'markdown',
  data: { markdown: '# Processes\n...' }, revision: 19 }

// A card is independently editable without cloning the whole set:
{ workspaceId: 'local-uuid', setId: 'set-id', id: 'card-id',
  position: 0, front: 'Question', back: 'Answer', revision: 3 }
```

Optional fields must remain optional (not silently turned into null or false): the canonical import validators distinguish omitted historical fields in several models. The converter may normalize only in ways already accepted by those validators.

## Integrity constraints (enforced by repository, not IDB)

IndexedDB provides unique primary keys/indexes and atomic transactions, **not relational foreign keys**. The Data API owns invariants:

- A `libraryNode` leaf points to exactly one matching content record where its feature requires one; groups do not have leaf content. Recursively validate group parentage, depth limits, and cycles.
- `indexCards` must belong to existing Index Card sets; `reviewQuestions` to Review sets; Todo tasks to Todo sections/lists. Deleting a parent deletes descendants in the **same transaction** (or stages a new workspace during bulk replacement).
- Puzzle games must match their saved puzzle definitions, size, directions, allowed entries and progress. Changing puzzle definitions invalidates old saved game when current feature rules require it.
- `guideSessions` must refer to valid topics and remain optional; not every Guide has a session.
- Index Card modes, Notebook types, Review question types/options, AI-import provenance if any, optional saved display fields, and per-app strictness are validated using existing feature rules.
- Statistics global/app totals persist separately from entry counts and survive deletion of detailed entry records according to `src/core/statistics.ts`; no duplicate increments on retries.
- Every ID, name, content size, maximum tree depth/count and feature-specific value complies with current validators. Existing ID scope differs between features; the composite key must not accidentally narrow/expand domain validation.
- Optional `statistics` in old snapshots reconstructs as `emptyStatistics()` when absent; preserve the actual timestamp when present, do not fabricate historical activity.

### Atomic mutation protocol

1. Prepare and validate candidate input **outside** the IDB transaction wherever possible.
2. Start one short `readwrite` transaction over `control`, `workspaceMeta`, only the affected feature stores, and `changeJournal`.
3. Verify `control.activeWorkspaceId` still equals the command's workspace. Read current record/parent revisions inside this transaction; reject missing, stale, cyclic or otherwise invalid operations by aborting.
4. Issue all IDB reads/writes while the transaction remains active. Do not await HTTP, timers, user dialogs, Vue ticks or unrelated promises inside an IDB transaction; it may auto-commit.
5. Update touched revisions; increment workspace `commitSequence`, and `authoredRevision` **only** for authored content/settings. Write one bounded journal invalidation record and commit all or nothing.
6. Resolve the command only from the transaction's **complete** event; distinguish quota, abort, conflict and version errors.
7. Publish in-tab and `BroadcastChannel` invalidations **after** commit; never send uncommitted model blobs across tabs.

Example: changing one Markdown document touches `control`, `workspaceMeta`, one `notebookDocuments` record, and one `changeJournal` record—**not** every document, every card or the parent library. A repeated app-statistics event touches the corresponding statistics stores; it is not an authored-work revision.

The shared workspace metadata transaction scope serializes the short commit-sequence bookkeeping writes across tabs, but unrelated content is neither read nor cloned. Keep those transactions short; measure commit latency with large documents. The journal is bounded by age/count and can be compacted; a tab that sees an evicted sequence range performs a broader reload rather than guessing which changes occurred.

## Activation, migration and atomic restore

`control` holds the **active workspace pointer**. Every regular write checks this pointer as part of its transaction so an editor in a stale tab cannot overwrite a newly restored workspace.

### First migration from localStorage

1. Open IDB and run schema creation via `onupgradeneeded`. If `control.activeWorkspaceId` already exists, **do not reimport**; use the existing IDB workspace even if old localStorage remains.
2. If this origin has an old `dynamic-learner.workspace.v1` key, parse and normalize it using the existing version-1 validators. Do not delete/change the key; do not overwrite it after cutover. If invalid, enter a **recovery-required, non-editable** state; offer a backup of the legacy value and an explicit recovery pathway. Never turn a load error into an empty editable workspace.
3. For large imports, write into an **inactive staging workspaceId** in batches/short transactions. Preserve exact array order and child relationships. In-progress staging is not visible as the active workspace; incomplete staging can be cleaned safely on retry.
4. Re-read staged records, reconstruct the full canonical workspace **once**, run the existing validators, and compare inventory/critical counts and content against the parsed source. Verification must detect omissions; counts alone are not enough.
5. Activate the staged workspace by a **single guarded control transaction** that installs `activeWorkspaceId` and the migration-complete marker. If another tab already activated a workspace, abort/reload rather than overwriting it.
6. Keep the original localStorage JSON unchanged as a recovery copy until a separate documented retention decision. Users must close/reload older site tabs still writing the legacy key; old builds cannot be made transaction-aware retroactively.

On a truly fresh origin with no legacy data, initialize and activate an empty validated workspace only after IDB is available.

### Restore an imported backup

Validate the entire supplied backup first; build it as an inactive staged workspace (possibly in chunks); independently verify hydration; require confirmation and resolve/block current dirty editors; then atomically switch `control.activeWorkspaceId` to the new workspace. In the same transaction, increment restore epoch and publish a workspace-replaced event. Keep previous active data available for recovery until explicit cleanup. This avoids a fragile giant delete-and-replace transaction and prevents an old in-flight autosave from reverting the restore.

After activation, other tabs receive the new pointer, clear old subscriptions/drafts or offer a conflict-resolution choice, and reload the active workspace. Their attempted writes against the old workspace are rejected even if they miss the broadcast.

### Schema upgrades, version changes and interrupted jobs

- `db.onversionchange` closes the connection, pauses commands and asks the tab to reload; `request.onblocked` shows which action is required rather than silently hanging.
- Each `onupgradeneeded` schema change is transactional; data changes that are too large for a single upgrade transaction use guarded staging/activation once stores exist.
- Never call `deleteDatabase` as an error workaround, and never erase legacy backups on upgrade failure.
- Migration/restore staging records have an explicit state/creation time. Clean only *inactive* abandoned staged workspaces after a safe retention window.
- Storage is scoped to scheme+host+port (origin): localhost, GitHub Pages, and any future custom domain are separate. Moving domains still requires export/import or later account sync.
- Private browsing, eviction, browser clearing site data, quota errors and unsupported IDB still require backup UX; consider `navigator.storage.persist()` as a best-effort protection request, not a guarantee.

## Same-origin multi-tab synchronization

- Create a channel such as `dynamic-learner.data.v1`; notify with `workspaceId`, `commitSequence` and small affected scopes. These messages are **hints**, not authoritative state.
- On a message, consumers compare revisions and re-query scoped keys; never overwrite a dirty draft. A late or out-of-order message is harmless.
- On page visibility/focus/resume, query `workspaceMeta.commitSequence` and `control.activeWorkspaceId`; replay bounded `changeJournal` or reload relevant collections when the journal is too old.
- Different-record concurrent edits should succeed. Same-record concurrent edits must enforce optimistic compare-and-swap. Simultaneous reorders of the same parent should conflict rather than corrupt ordering.
- New DB schema while older tabs remain open must produce a visible upgrade-blocked state. Cross-tab messages do **not** circumvent IndexedDB version-change blocking.
- Do not depend on `beforeunload` or `pagehide` to initiate the final write; save well before shutdown. Await transaction completion for durability state, while acknowledging browsers/OS may still lose very recent writes in a crash.

## Backup serialization and sync readiness

### Backup

Read a consistent committed snapshot across stores, reconstruct `Workspace` with nested arrays in saved order and optional fields intact, and validate it. Perform JSON serialization/compression **only when explicitly exporting**. JSON v1 remains readable; an optional gzip-based `.bak` wrapper can be proposed separately, with header and decompression size limits. This IndexedDB design does **not** create a SQLite `.bak`. Keep the large backup assembly out of normal editing paths and use a worker/streaming mechanism if benchmarks show UI stalls. Record only the snapshot's authored revision as exported; do not mark edits committed by another tab during export as backed up.

### Future HTTP sync

Do **not** equate local compound keys with server SQL primary keys. The server maps persistent workspace IDs/entity IDs to its account authorization model.

A later IDB schema version can add:
- `syncOutbox` keyed by stable operation ID, with workspace/actor, entity key, expected server revision, payload, retry/status. Mutation+outbox enqueue is one transaction.
- `tombstones` for remote-known deleted entities, retained until the server acknowledges them.
- Remote cursors/acknowledged revisions and conflict records.

When a user first links an account, upload a validated local baseline (with explicit local-vs-remote merge policy), then switch to durable operation queueing. Do not emit unbounded tombstones/outbox records for users who have never enabled sync. Server applies idempotent operations and returns revisions; a rejected conflict retains local user work for resolution.

## Risks and verification matrix

| Risk | Test required before cutover |
| --- | --- |
| Data mapping omissions | Full v1 round-trip including Notebook Lined/Graph data, Todo sort/expiry/tasks, index modes/settings/cards, puzzle games, Guide sessions, all Review questions, statistics |
| Accidentally rewriting big content | Hundreds of large Notebook documents; type in one while instrumenting IDB puts and memory; no unrelated content body reads/writes |
| Cross-tab races | Concurrent distinct-doc edits, same-doc conflict, simultaneous list moves, deletion during edit, restore while an old tab has pending saves |
| Partial migrations | Invalid legacy JSON, interrupted staging, duplicate IDs, out-of-quota write, competing new tabs, legacy old-build tab still open |
| Database versioning | Two tabs with different build versions, blocked upgrade, interrupted upgrade, schema compatibility failure without data loss |
| Backups | New export/import, legacy JSON, huge export, decompression bomb/error, restore conflict, concurrent writes during export |
| Statistics/reminders | No duplicate counts, no lifetime-counter loss, no full-workspace hashing during edits, only authored changes advance backup reminders |
| Storage lifecycle | Reload, new tab, private browsing, disabled storage, browser eviction/quota, Pages/custom-domain origin boundary |

References for browser semantics: [MDN IndexedDB transactions](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology), [MDN version changes](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), [MDN BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel), and [MDN transaction durability](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction).

**Approval criterion:** Agree on object-store boundaries, compound-key policy, revision/conflict rules and staged activation before any runtime persistence implementation PR.