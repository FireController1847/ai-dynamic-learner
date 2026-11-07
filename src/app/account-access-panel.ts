import { defineComponent, h, onMounted, ref, watch, type PropType } from 'vue';
import { requestLeave } from '../core/leave-guards.ts';
import type { OAuthProvider } from '../core/auth/provider.ts';
import type { AccountSessionController } from './auth-session.ts';

type AccessMode = 'sign-in' | 'register' | 'reset' | 'reset-confirm';

export const AccountAccessPanel = defineComponent({
  name: 'AccountAccessPanel',
  props: { session: { type: Object as PropType<AccountSessionController>, required: true } },
  setup(props) {
    const mode = ref<AccessMode>('sign-in');
    const email = ref('');
    const password = ref('');
    const confirmPassword = ref('');
    const resetToken = ref<string | null>(null);
    const verifyToken = ref<string | null>(null);
    const callbackError = ref('');
    const formError = ref('');
    const submitting = ref(false);

    onMounted(() => {
      const current = new URL(window.location.href);
      const params = new URLSearchParams(current.hash.startsWith('#') ? current.hash.slice(1) : '');
      const verify = params.get('verify');
      const reset = params.get('reset');
      if (verify && /^[A-Za-z0-9_-]{30,120}$/.test(verify)) verifyToken.value = verify;
      if (reset && /^[A-Za-z0-9_-]{30,120}$/.test(reset)) {
        resetToken.value = reset;
        mode.value = 'reset-confirm';
      }
      if (current.searchParams.get('auth') === 'error') {
        callbackError.value = 'The external sign-in did not complete. You can try again.';
      }
      if (current.searchParams.has('auth') || verify || reset) {
        current.hash = '';
        current.searchParams.delete('auth');
        window.history.replaceState(window.history.state, '', current.pathname + current.search);
      }
    });

    watch(() => [
      props.session.busy.value, props.session.capabilities.value.ready, props.session.state.value.status,
    ], () => {
      if (!verifyToken.value || !props.session.capabilities.value.ready ||
          props.session.busy.value || props.session.state.value.status === 'checking') return;
      const token = verifyToken.value;
      verifyToken.value = null;
      void props.session.verifyEmail(token).catch(() => undefined);
    });

    function changeMode(value: AccessMode) {
      mode.value = value;
      password.value = '';
      confirmPassword.value = '';
      formError.value = '';
      callbackError.value = '';
    }

    async function submit(event: Event) {
      event.preventDefault();
      if (submitting.value || props.session.busy.value || !props.session.capabilities.value.email) return;
      formError.value = '';
      const address = email.value.trim();
      if (mode.value !== 'reset-confirm' && (!address || address.length > 254)) {
        formError.value = 'Enter a valid email address.';
        return;
      }
      if (mode.value === 'register' || mode.value === 'reset-confirm') {
        if (password.value.length < 12 || password.value !== confirmPassword.value) {
          formError.value = 'Use at least 12 characters, and enter matching passwords.';
          return;
        }
      }
      if (mode.value !== 'reset' && (!password.value || password.value.length > 256)) {
        formError.value = 'Enter a valid password.';
        return;
      }
      submitting.value = true;
      try {
        if (mode.value === 'reset') {
          await props.session.requestPasswordReset(address);
        } else if (mode.value === 'reset-confirm') {
          if (!resetToken.value) throw new Error('The password reset link is missing.');
          await props.session.completePasswordReset(resetToken.value, password.value);
          resetToken.value = null;
          mode.value = 'sign-in';
        } else {
          await props.session.authenticate(mode.value === 'register' ? 'register' : 'signIn',
            address, password.value);
        }
      } catch {
        // The session manager provides safe errors; passwords never stay in state.
      } finally {
        password.value = '';
        confirmPassword.value = '';
        submitting.value = false;
      }
    }

    function socialLogin(provider: OAuthProvider) {
      if (submitting.value || props.session.busy.value || !requestLeave()) return;
      props.session.oauthStart(provider);
    }

    return () => {
      const auth = props.session;
      const current = auth.state.value;
      const options = auth.capabilities.value;
      const showLogin = current.status === 'signed-out' ||
        (current.status === 'verification-required' && mode.value === 'reset-confirm');
      const showRecovery = mode.value === 'reset-confirm' && resetToken.value !== null &&
        options.email && options.ready;
      return h('section', { class: 'profile-identities profile-account-access', 'aria-label': 'Online account' }, [
        h('div', { class: 'profile-identities-intro' }, [
          h('h3', 'Online account'),
          h('p', 'Account sign-in does not automatically upload or replace your local workspace. Cloud sync is not enabled.'),
        ]),
        (!auth.available || current.status === 'unavailable')
          ? h('p', { class: 'profile-account-unavailable', role: 'status' },
            'Online authentication is not configured on the API yet. Local identities and studying remain available.')
          : null,
        current.status === 'checking' ? h('p', { role: 'status' }, 'Checking your account session…') : null,
        current.status === 'connection-required'
          ? h('div', { class: 'profile-account-status' }, [
            h('p', 'The account service is unreachable. Your local work is available, but your online session is not verified.'),
            h('button', { type: 'button', class: 'quiet-button', disabled: auth.busy.value,
              onClick: () => { void auth.restore(); },
            }, 'Try again'),
          ]) : null,
        current.status === 'verification-required' && !showRecovery
          ? h('div', { class: 'profile-account-status' }, [
            h('p', 'Email verification is pending for ' + current.email + '.'),
            h('button', { type: 'button', class: 'quiet-button', disabled: auth.busy.value,
              onClick: () => { void auth.resendVerification(current.email).catch(() => undefined); },
            }, 'Resend verification email'),
            h('button', { type: 'button', class: 'quiet-button', disabled: auth.busy.value,
              onClick: () => { void auth.restore(); },
            }, 'Check verification'),
            h('button', { type: 'button', class: 'quiet-button', disabled: auth.busy.value,
              onClick: auth.beginSignIn,
            }, 'Sign in with another account'),
          ]) : null,
        current.status === 'authenticated'
          ? h('div', { class: 'profile-account-status' }, [
            h('p', 'Signed in as ' + (current.account.email ?? 'account ' + current.account.id) +
              '. Your local workspace has not been linked or uploaded.'),
            h('p', { class: 'profile-field-hint' }, 'Provider: ' + current.account.providerId),
            h('button', { type: 'button', class: 'quiet-button', disabled: auth.busy.value,
              onClick: () => { void auth.signOut().catch(() => undefined); },
            }, auth.busy.value ? 'Signing out…' : 'Sign out'),
          ]) : null,
        options.ready && current.status !== 'authenticated' &&
          (current.status === 'signed-out' || showRecovery)
          ? h('div', { class: 'profile-account-form-area' }, [
            options.email && !showRecovery ? h('div', {
              class: 'profile-account-tabs', role: 'group', 'aria-label': 'Account action',
            }, [
              h('button', { type: 'button', class: 'quiet-button', 'aria-pressed': mode.value === 'sign-in',
                onClick: () => changeMode('sign-in'), disabled: submitting.value,
              }, 'Sign in'),
              h('button', { type: 'button', class: 'quiet-button', 'aria-pressed': mode.value === 'register',
                onClick: () => changeMode('register'), disabled: submitting.value,
              }, 'Create account'),
            ]) : null,
            options.email ? h('form', { class: 'profile-form profile-account-form',
              onSubmit: (event: Event) => { void submit(event); },
            }, [
              mode.value === 'reset-confirm' ? h('h4', 'Choose a new password') : null,
              mode.value !== 'reset-confirm' ? h('div', { class: 'profile-field' }, [
                h('label', { for: 'account-access-email' }, 'Email'),
                h('input', { id: 'account-access-email', type: 'email', required: true, maxlength: 254,
                  autocomplete: 'email', value: email.value, disabled: submitting.value,
                  onInput: (event: Event) => {
                    if (event.target instanceof HTMLInputElement) email.value = event.target.value;
                  },
                }),
              ]) : null,
              mode.value !== 'reset' ? h('div', { class: 'profile-field' }, [
                h('label', { for: 'account-access-password' },
                  mode.value === 'reset-confirm' ? 'New password' : 'Password'),
                h('input', { id: 'account-access-password', type: 'password', required: true, maxlength: 256,
                  minlength: mode.value === 'register' || mode.value === 'reset-confirm' ? 12 : undefined,
                  autocomplete: mode.value === 'sign-in' ? 'current-password' : 'new-password',
                  value: password.value, disabled: submitting.value,
                  onInput: (event: Event) => {
                    if (event.target instanceof HTMLInputElement) password.value = event.target.value;
                  },
                }),
              ]) : null,
              mode.value === 'register' || mode.value === 'reset-confirm'
                ? h('div', { class: 'profile-field' }, [
                  h('label', { for: 'account-access-confirm-password' }, 'Confirm password'),
                  h('input', { id: 'account-access-confirm-password', type: 'password', required: true,
                    autocomplete: 'new-password', maxlength: 256, value: confirmPassword.value,
                    disabled: submitting.value,
                    onInput: (event: Event) => {
                      if (event.target instanceof HTMLInputElement) confirmPassword.value = event.target.value;
                    },
                  }),
                ]) : null,
              formError.value ? h('p', { class: 'profile-error', role: 'alert' }, formError.value) : null,
              h('div', { class: 'profile-form-actions' }, [
                h('button', { type: 'submit', class: 'card-primary-button',
                  disabled: submitting.value || auth.busy.value,
                }, submitting.value ? 'Working…'
                  : mode.value === 'sign-in' ? 'Sign in'
                    : mode.value === 'register' ? 'Create account'
                      : mode.value === 'reset' ? 'Request reset' : 'Set new password'),
                mode.value === 'reset' ? h('button', { type: 'button', class: 'quiet-button',
                  onClick: () => changeMode('sign-in'), disabled: submitting.value,
                }, 'Back to sign in')
                  : mode.value === 'reset-confirm' ? null
                    : h('button', { type: 'button', class: 'quiet-button',
                      onClick: () => changeMode('reset'), disabled: submitting.value,
                    }, 'Forgot password?'),
              ]),
            ]) : null,
            !showRecovery && (options.google || options.microsoft) ? h('div', {
              class: 'profile-social-login', role: 'group', 'aria-label': 'Other sign-in providers',
            }, [
              options.google ? h('button', { type: 'button', class: 'quiet-button',
                disabled: auth.busy.value || submitting.value,
                onClick: () => socialLogin('google'),
              }, 'Continue with Google') : null,
              options.microsoft ? h('button', { type: 'button', class: 'quiet-button',
                disabled: auth.busy.value || submitting.value,
                onClick: () => socialLogin('microsoft'),
              }, 'Continue with Microsoft') : null,
            ]) : null,
            !options.email && !options.google && !options.microsoft
              ? h('p', { class: 'profile-field-hint' }, 'No sign-in methods have been configured yet.') : null,
          ]) : null,
        verifyToken.value && current.status === 'checking' ? h('p', { role: 'status' }, 'Preparing email verification…') : null,
        callbackError.value ? h('p', { class: 'profile-error', role: 'alert' }, callbackError.value) : null,
        auth.error.value ? h('p', { class: 'profile-error', role: 'alert' }, auth.error.value) : null,
        auth.notice.value ? h('p', { class: 'profile-feedback', role: 'status' }, auth.notice.value) : null,
      ]);
    };
  },
});
