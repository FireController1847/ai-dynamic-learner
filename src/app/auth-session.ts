import { ref, shallowRef } from 'vue';
import { validAccount, type AuthProvider, type AuthResult, type VerifiedAccount } from '../core/auth/provider.ts';

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
  const busy = ref(false);
  const error = ref('');
  const notice = ref('');
  const available = !!provider;
  let generation = 0;

  async function restore(): Promise<void> {
    if (!provider || busy.value) return;
    const current = ++generation;
    busy.value = true;
    state.value = { status: 'checking' };
    error.value = '';
    notice.value = '';
    try {
      const result = await provider.restore();
      if (current !== generation) return;
      if (result.status === 'authenticated' || result.status === 'verification-required') {
        assertResult(result);
      }
      state.value = result;
    } catch {
      // A failure to verify a session must never be treated as a logged-in state.
      if (current === generation) {
        state.value = { status: 'connection-required' };
        error.value = 'The account session could not be verified. Local study data remains available.';
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
        notice.value = 'Check your email for the next verification step.';
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

  async function signOut(): Promise<void> {
    if (!provider || busy.value) return;
    busy.value = true; error.value = ''; notice.value = '';
    try {
      await provider.signOut();
      state.value = { status: 'signed-out' };
      notice.value = 'Signed out of the online account. Device-local workspaces remain here.';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not sign out.';
      throw cause;
    } finally { busy.value = false; }
  }

  return { state, busy, error, notice, available, restore, beginSignIn,
    authenticate, requestPasswordReset, signOut };
}
export type AccountSessionController = ReturnType<typeof useAccountSession>;
