# Dynamic Learner authentication API

Cloudflare Worker for authenticated Dynamic Learner accounts and **cloud synchronization** of validated workspace snapshots and account profiles. Local IndexedDB remains the editable source for workspaces; signed-in profile details are stored in D1. All changes are under ACCOUNTS PR #30.

## Cloud workspace synchronization

Newly verified email accounts now establish an authenticated session automatically and request cloud synchronization of the **current local workspace**. Newly created Google/Microsoft accounts request the same after their first OAuth callback. Existing accounts synchronize automatically when a device has a previously linked workspace, or when a new device has an empty workspace and a saved cloud copy. Other existing sign-ins can enable sync from Profile.

The API stores validated client workspace snapshots in D1 chunks and publishes a per-account revision only after every chunk is present. Uploads use conditional revisions to avoid overwriting concurrent edits. Different local and cloud edits **are not automatically merged**. If an account already has a saved cloud workspace and this browser has separate local data, the Profile page offers **Sign out**, **Download local workspace**, and **Use synced workspace instead**. Replacement requires two explicit clicks, validates the remote data, and atomically deletes the selected local identity's generations before activating the cloud copy. Other legacy local identities remain untouched but are no longer exposed in Profile. Display name, avatar, contact email, phone and bio are saved to D1 per account and sync across devices. Do not assume an unverified account or a session with connection errors has synchronized anything.

**Required production migration before enabling the new UI:**

```powershell
Set-Location api
npx wrangler d1 migrations apply dynlearn-data --remote
npx wrangler deploy
```

Review migrations `api/migrations/0002_cloud_sync.sql` and `api/migrations/0003_account_profiles.sql` before applying them. Account profile updates use optimistic revisions to reject stale writes from other devices. The Worker and frontend deployments are independent. Local `npm start` applies the migration only to local SQLite. No remote data is migrated automatically. Snapshot size is limited to 128 MiB; large uploads are split into 64 KiB units and may take time or hit hosting quotas. A failed sync does not delete local data. Cloud snapshots are stored as account-authenticated data in D1; this is not end-to-end encrypted.

## Local development: one command

From the repository root, use the normal frontend launcher:

```powershell
npm ci
npm start
```

On each start, the launcher ensures `api/node_modules` is installed, creates only **missing** `AUTH_PEPPER` and `AUTH_RATE_SECRET` values in the ignored `api/.dev.vars`, applies **local-only** migrations to D1/SQLite, starts the local Wrangler Worker, and starts webpack. It prints the Profile URL after both servers respond. Press Ctrl+C to stop them. Existing local credentials and the persisted database are never reset or rotated.

Local URLs: `http://127.0.0.1:3000/profile/` for Dynamic Learner and `http://127.0.0.1:8787/v1/auth/config` for the Worker. Only `127.0.0.1` is supported in development; `localhost` is not an accepted frontend Origin. Local SQLite data lives in `api/.wrangler/state/`. Cloudflare production settings and `dynlearn-data` remote records are **never modified** by `npm start`.

Override ports when necessary (PowerShell):

```powershell
$env:PORT = '3100'
$env:DL_AUTH_API_PORT = '8888'
npm start
```

**Existing accounts:** Registration rejects an email already associated with an account (email/password or OAuth), logging the rejection server-side and returning a generic internal error to the browser. Verification resend and password recovery remain separate rate-limited actions. A distinct error still allows account-enumeration inference; do not interpret the generic message as full concealment.

**Email/password works locally without Resend.** `npm start` enables a **loopback-only mail preview**: create an account with any test address and password (12+ characters), then follow the verification link printed as `[local-auth]` in the terminal running the Worker. Password-reset links are printed there too. These are real one-time links backed by local SQLite; no email is actually delivered and no production accounts are touched. The preview requires both configured origins to be `http://127.0.0.1` and the explicit `LOCAL_MAIL_PREVIEW` flag injected by this launcher. Wrangler can rewrite the incoming request URL, so local-mode detection does not depend on its hostname. The Worker is bound to loopback, and credentialed POST requests still require the exact local frontend Origin. Never expose the dev Worker over a public tunnel or use this feature in production.

Optional Resend, Google, and Microsoft test credentials may be added manually to the ignored `api/.dev.vars`; the launcher will preserve them. Do not copy production secrets into a local checkout. Google/Microsoft sign-in still requires separate OAuth development credentials and redirect URIs registered for `127.0.0.1`; without those credentials, those buttons remain unavailable. With the default local setup, `/v1/auth/config` should report `ready: true`, `email: true`, `google: false`, `microsoft: false`.

To run just webpack without the API (for UI-only work), use `npm run start:frontend`.

The production Worker accepts browser credentials from `https://dynlearn.org` only. Local development uses a local Worker and never loosens production CORS; opening the production `/v1/auth/config` directly does not test browser CORS.

### Production configuration

The Worker retains the starter Worker name **`api`** so deploying does not create an unrelated Worker, and has a custom-domain route for `api.dynlearn.org`. The D1 binding is `env.dynlearn_data` and the existing account-level D1 resource is `dynlearn-data`.

Run these commands locally from `api/`, entering **independent, cryptographically random** secret values when prompted:

```powershell
npx wrangler secret put AUTH_PEPPER
npx wrangler secret put AUTH_RATE_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put MICROSOFT_CLIENT_ID
npx wrangler secret put MICROSOFT_CLIENT_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM
```

