# Account authentication — server-independent groundwork

The Profile experience now has two distinct systems:

1. **Device-local identity** (existing Stage 1): a workspace selector, tied to a stable browser-only ID and local IndexedDB records. There is no proof of identity, password or account ownership.
2. **Remote authenticated identity** (Stage 2 adapter): an independently verified account provided by a trusted service. **No authentication provider is configured in this build**, so remote sign-in, registration and recovery are not offered yet.

These concerns must never be conflated. A profile email address, user-entered password, localStorage flag, or local identity label is not evidence of remote authentication.

## Authentication provider contract

- `src/core/auth/provider.ts` specifies a provider's `restore`, `signIn`, `register`, `requestPasswordReset`, and `signOut` methods. A provider returns validated remote account metadata or a verification-required state; it must establish authenticity with its trusted service before returning `authenticated`.
- `src/app/auth-provider.ts` is the single configuration point. It intentionally exports `null` until a secure service has been selected and implemented. Do not substitute a browser-only password database.
- `src/app/auth-session.ts` handles asynchronous session restoration, sign-in/registration, password recovery and sign-out without persisting credentials or bearer tokens. Provider sessions, refresh tokens and revocation are the provider's responsibility.
- Session states distinguish **unavailable**, **checking**, **signed out**, **authenticated**, **verification required**, and **connection required**. An unverifiable/offline session is never displayed as a verified online login.
- `src/app/account-access-panel.ts` supplies the account experience. When no provider is configured, it explains the limitation without displaying forms that cannot work. Once a real provider is wired in, email/password sign-in, registration with password confirmation, recovery and sign-out use the same interface.

## Local identity lifecycle

The Profile page also supports renaming local identity labels and deleting **inactive non-Guest** identities. Deletion has two confirmations and removes only the identity's owned IndexedDB generations in a guarded transaction; it also tries to remove the corresponding browser-local profile after the commit. Guest cannot be deleted, and the currently selected local identity must be switched away from before deletion. Old tabs or malformed ownership records block destructive operations.

**Be aware:** none of these local identities are secure user accounts, and clearing browser data still removes them. Backup downloads continue to represent the active learning workspace, not a remote account and not the identity directory or profile photo.

## Linking verified accounts later

An authenticated account and an active local workspace must remain **separate** until an explicit linking flow obtains the user's choice and an authorized server confirms ownership. Do not automatically change `workspaceMeta.ownerId` to a remote account ID, upload data, or merge study records on sign-in. The future flow needs to:

1. Verify the account with a trusted provider; determine whether remote data already exists.
2. Show the locally owned workspace and available remote workspace without assuming which one wins.
3. Obtain explicit confirmation for keeping both, uploading local data, or resolving conflicts.
4. Preserve both sources/recovery copies while performing any remote mutation. Use idempotent requests and revision checks.
5. Commit a durable workspace/account mapping only after the server acknowledges the operation.
6. Provide clear rollback/retry behavior and preserve offline Guest access.

Cloud sync (outbox, cursors, tombstones, replay and conflicts) remains a separate stage.

## Manual acceptance checks

- Create, rename and switch local identities. Confirm profile display names are independent of identity labels.
- Switch away and delete a local identity; verify its content disappears, Guest and other identities remain untouched, and a reload does not resurrect it.
- Verify deletion is blocked for Guest, the active identity, stale tabs, unsupported newer databases and mismatched workspace ownership.
- Enter/cancel both deletion confirmations; no operation should occur on cancel.
- With no provider configured, confirm no sign-in claims or fake authentication forms appear, and all study apps keep working offline.
- With a future test provider (never wired to production), exercise success, verification-required, failed/offline restore, expired session, sign-out, recovery, and password clearing.
