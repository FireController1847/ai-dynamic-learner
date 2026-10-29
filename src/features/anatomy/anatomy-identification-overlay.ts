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
const position = (index: number, total: number) => {
  const side = index % 2 === 0 ? 'left' : 'right';
  const count = Math.ceil((total - (side === 'left' ? 0 : 1)) / 2);
  const row = Math.floor(index / 2);
  return { side, top: ((row + 1) / (count + 1)) * 100 };
};

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
    const width = ref(1);
    const height = ref(1);
    let resize: ResizeObserver | null = null;

    function measure() {
      const overlay = root.value;
      const stage = overlay?.parentElement;
      if (!overlay || !stage) return;
      const bounds = stage.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const shapes = Array.from(stage.querySelectorAll<SVGGraphicsElement>('[data-anatomy-structure-id]'));
      const next: Record<string, Endpoint> = {};
      for (const item of props.page.items) {
        const shape = shapes.find(el => el.getAttribute('data-anatomy-structure-id') === item.id);
        const label = Array.from(overlay.querySelectorAll<HTMLElement>('[data-identification-label]'))
          .find(el => el.getAttribute('data-identification-label') === item.id);
        if (!shape || !label) continue;
        const bone = shape.getBoundingClientRect();
        const input = label.getBoundingClientRect();
        const side = label.dataset.side;
        next[item.id] = {
          x: bone.left + bone.width / 2 - bounds.left,
          y: bone.top + bone.height / 2 - bounds.top,
          labelX: (side === 'left' ? input.right : input.left) - bounds.left,
          labelY: input.top + input.height / 2 - bounds.top,
        };
      }
      const previous = points.value;
      const same = width.value === bounds.width && height.value === bounds.height
        && Object.keys(next).length === Object.keys(previous).length
        && Object.entries(next).every(([id, p]) => {
          const old = previous[id];
          return old && Object.keys(p).every(key =>
            Math.abs(p[key as keyof Endpoint] - old[key as keyof Endpoint]) < 0.4);
        });
      if (!same) {
        width.value = bounds.width;
        height.value = bounds.height;
        points.value = next;
      }
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
        const place = position(index, props.page.items.length);
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
          style: { top: place.top + '%' },
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
