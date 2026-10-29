import { computed, defineComponent, h, ref, watch, type PropType } from 'vue';
import type { AtlasSystemId } from './atlas-model.ts';
import type { IdentificationSection } from './anatomy-identification.ts';
import type { AnatomyIdentificationAttempt } from './anatomy-history.ts';

export const AnatomyIdentificationSelection = defineComponent({
  name: 'AnatomyIdentificationSelection',
  props: {
    sections: { type: Array as PropType<readonly IdentificationSection[]>, required: true },
    attempts: { type: Array as PropType<readonly AnatomyIdentificationAttempt[]>, required: true },
    systemId: { type: String as PropType<AtlasSystemId>, required: true },
    scope: { type: String, required: true },
  },
  emits: {
    start: (_id: string) => true,
    deleteAttempt: (_id: string) => true,
    resetSection: (_id: string) => true,
    resetAll: () => true,
  },
  setup(props, { emit }) {
    // The user must click Reset twice. A different action cancels the pending
    // confirmation, preventing accidental loss of a whole results history.
    const pendingReset = ref('');
    watch(() => props.scope, () => { pendingReset.value = ''; });
    const groups = computed(() => {
      const categories = new Map<string, IdentificationSection[]>();
      for (const section of props.sections) {
        const list = categories.get(section.category) ?? [];
        list.push(section);
        categories.set(section.category, list);
      }
      return [...categories];
    });
    function resetAll() {
      if (pendingReset.value !== 'all') { pendingReset.value = 'all'; return; }
      emit('resetAll');
      pendingReset.value = '';
    }
    function resetSection(id: string) {
      const key = 'section:' + id;
      if (pendingReset.value !== key) { pendingReset.value = key; return; }
      emit('resetSection', id);
      pendingReset.value = '';
    }
    function cancelReset() { pendingReset.value = ''; }

    return () => {
      const allHistory = props.attempts.filter(attempt => attempt.systemId === props.systemId);
      return h('section', {
        class: 'anatomy-identification-selection',
        role: 'region', 'aria-label': 'Choose an identification section',
      }, [
        h('header', { class: 'anatomy-identification-selection-header' }, [
          h('div', [
            h('h2', 'Choose what to identify'),
            h('p', 'Pick a section to practice. Your completed results are kept in this workspace.'),
          ]),
          allHistory.length ? h('div', { class: 'anatomy-identification-reset-all' }, [
            h('button', {
              type: 'button',
              class: 'quiet-button',
              onClick: resetAll,
            }, pendingReset.value === 'all' ? 'Confirm reset all' : 'Reset all results'),
            pendingReset.value === 'all' ? h('button', {
              type: 'button', class: 'quiet-button', onClick: cancelReset,
            }, 'Cancel') : null,
          ]) : null,
        ]),
        ...groups.value.map(([category, sections]) => h('section', {
          key: category, class: 'anatomy-identification-selection-group',
        }, [
          h('h3', category),
          h('div', { class: 'anatomy-identification-section-grid' }, sections.map(section => {
            const history = props.attempts
              .filter(attempt => attempt.systemId === props.systemId &&
                attempt.scope === props.scope && attempt.sectionId === section.id)
              .sort((a, b) => b.completedAt - a.completedAt);
            const latest = history[0];
            const best = history.length ? Math.max(...history.map(item => item.score / item.total)) : null;
            const resetKey = 'section:' + section.id;
            return h('article', { class: 'anatomy-identification-section', key: section.id }, [
              h('div', { class: 'anatomy-identification-section-line' }, [
                h('div', { class: 'anatomy-identification-section-title' }, [
                  h('strong', section.title),
                  h('span', section.count + (section.count === 1 ? ' structure' : ' structures')),
                ]),
                h('button', {
                  type: 'button', class: 'quiet-button anatomy-identification-study',
                  onClick: () => { pendingReset.value = ''; emit('start', section.id); },
                }, 'Study'),
              ]),
              latest ? h('div', { class: 'anatomy-identification-section-stats' }, [
                h('span', 'Last ' + latest.score + '/' + latest.total),
                h('span', 'Best ' + Math.round((best ?? 0) * 100) + '%'),
                h('span', history.length + (history.length === 1 ? ' attempt' : ' attempts')),
              ]) : h('p', { class: 'anatomy-identification-untried' }, 'Not studied yet'),
              history.length ? h('details', { class: 'anatomy-identification-history' }, [
                h('summary', 'Previous results'),
                h('ul', history.map(item => h('li', { key: item.id }, [
                  h('span', [
                    h('strong', item.score + '/' + item.total),
                    ' · ',
                    h('time', { datetime: new Date(item.completedAt).toISOString() },
                      new Date(item.completedAt).toLocaleString()),
                  ]),
                  h('button', {
                    type: 'button', class: 'quiet-button anatomy-identification-delete-attempt',
                    'aria-label': 'Delete result from ' + new Date(item.completedAt).toLocaleString(),
                    onClick: () => emit('deleteAttempt', item.id),
                  }, 'Remove'),
                ]))),
                h('div', { class: 'anatomy-identification-reset-section' }, [
                  h('button', { type: 'button', class: 'quiet-button',
                    onClick: () => resetSection(section.id) },
                  pendingReset.value === resetKey ? 'Confirm reset' : 'Reset section results'),
                  pendingReset.value === resetKey
                    ? h('button', { type: 'button', class: 'quiet-button', onClick: cancelReset }, 'Cancel')
                    : null,
                ]),
              ]) : null,
            ]);
          })),
        ])),
      ]);
    };
  },
});
