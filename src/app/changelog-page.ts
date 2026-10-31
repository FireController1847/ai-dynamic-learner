import { defineComponent, h, onBeforeUnmount, ref, watch } from 'vue';
import { featureDefinitions } from '../features/feature-definitions.ts';
import { MarkdownContent } from '../components/markdown-content.ts';
import { Icon } from '../components/icon.ts';
import { pageHref } from './navigation.ts';

// Static release notes are not learning features or workspace records.
const tabs = [
  { id: 'all', label: 'All Apps' },
  ...featureDefinitions.filter(feature => !feature.hidden).map(feature => ({ id: feature.id, label: feature.label })),
];

export const ChangelogPage = defineComponent({
  name: 'ChangelogPage',
  setup() {
    const selected = ref(tabs[0].id);
    const text = ref<string | null>(null);
    const loading = ref(false);
    const failed = ref(false);
    const cache = new Map<string, string | null>();
    let request: AbortController | null = null;

    async function load() {
      request?.abort();
      request = null;
      failed.value = false;
      const id = selected.value;
      const cached = cache.get(id);
      if (cached !== undefined) {
        text.value = cached;
        loading.value = false;
        return;
      }
      text.value = null;
      loading.value = true;
      const pending = new AbortController();
      request = pending;
      try {
        const response = await fetch(pageHref('/changelogs/' + id + '.md'), { signal: pending.signal });
        if (pending.signal.aborted) return;
        if (response.status === 404) {
          cache.set(id, null);
          return;
        }
        if (!response.ok || response.headers.get('content-type')?.includes('text/html')) {
          throw new Error('Unable to read release notes');
        }
        const markdown = (await response.text()).trim();
        if (pending.signal.aborted) return;
        text.value = markdown || null;
        cache.set(id, text.value);
      } catch {
        if (!pending.signal.aborted) failed.value = true;
      } finally {
        if (!pending.signal.aborted) {
          loading.value = false;
          request = null;
        }
      }
    }

    watch(selected, () => { void load(); }, { immediate: true });
    onBeforeUnmount(() => request?.abort());

    function moveTab(event: KeyboardEvent, index: number) {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selected.value = tabs[next].id;
      const tabButtons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      tabButtons?.[next]?.focus();
    }

    return () => h('section', { class: 'changelog-page', 'aria-label': 'Development changelogs' }, [
      h('div', { class: 'changelog-intro' }, [
        h('h2', 'Development changelogs'),
        h('p', 'Updates and improvements across Dynamic Learner.'),
      ]),
      h('div', { class: 'changelog-tabs', role: 'tablist', 'aria-label': 'Choose an app' },
        tabs.map((tab, index) => h('button', {
          key: tab.id,
          id: 'changelog-tab-' + tab.id,
          type: 'button',
          class: 'changelog-tab',
          role: 'tab',
          'aria-selected': selected.value === tab.id,
          'aria-controls': 'changelog-panel',
          tabindex: selected.value === tab.id ? 0 : -1,
          onClick: () => { selected.value = tab.id; },
          onKeydown: (event: KeyboardEvent) => moveTab(event, index),
        }, tab.label))),
      h('section', {
        id: 'changelog-panel',
        class: 'changelog-panel',
        role: 'tabpanel',
        'aria-labelledby': 'changelog-tab-' + selected.value,
        tabindex: 0,
        'aria-busy': loading.value,
      }, [
        loading.value ? h('p', { class: 'changelog-message', role: 'status' }, 'Loading updates…')
          : failed.value ? h('div', { class: 'changelog-message', role: 'alert' }, [
            h('p', 'Unable to load updates right now.'),
            h('button', { type: 'button', class: 'quiet-button', onClick: () => { void load(); } }, 'Try again'),
          ])
          : text.value ? h('article', { class: 'changelog-article' }, [
            h(MarkdownContent, { text: text.value }),
          ])
          : h('div', { class: 'changelog-empty' }, [
            h(Icon, { name: 'scroll-text' }),
            h('h3', 'No updates yet'),
            h('p', 'Release notes for this section have not been published.'),
          ]),
      ]),
    ]);
  },
});
