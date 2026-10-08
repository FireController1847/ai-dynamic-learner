import { appConfig } from './app-config.ts';
import { pageHref } from './navigation.ts';
import { featureDefinitions, featureGroups } from '../features/feature-definitions.ts';
import { Icon } from '../components/icon.ts';
import { inputValue } from '../core/dom.ts';
import { AppIcon } from './app-icon.ts';

import { computed, defineComponent, h, TransitionGroup, onMounted, onBeforeUnmount, ref } from 'vue';

export const HomePage = defineComponent({
  name: 'HomePage',
  emits: { 'navigate': (_event: MouseEvent, _path: string) => true },
  setup(props, { emit }) {
    const today = ref(new Date());
    const query = ref('');
    const searchInput = ref<HTMLInputElement | null>(null);
    const apps = computed(() => {
      const words = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      return featureDefinitions.filter(feature => !feature.hidden &&
        words.every(word => `${feature.label} ${feature.description}`.toLocaleLowerCase().includes(word)));
    });
    const groups = computed(() => featureGroups.map(group => ({
      ...group, apps: apps.value.filter(feature => feature.group === group.id),
    })).filter(group => group.apps.length > 0));
    function clearSearch() { query.value = ''; searchInput.value?.focus(); }
    function pinLeavingCard(element: Element) {
      if (!(element instanceof HTMLElement)) return;
      const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = element;
      element.inert = true;
      Object.assign(element.style, { left: `${offsetLeft}px`, top: `${offsetTop}px`, width: `${offsetWidth}px`, height: `${offsetHeight}px` });
    }
    function clearCardPosition(element: Element) {
      if (!(element instanceof HTMLElement)) return;
      element.inert = false;
      for (const property of ['left', 'top', 'width', 'height']) element.style.removeProperty(property);
    }
    const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });
    const refreshDate = () => { today.value = new Date(); };
    let timer: number | undefined;
    onMounted(() => {
      timer = window.setInterval(refreshDate, 60000);
      document.addEventListener('visibilitychange', refreshDate);
    });
    onBeforeUnmount(() => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshDate);
    });

    return () => {
      const date = today.value;
      const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return h('div', { class: 'home-page' }, [
        h('section', { class: 'home-apps', 'aria-labelledby': 'home-apps-title' }, [
          h('h2', { id: 'home-apps-title' }, 'Your learning apps'),
          h('p', { class: 'home-intro' }, 'Choose a place to begin.'),
          h('div', { class: 'home-app-search', role: 'search', 'aria-label': 'Search learning apps' }, [
            h('label', { for: 'home-app-search', class: 'visually-hidden' }, 'Search apps'),
            h(Icon, { name: 'search' }),
            h('input', { id: 'home-app-search', ref: searchInput, type: 'search', placeholder: 'Search apps',
              value: query.value, autocomplete: 'off', spellcheck: false, 'aria-controls': 'home-app-grid',
              onInput: (event: Event) => { query.value = inputValue(event); },
              onKeydown: (event: KeyboardEvent) => { if (event.key === 'Escape' && query.value && !event.isComposing) { event.preventDefault(); clearSearch(); } },
            }),
            query.value ? h('button', { type: 'button', class: 'icon-button home-search-clear',
              title: 'Clear search', 'aria-label': 'Clear search', onClick: clearSearch }, '×') : null,
          ]),
          h('p', { class: 'visually-hidden', role: 'status' }, `${apps.value.length} ${apps.value.length === 1 ? 'app' : 'apps'}${query.value.trim() ? ' found' : ''}`),
          h(TransitionGroup, { tag: 'ul', id: 'home-app-grid', class: 'home-app-grid', name: 'home-apps', appear: true,
            onBeforeLeave: pinLeavingCard, onAfterLeave: clearCardPosition, onLeaveCancelled: clearCardPosition,
          }, { default: () => apps.value.length ? groups.value.flatMap(group => [
            h('li', { key: `group-${group.id}`, class: 'home-app-group-heading' }, [h('h3', group.label)]),
            ...group.apps.map((feature) =>
            h('li', { key: feature.id }, [
              h('a', {
                class: 'home-app-card', href: pageHref(feature.path),
                onClick: (event: MouseEvent) => emit('navigate', event, feature.path),
              }, [
                feature.image
                  ? h(AppIcon, { name: feature.id, imageClass: 'home-app-icon' })
                  : feature.icon ? h(Icon, { name: feature.icon }) : null,
                h('h4', feature.label),
                h('p', feature.description),
                h('span', { class: 'home-app-open' }, ['Open ', feature.label, h(Icon, { name: 'chevron' })]),
              ]),
            ])),
          ]) : [h('li', { key: 'no-matching-apps', class: 'home-search-empty' }, [h('h3', 'No matching apps'),
              h('p', 'Try another name or topic, or clear your search.')])] }),
        ]),
        h('footer', { class: 'home-footer' }, [
          h('p', 'Your workspace saves in this browser. Keep a downloadable backup from the navigation menu.'),
          h('div', { class: 'home-footer-details' }, [
            h('span', ['Licensed under ', h('a', {
              href: `${appConfig.repositoryUrl}/blob/main/LICENSE`,
            }, appConfig.license)]),
            h('a', { href: appConfig.repositoryUrl }, 'GitHub repository'),
            h('span', ['Today · ', h('time', { datetime: dateValue }, formatter.format(date))]),
          ]),
        ]),
      ]);
    };
  },
});