`AUTH_PEPPER` and `AUTH_RATE_SECRET` must each be at least 32 characters. Generate unique high-entropy values in PowerShell with:

```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Treat the resulting strings as secrets; never paste them into ChatGPT, Git, issue comments, logs, or application code. For local development, place private values in a locally ignored `.dev.vars` file and configure `FRONTEND_ORIGIN` and `API_ORIGIN` appropriately for `127.0.0.1` if you test the Worker and UI together. The current frontend's API origin is `https://api.dynlearn.org`; the local development launcher supplies the loopback API origin automatically.

**Email:** Verify a sender domain through Resend, set `EMAIL_FROM` to a sender address approved for that domain, and create a scoped Resend API key. Registration is disabled unless email delivery is configured. Verification and password-reset emails use short-lived, single-use links whose tokens appear only in the frontend URL *fragment*, not server request logs. The frontend sends the token to the Worker over a credentialed POST. If delivery fails during first registration, the account remains unverified; the UI can request a new verification message.

**Google:** In Google Cloud Console, create an OAuth 2.0 **Web application**, configure its consent screen, and authorize callback URL:

```text
https://api.dynlearn.org/v1/auth/oauth/google/callback
```

**Microsoft:** In Microsoft Entra **App registrations**, register a web application with supported personal and/or organizational Microsoft accounts as desired; create a client secret and register callback:

```text
https://api.dynlearn.org/v1/auth/oauth/microsoft/callback
```

Both OAuth integrations use authorization code + PKCE, short-lived one-time state, a browser-bound CSRF cookie, server-side token exchange and the provider's HTTPS OIDC UserInfo endpoint. Only the provider's stable `sub` identifies the remote account. **Matching email addresses do not cause accounts to merge.**

Then apply the reviewed migration to D1 and deploy:

```powershell
npx wrangler d1 migrations apply dynlearn-data --remote
npx wrangler deploy
```

Remote migration and deployment must be run explicitly by a Cloudflare account owner. Do not deploy before reviewing the D1 schema and configuring your secrets. For a live site, verify:

```text
https://api.dynlearn.org/v1/health
https://api.dynlearn.org/v1/auth/config
```

`/v1/auth/config` only declares `ready: true` when D1 and the account secrets are present. A migration must also have been applied before live calls can work.

## API routes

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/v1/health` | Public health |
| GET | `/v1/auth/config` | Auth capability flags, no credentials |
| GET | `/v1/auth/session` | Server-verified cookie session |
| POST | `/v1/auth/register` | Register unverified password account, send verification |
| POST | `/v1/auth/sign-in` | Validate password, issue session if verified |
| POST | `/v1/auth/sign-out` | Revoke session and clear cookie |
| POST | `/v1/auth/verify` | Consume one-time email verification |
| POST | `/v1/auth/resend-verification` | Request email verification |
| POST | `/v1/auth/reset-request` | Generic password recovery reply |
| POST | `/v1/auth/reset-complete` | Consume reset token, update password, revoke all sessions |
| GET | `/v1/auth/oauth/{google|microsoft}/start` | OAuth redirect with state, PKCE |
| GET | `/v1/auth/oauth/{google|microsoft}/callback` | Verify callback and create server session |
| GET | `/v1/account/profile` | Read the signed-in account's profile stored in D1 |
| POST | `/v1/account/profile` | Update an account profile using a conditional revision |
| GET | `/v1/sync/manifest` | Read the signed-in account's current cloud revision and snapshot manifest |
| GET | `/v1/sync/chunk?id=…&index=…` | Read one published snapshot chunk, account-scoped |
| POST | `/v1/sync/start` | Start a chunked upload against an expected cloud revision |
| POST | `/v1/sync/chunk` | Store one chunk of the authenticated account's pending upload |
| POST | `/v1/sync/publish` | Atomically advance the cloud revision after all parts exist |

All credentialed POST requests require the exact configured frontend Origin. Cookies are Secure, HttpOnly, SameSite=Lax, and host-only for `api.dynlearn.org` in production. Browser requests use `credentials: include` and restrictive CORS. Session tokens are random and stored in D1 **only as SHA-256 hashes**. Passwords use PBKDF2-SHA256 at 600,000 iterations with random per-account salts and an independent secret pepper. OAuth tokens are never sent to the frontend.

## Operational/security notes

- D1 rate-limit buckets provide baseline abuse mitigation, not full bot/credential-stuffing protection. Configure Cloudflare WAF rate limiting and/or Turnstile before public registration. Consider breach-password checks, automated abuse monitoring, multi-factor authentication, and independent security review before open production launch.
- Large password hashing workloads may require a paid Workers CPU allocation. Do **not** lower password hashing strength merely to fit a free tier.
- Resend and Google/Microsoft may have their own provider quotas, email-domain validation, consent-screen review and subscription costs.
- Password reset revokes existing sessions. Browser local workspaces remain stored regardless of login or logout.
- Auth email changes, account deletion, merging OAuth identities with password accounts, MFA, and automatic merging of concurrent workspace changes have not been built. Never merge account identities by unverified email addresses.
- Keep `AUTH_PEPPER` secure and backed up: losing it makes existing password hashes unverifiable. Rotating it needs a planned migration.
- Cloudflare account-level D1 is not the same as per-device IndexedDB. No server-side data API exists for learning records yet.
