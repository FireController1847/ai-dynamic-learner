import { defineComponent, h, onBeforeUnmount, onMounted, onUpdated, ref, type PropType } from 'vue';
import type { IdentificationItem, IdentificationPage } from './anatomy-identification.ts';
import { isIdentificationCorrect } from './anatomy-identification.ts';
import { inputValue } from '../../core/dom.ts';

interface Endpoint {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
}
type LabelSide = 'left' | 'right';
interface Placement {
  side: LabelSide;
  top: number;
}
interface Target {
  id: string;
  x: number;
  y: number;
  height: number;
  side: LabelSide;
}

/**
 * Keep each blank on the same side as its actual on-screen bone, and keep
 * vertical order identical to bone order on each side. This prevents the
 * crossed leader lines caused by assigning sides from question indices.
 * Crowded labels are spread apart just enough to avoid overlapping.
 */
function arrange(targets: readonly Target[], stageHeight: number): Record<string, Placement> {
  const placements: Record<string, Placement> = {};
  for (const side of ['left', 'right'] as const) {
    const matches = targets.filter(target => target.side === side)
      .sort((a, b) => a.y - b.y);
    if (!matches.length) continue;
    const tallest = Math.max(...matches.map(target => target.height), 36);
    const inset = Math.min(stageHeight / 2, tallest / 2 + 12);
    const low = inset;
    const high = Math.max(low, stageHeight - inset);
    const gap = matches.length < 2 ? 0
      : Math.min(tallest + 8, (high - low) / (matches.length - 1));
    const positions = matches.map(target => Math.max(low, Math.min(high, target.y)));
    for (let i = 1; i < positions.length; i++) {
      positions[i] = Math.max(positions[i], positions[i - 1] + gap);
    }
    if (positions[positions.length - 1] > high) {
      positions[positions.length - 1] = high;
      for (let i = positions.length - 2; i >= 0; i--) {
        positions[i] = Math.min(positions[i], positions[i + 1] - gap);
      }
    }
    if (positions[0] < low) {
      positions[0] = low;
      for (let i = 1; i < positions.length; i++) {
        positions[i] = Math.max(positions[i], positions[i - 1] + gap);
      }
    }
    matches.forEach((item, i) => { placements[item.id] = { side, top: positions[i] }; });
  }
  return placements;
}

