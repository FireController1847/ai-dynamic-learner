# Dynamic Learner accounts — Cloudflare authentication

Dynamic Learner uses separate systems for browser-local workspaces and online authentication. Online accounts do **not** enable learning-data synchronization yet.

## Server implementation

The Cloudflare Worker in `api/` serves `https://api.dynlearn.org`, using the existing D1 binding `env.dynlearn_data` and database `dynlearn-data`. The migration `api/migrations/0001_auth.sql` creates separate accounts, password credentials, OAuth identities, hashed sessions, one-use email tokens, pending OAuth flows, and rate-limit records. `account_workspace_links` is reserved for future explicit, server-authorized synchronization; no API presently writes it.

`api/src/auth/` implements:
- Email/password registration and sign-in with salted PBKDF2-SHA256 hashes and secret pepper, 12-character minimum, rate limiting, email verification, and reset links that revoke existing sessions.
- Google and Microsoft sign-in using authorization-code flow, PKCE, one-time state and browser-bound OAuth CSRF cookie, token exchange inside the Worker, provider UserInfo over HTTPS, and stable `sub` identities.
- Random, hashed D1 session tokens sent via Secure, HttpOnly, SameSite=Lax cookies, exact-origin CORS and POST Origin checks, and generic account-recovery responses.
- An optional Resend email-delivery adapter. Email/password registration is disabled until mail configuration is supplied. OAuth methods become available independently once their client credentials are configured.

The app-side `src/app/auth-provider.ts` calls the Worker with credentialed HTTPS fetch; `auth-session.ts` preserves the distinctions between authenticated, signed-out, unreachable, checking, verification-required, and unconfigured sessions. The Profile account panel supports sign-in, registration, verification links, password recovery and Google/Microsoft redirects. Existing guest/local workspaces are unaffected by sign-in or sign-out.

The Worker is **not deployed by merging the PR**. Follow `api/README.md` to run reviewed local/remote D1 migrations, configure Google/Microsoft app registrations and Resend sender domain, set Worker secrets, and deploy. Never commit or share secrets. The frontend will show that authentication is unavailable if the Worker isn't configured or reachable.

## Account identity boundaries

Google and Microsoft accounts are identified by provider-issued `sub` values, not email. A password account and a Google/Microsoft account that share an address are **not automatically merged**. They remain independent until an explicit, trusted account-linking mechanism is implemented. A locally entered email or identity label never establishes remote ownership.

A verified online account is also **not yet associated with a specific browser workspace**. The local IndexedDB data model remains separate from D1 accounts. Implementing cloud sync will require user-confirmed selection of existing local/remote workspaces, server authorization of workspace access, operation queues, deletion tombstones, revisions, idempotency, and conflict reconciliation.

## Deployment and security checklist

1. Apply the D1 migration locally; verify existing IndexedDB data is unchanged.
2. Configure independent `AUTH_PEPPER` and `AUTH_RATE_SECRET` (each >=32 chars). Keep backups of the pepper.
3. Configure sender-domain verification and `RESEND_API_KEY`/`EMAIL_FROM` for email/password.
4. Set Google web OAuth credentials with redirect URL `https://api.dynlearn.org/v1/auth/oauth/google/callback`.
5. Set Microsoft web OAuth credentials with redirect URL `https://api.dynlearn.org/v1/auth/oauth/microsoft/callback`.
6. Apply remote D1 migrations explicitly, deploy the existing `api` Worker, and check `/v1/health` and `/v1/auth/config`.
7. Perform live integration tests for email delivery, verified and unverified credentials, wrong passwords, expired/replayed tokens, session revocation, Google/Microsoft flows, OAuth denial, CORS and CSRF rejection, and offline/failed-backend behavior.
8. Add Cloudflare WAF/Turnstile/bot protection, consider breach-password checks, and complete an independent security review before opening registration publicly. Long PBKDF2 work may exceed free-tier Worker CPU limits.

The repository CI now runs Worker typecheck and tests alongside the existing frontend checks. This is an authentication foundation, not an assertion that production sign-in has already been configured or externally tested.
