# Dynamic Learner authentication API

Cloudflare Worker for **authentication only**, intentionally separate from Dynamic Learner's offline-first IndexedDB learning data. There is **no cloud sync** in this release. All code remains in the existing ACCOUNTS PR #30.

## Local setup (PowerShell)

From the repository root:

```powershell
Set-Location api
npm ci
npx wrangler d1 migrations apply dynlearn-data --local
npm run dev
```

Wrangler uses a local D1 database unless `--remote` is explicitly requested. The Worker health endpoint is `/v1/health`. The auth endpoint `/v1/auth/config` reports which sign-in methods have all their required secrets (without exposing secrets). Email/password operations need a real mail delivery provider and account secrets.

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

Treat the resulting strings as secrets; never paste them into ChatGPT, Git, issue comments, logs, or application code. For local development, place private values in a locally ignored `.dev.vars` file and configure `FRONTEND_ORIGIN` and `API_ORIGIN` appropriately for localhost if you test the Worker and UI together. The current frontend's API origin is `https://api.dynlearn.org`; local browser testing requires either a local API override in the frontend or using the deployed Worker.

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

All credentialed POST requests require the exact configured frontend Origin. Cookies are Secure, HttpOnly, SameSite=Lax, and host-only for `api.dynlearn.org` in production. Browser requests use `credentials: include` and restrictive CORS. Session tokens are random and stored in D1 **only as SHA-256 hashes**. Passwords use PBKDF2-SHA256 at 600,000 iterations with random per-account salts and an independent secret pepper. OAuth tokens are never sent to the frontend.

## Operational/security notes

- D1 rate-limit buckets provide baseline abuse mitigation, not full bot/credential-stuffing protection. Configure Cloudflare WAF rate limiting and/or Turnstile before public registration. Consider breach-password checks, automated abuse monitoring, multi-factor authentication, and independent security review before open production launch.
- Large password hashing workloads may require a paid Workers CPU allocation. Do **not** lower password hashing strength merely to fit a free tier.
- Resend and Google/Microsoft may have their own provider quotas, email-domain validation, consent-screen review and subscription costs.
- Password reset revokes existing sessions. Browser local workspaces remain stored regardless of login or logout.
- Auth email changes, account deletion, merging OAuth identities with password accounts, MFA and cloud synchronization have not been built. Implement explicit authenticated account linking rather than matching unverified email addresses.
- Keep `AUTH_PEPPER` secure and backed up: losing it makes existing password hashes unverifiable. Rotating it needs a planned migration.
- Cloudflare account-level D1 is not the same as per-device IndexedDB. No server-side data API exists for learning records yet.
