import { h, type VNode } from 'vue';

/**
 * Unmodified full-color provider marks for the account actions.
 * Reference: https://developers.google.com/identity/branding-guidelines
 * Reference: https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-branding-in-apps
 *
 * Keep marks full-color and separate from the localized button label.
 */
export function googleBrandMark(): VNode {
  return h('span', { class: 'profile-brand-icon profile-brand-icon--google', 'aria-hidden': 'true' }, [
    h('svg', { viewBox: '0 0 48 48', width: 20, height: 20, focusable: 'false' }, [
      h('path', { fill: '#EA4335', d: 'M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z' }),
      h('path', { fill: '#4285F4', d: 'M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.88 46.98 24.55z' }),
      h('path', { fill: '#FBBC05', d: 'M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z' }),
      h('path', { fill: '#34A853', d: 'M24 48c6.48 0 11.92-2.13 15.89-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z' }),
    ]),
  ]);
}

export function microsoftBrandMark(): VNode {
  return h('span', { class: 'profile-brand-icon profile-brand-icon--microsoft', 'aria-hidden': 'true' }, [
    h('svg', { viewBox: '0 0 23 23', width: 19, height: 19, focusable: 'false' }, [
      h('path', { fill: '#F25022', d: 'M0 0h10.9v10.9H0z' }),
      h('path', { fill: '#7FBA00', d: 'M12.1 0H23v10.9H12.1z' }),
      h('path', { fill: '#00A4EF', d: 'M0 12.1h10.9V23H0z' }),
      h('path', { fill: '#FFB900', d: 'M12.1 12.1H23V23H12.1z' }),
    ]),
  ]);
}
