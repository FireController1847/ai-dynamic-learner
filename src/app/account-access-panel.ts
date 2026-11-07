import { defineComponent, h, ref, type PropType } from 'vue';
import type { AccountSessionController } from './auth-session.ts';

type AccessMode = 'sign-in' | 'register' | 'reset';

export const AccountAccessPanel = defineComponent({
  name: 'AccountAccessPanel',
  props: { session: { type: Object as PropType<AccountSessionController>, required: true } },
  setup(props) {
    const mode = ref<AccessMode>('sign-in');
    const email = ref('');
    const password = ref('');
    const confirmPassword = ref('');
    const formError = ref('');
    const submitting = ref(false);

    function changeMode(value: AccessMode) {
      mode.value = value;
      password.value = '';
      confirmPassword.value = '';
      formError.value = '';
    }

    async function submit(event: Event) {
      event.preventDefault();
      if (submitting.value || props.session.busy.value || !props.session.available) return;
      formError.value = '';
      const address = email.value.trim();
      if (!address || address.length > 254) { formError.value = 'Enter a valid email address.'; return; }
      if (mode.value === 'register' && (password.value.length < 8 || password.value !== confirmPassword.value)) {
        formError.value = 'Use at least eight characters and matching passwords.';
        return;
      }
      if (mode.value !== 'reset' && (!password.value || password.value.length > 256)) {
        formError.value = 'Enter a valid password.'; return;
      }
      submitting.value = true;
      try {
        if (mode.value === 'reset') await props.session.requestPasswordReset(address);
        else await props.session.authenticate(mode.value === 'register' ? 'register' : 'signIn', address, password.value);
        password.value = '';
        confirmPassword.value = '';
      } catch {
        // The session manager owns provider-safe error messages.
        password.value = '';
        confirmPassword.value = '';
      } finally { submitting.value = false; }
    }

    return () => {
      const auth = props.session;
      const current = auth.state.value;
      return h('section', { class: 'profile-identities profile-account-access', 'aria-label': 'Online account' }, [
        h('div', { class: 'profile-identities-intro' }, [
          h('h3', 'Online account'),
          h('p', 'Sign-in and cloud synchronization are separate from your device-local workspaces.'),
        ]),
        !auth.available ? h('p', { class: 'profile-account-unavailable', role: 'status' },
          'Online accounts are not connected yet. You can manage profiles and study materials locally without a server.') : null,
        auth.available && current.status === 'checking'
          ? h('p', { role: 'status' }, 'Checking your account session…') : null,
        auth.available && current.status === 'connection-required'
          ? h('div', { class: 'profile-account-status' }, [
            h('p', 'Account verification requires a connection. This is not a verified signed-in session.'),
            h('button', { type: 'button', class: 'quiet-button', disabled: auth.busy.value,
              onClick: () => { void auth.restore(); },
            }, 'Try again'),
            h('button', { type: 'button', class: 'quiet-button', disabled: auth.busy.value,
              onClick: auth.beginSignIn,
            }, 'Sign in instead'),
          ]) : null,
        auth.available && current.status === 'verification-required'
          ? h('div', { class: 'profile-account-status' }, [
            h('p', 'Email verification is pending for ' + current.email + '.'),
            h('button', { type: 'button', class: 'quiet-button', disabled: auth.busy.value,
              onClick: () => { void auth.restore(); },
            }, 'Check verification'),
            h('button', { type: 'button', class: 'quiet-button', disabled: auth.busy.value,
              onClick: auth.beginSignIn,
            }, 'Use another account'),
          ]) : null,
        auth.available && current.status === 'authenticated'
          ? h('div', { class: 'profile-account-status' }, [
            h('p', 'Signed in as ' + (current.account.email ?? 'account ' + current.account.id) +
              '. Your local study content has not been linked to the account or uploaded.'),
            h('button', { type: 'button', class: 'quiet-button', disabled: auth.busy.value,
              onClick: () => { void auth.signOut().catch(() => undefined); },
            }, auth.busy.value ? 'Signing out…' : 'Sign out'),
          ]) : null,
        auth.available && current.status === 'signed-out'
          ? h('div', { class: 'profile-account-form-area' }, [
            h('div', { class: 'profile-account-tabs', role: 'group', 'aria-label': 'Account action' }, [
              h('button', { type: 'button', class: 'quiet-button', 'aria-pressed': mode.value === 'sign-in',
                onClick: () => changeMode('sign-in'), disabled: submitting.value,
              }, 'Sign in'),
              h('button', { type: 'button', class: 'quiet-button', 'aria-pressed': mode.value === 'register',
                onClick: () => changeMode('register'), disabled: submitting.value,
              }, 'Create account'),
            ]),
            h('form', { class: 'profile-form profile-account-form', onSubmit: (event: Event) => { void submit(event); } }, [
              h('div', { class: 'profile-field' }, [
                h('label', { for: 'account-access-email' }, 'Email'),
                h('input', { id: 'account-access-email', type: 'email', required: true, maxlength: 254,
                  autocomplete: 'email', value: email.value, disabled: submitting.value,
                  onInput: (event: Event) => {
                    if (event.target instanceof HTMLInputElement) email.value = event.target.value;
                  },
                }),
              ]),
              mode.value !== 'reset' ? h('div', { class: 'profile-field' }, [
                h('label', { for: 'account-access-password' }, 'Password'),
                h('input', { id: 'account-access-password', type: 'password', required: true, maxlength: 256,
                  minlength: mode.value === 'register' ? 8 : undefined,
                  autocomplete: mode.value === 'register' ? 'new-password' : 'current-password',
                  value: password.value, disabled: submitting.value,
                  onInput: (event: Event) => {
                    if (event.target instanceof HTMLInputElement) password.value = event.target.value;
                  },
                }),
              ]) : null,
              mode.value === 'register' ? h('div', { class: 'profile-field' }, [
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
                }, submitting.value ? 'Working…' : mode.value === 'sign-in' ? 'Sign in'
                  : mode.value === 'register' ? 'Create account' : 'Request reset'),
                mode.value === 'reset' ? h('button', { type: 'button', class: 'quiet-button',
                  onClick: () => changeMode('sign-in'), disabled: submitting.value,
                }, 'Back to sign in') : h('button', { type: 'button', class: 'quiet-button',
                  onClick: () => changeMode('reset'), disabled: submitting.value,
                }, 'Forgot password?'),
              ]),
            ]),
          ]) : null,
        auth.error.value ? h('p', { class: 'profile-error', role: 'alert' }, auth.error.value) : null,
        auth.notice.value ? h('p', { class: 'profile-feedback', role: 'status' }, auth.notice.value) : null,
      ]);
    };
  },
});
