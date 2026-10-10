import { computed, defineComponent, h, ref, type PropType } from 'vue';
import { APP_STATISTICS_METRICS, STATISTICS_LABELS, type StatisticsApp, type StatisticsInventoryEntry } from '../core/statistics.ts';
import { PopupDialog } from './popup-dialog.ts';
import { useStatistics } from './statistics-context.ts';

function countEntries(items: readonly StatisticsInventoryEntry[]): number {
  return items.reduce((sum, item) => sum + 1 + countEntries(item.children ?? []), 0);
}
export const GlobalStatistics = defineComponent({
  name: 'GlobalStatistics',
  props: { apps: { type: Array as PropType<readonly { id: StatisticsApp; label: string }[]>, required: true }, returnFocus: { type: Object as PropType<HTMLElement | null>, default: null } },
  emits: { close: () => true },
  setup(props, { emit }) {
    const statistics = useStatistics();
    const filter = ref<StatisticsApp | 'all'>('all');
    const totals = computed(() => statistics?.totals() ?? {});
    return () => !statistics ? null : h(PopupDialog, {
      title: 'Workspace statistics', headingId: 'global-statistics-title', width: 720, returnFocus: props.returnFocus,
      onClose: () => emit('close'),
    }, { default: () => [
      h('p', { class: 'statistics-note' }, `Tracking since ${new Date(statistics.data.value.startedAt).toLocaleDateString()}. Activity is saved in this workspace and included in backups.`),
      h('div', { class: 'statistics-overview' }, [
        ...[
          [props.apps.reduce((sum, app) => sum + countEntries(statistics.inventory.value[app.id] ?? []), 0), 'Library entries'],
          [totals.value.views ?? 0, 'Times opened'],
          [(totals.value.reviews ?? 0) + (totals.value.studyPasses ?? 0) + (totals.value.quizzes ?? 0) + (totals.value.tests ?? 0), 'Completed review / assessment passes'],
        ].map(([count, label]) => h('div', [h('strong', Number(count).toLocaleString()), h('span', String(label))])),
      ]),
      h('div', { class: 'statistics-filters', role: 'group', 'aria-label': 'Statistics app' }, [
        h('button', { type: 'button', class: 'quiet-button', 'aria-pressed': filter.value === 'all', onClick: () => { filter.value = 'all'; } }, 'All apps'),
        ...props.apps.map(app => h('button', { type: 'button', class: 'quiet-button', 'aria-pressed': filter.value === app.id, onClick: () => { filter.value = app.id; } }, app.label)),
      ]),
      ...props.apps.filter(app => filter.value === 'all' || filter.value === app.id).map(app => {
        const counts = statistics.data.value.apps[app.id]?.counts ?? {};
        return h('section', { class: 'statistics-app', key: app.id }, [
          h('h3', app.label),
          app.id !== 'calculator' ? h('p', { class: 'statistics-note' }, `${countEntries(statistics.inventory.value[app.id] ?? [])} current library entries`) : null,
          h('dl', APP_STATISTICS_METRICS[app.id].flatMap(metric => [h('dt', STATISTICS_LABELS[metric]), h('dd', (counts[metric] ?? 0).toLocaleString())])),
        ]);
      }),
      h('p', { class: 'statistics-note' }, 'Lifetime totals include activity on entries later deleted. Group statistics summarize their current descendants. Past activity from before tracking began is not reconstructed.'),
    ] });
  },
});
