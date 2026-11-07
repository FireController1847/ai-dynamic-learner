import { ref, shallowRef } from 'vue';
import { validAccount, type AuthProvider, type AuthResult, type VerifiedAccount, type AuthCapabilities, type OAuthProvider } from '../core/auth/provider.ts';

export type AccountSessionState =
  | { status: 'unavailable' }
  | { status: 'checking' }
  | { status: 'signed-out' }
  | { status: 'authenticated'; account: VerifiedAccount }
  | { status: 'verification-required'; email: string }
  | { status: 'connection-required'; emailHint?: string };

function assertResult(result: AuthResult): void {
  if (result.status === 'authenticated' && !validAccount(result.account)) {
    throw new Error('The authentication provider returned an invalid account.');
  }
  if (result.status === 'verification-required' &&
    (typeof result.email !== 'string' || !result.email || result.email.length > 254)) {
    throw new Error('The authentication provider returned an invalid verification address.');
  }
}

/** Browser-only adapter around a future trusted provider. No credentials are persisted here. */
export function useAccountSession(provider: AuthProvider | null) {
  const state = shallowRef<AccountSessionState>(provider ? { status: 'checking' } : { status: 'unavailable' });
  const capabilities = shallowRef<AuthCapabilities>({ ready: false, email: false, google: false, microsoft: false });
  const busy = ref(false);
  const error = ref('');
  const notice = ref('');
  // First-time verification/creation requests a safe initial cloud upload.
  const autoSyncAccountId = ref<string | null>(null);
  const available = !!provider;
  let generation = 0;

  async function restore(newOAuthAccount = false): Promise<void> {
    if (!provider || busy.value) return;
    const current = ++generation;
    busy.value = true;
    state.value = { status: 'checking' };
    error.value = '';
    notice.value = '';
    try {
      const options = await provider.capabilities();
      if (current !== generation) return;
      capabilities.value = options;
      if (!options.ready) {
        state.value = { status: 'unavailable' };
        return;
      }
      const result = await provider.restore();
      if (current !== generation) return;
      if (result.status === 'authenticated' || result.status === 'verification-required') {
        assertResult(result);
      }
      state.value = result;
      if (newOAuthAccount && result.status === 'authenticated') autoSyncAccountId.value = result.account.id;
    } catch (cause) {
      // CORS, a missing local Worker, and an API 503 are not the same as a
      // signed-in session. Preserve the safely returned error when available.
      if (current === generation) {
        state.value = { status: 'connection-required' };
        if (cause instanceof TypeError) {
          const local = window.location.hostname === '127.0.0.1';
          error.value = local
            ? 'The local account API is unavailable. Run npm start and open Dynamic Learner at http://127.0.0.1:3000/.'
            : 'The browser could not reach the account API. Check the network request and allowed Origin in developer tools.';
        } else {
          error.value = cause instanceof Error ? cause.message : 'The account session could not be verified.';
        }
      }
    } finally {
      if (current === generation) busy.value = false;
    }
  }

  /** Show sign-in instead of a stale/offline session hint; this does not authenticate anyone. */
  function beginSignIn(): void {
    if (!provider || busy.value) return;
    ++generation;
    state.value = { status: 'signed-out' };
    error.value = '';
    notice.value = '';
  }

  async function authenticate(operation: 'signIn' | 'register', email: string, password: string): Promise<void> {
    if (!provider) throw new Error('Online authentication is not configured.');
    if (busy.value) throw new Error('An account request is already in progress.');
    if (!email.trim() || email.length > 254 || !password || password.length > 256) {
      throw new Error('Provide a valid email address and password.');
    }
    busy.value = true;
    error.value = '';
    notice.value = '';
    const current = ++generation;
    try {
      const result = await provider[operation]({ email: email.trim(), password });
      assertResult(result);
      if (current !== generation) return;
      state.value = result;
      if (result.status === 'authenticated') {
        notice.value = 'Signed in. Your local workspace is not yet linked or synchronized.';
      } else {
        notice.value = window.location.hostname === '127.0.0.1'
          ? 'Open the verification link printed in the npm start terminal.'
          : 'Check your email for the verification link.';
      }
    } catch (cause) {
      if (current === generation) error.value = cause instanceof Error ? cause.message : 'Authentication failed.';
      throw cause;
    } finally {
      if (current === generation) busy.value = false;
    }
  }

  async function requestPasswordReset(email: string): Promise<void> {
    if (!provider) throw new Error('Online authentication is not configured.');
    if (busy.value) throw new Error('An account request is already in progress.');
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
      await provider.requestPasswordReset(email.trim());
      notice.value = 'If this address is registered, the provider will send recovery instructions.';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Password recovery is unavailable.';
      throw cause;
    } finally { busy.value = false; }
  }

  function oauthStart(providerName: OAuthProvider): void {
    if (!provider || !capabilities.value[providerName] || busy.value) return;
    window.location.assign(provider.oauthStart(providerName));
  }

  async function verifyEmail(token: string): Promise<void> {
    if (!provider || !capabilities.value.ready) throw new Error('Online accounts are not available.');
    if (busy.value) throw new Error('An account request is in progress.');
    busy.value = true;
    error.value = ''; notice.value = '';
    try {
      const result = await provider.verifyEmail(token);
      assertResult(result);
      if (result.status !== 'authenticated') throw new Error('Email verification did not establish a session.');
      state.value = result;
      autoSyncAccountId.value = result.account.id;
      notice.value = 'Email verified. Your account is ready and cloud synchronization is starting.';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Email verification failed.';
      throw cause;
    } finally { busy.value = false; }
  }

  async function resendVerification(email: string): Promise<void> {
    if (!provider || !capabilities.value.email) throw new Error('Email verification is unavailable.');
    if (busy.value) throw new Error('An account request is in progress.');
    busy.value = true; error.value = ''; notice.value = '';
    try {
      await provider.resendVerification(email);
      notice.value = window.location.hostname === '127.0.0.1'
        ? 'If this account is unverified, a new link is printed in the npm start terminal.'
        : 'If verification is pending, a fresh link will be sent.';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not request verification.';
      throw cause;
    } finally { busy.value = false; }
  }

  async function completePasswordReset(token: string, password: string): Promise<void> {
    if (!provider || !capabilities.value.email) throw new Error('Password recovery is unavailable.');
    if (busy.value) throw new Error('An account request is in progress.');
    busy.value = true; error.value = ''; notice.value = '';
    try {
      await provider.completePasswordReset(token, password);
      state.value = { status: 'signed-out' };
      notice.value = 'Password updated. All previous sessions have been revoked. Please sign in.';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Password reset failed.';
      throw cause;
    } finally { busy.value = false; }
  }

  async function signOut(): Promise<void> {
    if (!provider || busy.value) return;
    busy.value = true; error.value = ''; notice.value = '';
    try {
      await provider.signOut();
      state.value = { status: 'signed-out' };
      autoSyncAccountId.value = null;
      notice.value = 'Signed out of the online account. Device-local workspaces remain here.';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not sign out.';
      throw cause;
    } finally { busy.value = false; }
  }

  return { state, capabilities, busy, error, notice, autoSyncAccountId, available, restore, beginSignIn,
    authenticate, requestPasswordReset, resendVerification, verifyEmail, completePasswordReset,
    oauthStart, signOut };
}
export type AccountSessionController = ReturnType<typeof useAccountSession>;
