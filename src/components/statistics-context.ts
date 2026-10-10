import { computed, inject, onActivated, onDeactivated, onMounted, provide, ref, watch, type ComputedRef, type InjectionKey } from 'vue';
import { STATISTICS_APPS, emptyStatistics, sumStatistics, type StatisticsApp, type StatisticsCounts, type StatisticsData, type StatisticsInventory, type StatisticsInventoryEntry, type StatisticsMetric } from '../core/statistics.ts';

interface StatisticsContext {
  data: ComputedRef<StatisticsData>;
  inventory: ComputedRef<StatisticsInventory>;
  record(app: StatisticsApp, id: string | null, metric: StatisticsMetric, amount?: number): void;
  entry(app: StatisticsApp, id: string): StatisticsCounts;
  lastActivity(app: StatisticsApp, id: string): string | null;
  totals(): StatisticsCounts;
}
const KEY: InjectionKey<StatisticsContext> = Symbol('workspace-statistics');

function flatten(items: readonly StatisticsInventoryEntry[]): StatisticsInventoryEntry[] {
  return items.flatMap(item => [item, ...flatten(item.children ?? [])]);
}
export function provideStatistics(options: { data(): StatisticsData | undefined; setData(data: StatisticsData): void; inventory(): StatisticsInventory }) {
  const data = computed(() => options.data() ?? emptyStatistics());
  const inventory = computed(options.inventory);
  const entries = computed(() => Object.fromEntries(STATISTICS_APPS.map(app => [app, flatten(inventory.value[app] ?? [])])) as Record<StatisticsApp, StatisticsInventoryEntry[]>);
  function selected(app: StatisticsApp, id: string) { return entries.value[app].find(item => item.id === id); }
  const context: StatisticsContext = {
    data, inventory,
    record(app, id, metric, amount = 1) {
      if (!Number.isSafeInteger(amount) || amount < 1 || (id && !selected(app, id))) return;
      if (!options.data()) options.setData(emptyStatistics());
      const stored = options.data()!;
      const record = stored.apps[app] ??= { counts: {}, entries: {} };
      record.counts[metric] = Math.min(Number.MAX_SAFE_INTEGER, (record.counts[metric] ?? 0) + amount);
      if (id) {
        // Imported IDs can be object property names; create an own property safely.
        if (!Object.hasOwn(record.entries, id)) {
          record.entries = { ...record.entries, [id]: { counts: {}, lastActivityAt: new Date().toISOString() } };
        }
        const entry = record.entries[id];
        entry.counts[metric] = Math.min(Number.MAX_SAFE_INTEGER, (entry.counts[metric] ?? 0) + amount);
        entry.lastActivityAt = new Date().toISOString();
      }
    },
    entry(app, id) {
      const item = selected(app, id);
      return sumStatistics((item ? flatten([item]) : []).map(item => data.value.apps[app]?.entries[item.id]?.counts ?? {}));
    },
    lastActivity(app, id) {
      const item = selected(app, id);
      return (item ? flatten([item]) : []).map(item => data.value.apps[app]?.entries[item.id]?.lastActivityAt ?? '')
        .sort().at(-1) || null;
    },
    totals: () => sumStatistics(Object.values(data.value.apps).map(app => app.counts)),
  };
  provide(KEY, context);
  // Deleted entries leave lifetime totals intact, but don't accumulate orphan rows.
  watch(entries, current => {
    const stored = options.data();
    if (!stored) return;
    for (const app of STATISTICS_APPS) {
      const record = stored.apps[app];
      if (!record) continue;
      const ids = new Set(current[app].map(item => item.id));
      for (const id of Object.keys(record.entries)) if (!ids.has(id)) delete record.entries[id];
    }
  }, { immediate: true });
  return context;
}

export function useStatistics() { return inject(KEY, null); }

/** Count actual content visits, never renders, edits, flips, or hidden cached views. */
export function useStatisticsVisits(app: StatisticsApp, id: () => string | null, visible: () => boolean = () => true,
  metric: StatisticsMetric = 'views', token: () => string | null = id) {
  const statistics = useStatistics();
  const active = ref(false);
  onMounted(() => { active.value = true; });
  onActivated(() => { active.value = true; });
  onDeactivated(() => { active.value = false; });
  watch(() => active.value && visible() ? `${id() ?? ''}:${token() ?? ''}` : null, value => {
    const entry = id();
    if (value && (entry || app === 'calculator') && token()) statistics?.record(app, entry, metric);
  });
}
