import { h, nextTick, type Ref } from 'vue';
import { Icon } from './icon.ts';

interface HomeAction {
  icon: string;
  label: string;
  description: string;
  run(): void;
}
interface SecondaryAction { icon: string; label: string; run(): void }
interface RecentItem { id: string; name: string; kind?: string }

export function libraryHomeButton(active: boolean, onClick: () => void, buttonRef?: Ref<HTMLButtonElement | null>) {
  return h('button', {
    ref: buttonRef, type: 'button', class: ['library-home-entry', { 'is-selected': active }],
    'aria-pressed': active, onClick,
  }, [h(Icon, { name: 'grid' }), 'Home']);
}

export function libraryHome(options: {
  title: string;
  description: string;
  actions: readonly HomeAction[];
  recent: RecentItem | null;
  onReturn(id: string): void;
  secondary?: readonly SecondaryAction[];
  headingRef?: Ref<HTMLElement | null>;
}) {
  const recent = options.recent;
  return h('section', { class: 'library-home', 'aria-label': 'Home' }, [
    h('div', { class: 'library-home-content' }, [
      h('header', { class: 'library-home-heading' }, [
        h('h2', { ref: options.headingRef, tabindex: -1 }, options.title),
        h('p', options.description),
      ]),
      h('div', { class: ['library-home-grid', { 'is-single': options.actions.length === 1 }] },
        options.actions.map(action => h('button', {
          key: action.label, type: 'button', class: 'library-home-card', onClick: action.run,
        }, [
          h(Icon, { name: action.icon, class: 'library-home-card-icon' }),
          h('span', { class: 'library-home-card-copy' }, [h('strong', action.label), h('span', action.description)]),
        ]))),
      recent ? h('div', { class: 'library-home-secondary' }, [
        h('button', {
          type: 'button', class: 'quiet-button library-home-recent',
          title: `Return to ${recent.name}`, onClick: () => options.onReturn(recent.id),
        }, [
          h(Icon, { name: recent.kind === 'group' ? 'folder' : 'document' }),
          h('span', `Return to ${recent.name}`), h(Icon, { name: 'arrow-right' }),
        ]),
      ]) : null,
      options.secondary?.length ? h('div', { class: 'library-home-secondary' },
        options.secondary.map(action => h('button', { key: action.label, type: 'button', class: 'quiet-button', onClick: action.run },
          [h(Icon, { name: action.icon }), action.label]))) : null,
    ]),
  ]);
}

export function focusLibraryDetail(layout: HTMLElement | null, selector: string) {
  nextTick(() => {
    const detail = layout?.querySelector<HTMLElement>(selector);
    const heading = detail?.querySelector<HTMLElement>('h2') ?? detail;
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  });
}
