# Account identity foundation — Stage 1

Stage 1 introduces **device-local identities and workspace ownership**, not registration, sign-in, remote accounts, or cloud sync. These identities are not authorization or privacy boundaries on a shared device.

## Durable records

- `control['local']` remains the existing single active `workspaceId` pointer, preserving the Data API, revision guards, backups, and staged restores.
- `control['identity-directory']` is a validated version-1 mapping of one Guest and up to 19 device-only local identities, with `activeIdentityId` and `{id, kind, label, workspaceId}` entries. The reserved Guest ID is `guest`; new local identities receive stable random IDs. Labels are not login credentials.
- Each `workspaceMeta` record includes `ownerId`; learning records keep the existing workspace-prefixed compound keys. No feature schemas or backup format versions change.
- `ProfileRepository` in `src/app/profile-storage.ts` provides identity-scoped browser-local profile persistence with a fallback for the legacy Guest profile key. Profile data is outside workspace backups.

## Migration and operations

After the existing workspace is validated, first startup creates Guest ownership and assigns every known previous workspace generation to Guest in one guarded transaction. No learning records or revisions are rewritten. Invalid metadata blocks initialization rather than creating an empty replacement over the original data.

Creating a local identity stages and verifies a fresh empty workspace before installing its metadata and switching the active identity and workspace pointer in one transaction. Selecting an existing identity updates both control records atomically; it does not copy or erase content. Restoring a backup retains the selected owner. The two-confirmation **Clear workspace data** action deletes only the selected identity's known workspace generations. Other owners and orphan data remain available for raw rescue.

**Move guest workspace** transfers Guest's existing workspace and historical generations into the new local identity, while installing a verified empty Guest workspace. Guest profile copying is a separate browser-local operation after the durable transfer. A failed copy preserves the original guest profile and reports the partial outcome.

Editors unmount and flush pending writes before local switches. Other tabs reconcile against IndexedDB, not just a broadcast message. Mutations verify **both** the active workspace pointer and the selected identity, preventing an outdated Guest tab from modifying a workspace that another tab has just adopted without changing its ID. Dirty drafts are retained for recovery rather than silently replaced.

## Future authentication and synchronization

A future authentication provider must establish verified remote identity independently; profile email and device-local identity names cannot prove account ownership. Linking a local workspace to a remote user will require an explicit user-confirmed transfer/merge policy plus server-side authorization checks.

Cloud sync remains separate work: define an initial upload/merge process, transactional outbox, deletion acknowledgments, remote revisions/cursors, idempotent server operations, and conflict retention. Neither a local identity nor the existing revision journal implies any remote backup or device sync.

## Manual checks

1. Upgrade older IndexedDB and Guest profile without losing content, revisions, or inactive restoration generations.
2. Create multiple device-only identities; confirm independent study content, profile fields, and persistence across switching and refresh.
3. Transfer Guest into a new identity; check guest is empty and the existing workspace/profile were retained.
4. Restore/clear one identity; confirm all other identities and raw rescue retain their data.
5. Switch and transfer between multiple tabs while another editor is typing. Confirm stale writes fail safely and drafts are not silently replaced.
6. Exercise corrupted directory metadata, blocked upgrades, restricted storage, and light/dark/mobile Profile UI.