// Separate overlay from the atlas renderer. Future systems only provide
// IdentificationPage items and selectable SVG geometry; the leader-line,
// answer-entry and response UI is shared.
export const AnatomyIdentificationOverlay = defineComponent({
  name: 'AnatomyIdentificationOverlay',
  props: {
    page: { type: Object as PropType<IdentificationPage>, required: true },
    answers: { type: Object as PropType<Readonly<Record<string, string>>>, required: true },
    checkedIds: { type: Array as PropType<readonly string[]>, required: true },
    skippedIds: { type: Array as PropType<readonly string[]>, required: true },
    cameraKey: { type: String, required: true },
  },
  emits: {
    answer: (_id: string, _value: string) => true,
    check: () => true,
  },
  setup(props, { emit }) {
    const root = ref<HTMLElement | null>(null);
    const points = ref<Record<string, Endpoint>>({});
    const placements = ref<Record<string, Placement>>({});
    const width = ref(1);
    const height = ref(1);
    let resize: ResizeObserver | null = null;

    function measure() {
      const overlay = root.value;
      const stage = overlay?.parentElement;
      if (!overlay || !stage) return;
      const bounds = stage.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const geometry = new Map<string, SVGGraphicsElement>();
      stage.querySelectorAll<SVGGraphicsElement>('[data-anatomy-structure-id]')
        .forEach(element => {
          const id = element.getAttribute('data-anatomy-structure-id');
          if (id && !geometry.has(id)) geometry.set(id, element);
        });
      const inputs = new Map<string, HTMLElement>();
      overlay.querySelectorAll<HTMLElement>('[data-identification-label]')
        .forEach(element => {
          const id = element.getAttribute('data-identification-label');
          if (id) inputs.set(id, element);
        });

      const targets: Target[] = [];
      for (const item of props.page.items) {
        const shape = geometry.get(item.id);
        const label = inputs.get(item.id);
        if (!shape || !label) continue;
        const rect = shape.getBoundingClientRect();
        const x = rect.left + rect.width / 2 - bounds.left;
        const y = rect.top + rect.height / 2 - bounds.top;
        targets.push({
          id: item.id, x, y, height: label.getBoundingClientRect().height,
          side: x <= bounds.width / 2 ? 'left' : 'right',
        });
      }

      const nextPlacement = arrange(targets, bounds.height);
      const oldPlacement = placements.value;
      const placementChanged = Object.keys(nextPlacement).length !== Object.keys(oldPlacement).length
        || Object.entries(nextPlacement).some(([id, next]) => {
          const old = oldPlacement[id];
          return !old || old.side !== next.side || Math.abs(old.top - next.top) >= 0.4;
        });
      if (placementChanged) placements.value = nextPlacement;

      // After Vue applies the chosen side/vertical positions, the following
      // render measures the actual card edges for pixel-perfect leader starts.
      const endpoints: Record<string, Endpoint> = {};
      for (const target of targets) {
        const label = inputs.get(target.id);
        const location = nextPlacement[target.id];
        if (!label || !location) continue;
        const rect = label.getBoundingClientRect();
        endpoints[target.id] = {
          x: target.x, y: target.y,
          labelX: (location.side === 'left' ? rect.right : rect.left) - bounds.left,
          labelY: rect.top + rect.height / 2 - bounds.top,
        };
      }
      const prior = points.value;
      const pointsChanged = Object.keys(endpoints).length !== Object.keys(prior).length
        || Object.entries(endpoints).some(([id, point]) => {
          const old = prior[id];
          return !old || Math.abs(point.x - old.x) >= 0.4
            || Math.abs(point.y - old.y) >= 0.4
            || Math.abs(point.labelX - old.labelX) >= 0.4
            || Math.abs(point.labelY - old.labelY) >= 0.4;
        });
      if (width.value !== bounds.width) width.value = bounds.width;
      if (height.value !== bounds.height) height.value = bounds.height;
      if (pointsChanged) points.value = endpoints;
    }
    onMounted(() => {
      measure();
      const stage = root.value?.parentElement;
      if (stage && typeof ResizeObserver !== 'undefined') {
        resize = new ResizeObserver(measure);
        resize.observe(stage);
      }
    });
    onUpdated(measure);
    onBeforeUnmount(() => resize?.disconnect());

    return () => h('div', {
      ref: root,
      class: 'anatomy-identification-overlay',
      role: 'group',
      'aria-label': 'Identify the connected anatomical structures',
    }, [
      h('svg', {
        class: 'anatomy-identification-leaders',
        viewBox: '0 0 ' + width.value + ' ' + height.value,
        preserveAspectRatio: 'none',
        'aria-hidden': 'true',
      }, props.page.items.flatMap(item => {
        const p = points.value[item.id];
        if (!p) return [];
        const rightward = p.labelX < p.x;
        const control = Math.max(24, Math.min(90, Math.abs(p.x - p.labelX) * 0.42));
        const d = 'M ' + p.labelX + ' ' + p.labelY
          + ' C ' + (p.labelX + (rightward ? control : -control)) + ' ' + p.labelY
          + ' ' + (p.x + (rightward ? -control : control)) + ' ' + p.y
          + ' ' + p.x + ' ' + p.y;
        return [
          h('path', { key: item.id + '.leader', d, class: 'anatomy-identification-leader' }),
          h('circle', { key: item.id + '.point', cx: p.x, cy: p.y,
            r: 3.5, class: 'anatomy-identification-target' }),
        ];
      })),
      ...props.page.items.map((item: IdentificationItem, index) => {
        const positioned = placements.value[item.id];
        const place = positioned ?? { side: 'left' as const, top: 0 };
        const checked = props.checkedIds.includes(item.id);
        const correct = checked && isIdentificationCorrect(item, props.answers[item.id] ?? '');
        const skipped = props.skippedIds.includes(item.id)
          && !(props.answers[item.id] ?? '').trim();
        return h('label', {
          key: item.id,
          'data-identification-label': item.id,
          'data-side': place.side,
          class: ['anatomy-identification-label', 'is-' + place.side,
            { 'is-correct': correct, 'is-incorrect': checked && !correct,
              'is-skipped': skipped }],
          style: { top: positioned
            ? place.top + 'px'
            : ((index + 1) / (props.page.items.length + 1)) * 100 + '%' },
        }, [
          h('span', { class: 'anatomy-identification-number', 'aria-hidden': 'true' }, String(index + 1)),
          h('input', {
            type: 'text', value: props.answers[item.id] ?? '',
            'aria-label': 'Structure ' + (index + 1) + ' in ' + props.page.group,
            autocomplete: 'off', autocapitalize: 'off', spellcheck: false,
            placeholder: ' ',
            onInput: (event: Event) => emit('answer', item.id, inputValue(event)),
            onKeydown: (event: KeyboardEvent) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                emit('check');
              }
            },
          }),
          skipped ? h('span', {
            class: 'anatomy-identification-result anatomy-identification-skipped',
            'aria-label': 'Skipped',
            title: 'Skipped',
          }, '–') : null,
          checked ? h('span', {
            class: 'anatomy-identification-result',
            'aria-label': correct ? 'Correct' : 'Try again',
            title: correct ? 'Correct' : 'Try again',
          }, correct ? '✓' : '×') : null,
        ]);
      }),
    ]);
  },
});
