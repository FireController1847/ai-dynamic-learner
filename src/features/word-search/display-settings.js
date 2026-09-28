import { DISPLAY_FIELDS, defaultDisplayOptions } from './display-options.js';
import { PuzzleGrid } from './puzzle-grid.js';

const { h, onMounted, onBeforeUnmount, onDeactivated, ref } = window.Vue;
const preview = {
  rows: ['TACROW', 'ORIVEO', 'WONDER', 'LEAFSD', 'MOSSAS', 'FERNXT'],
  found: [{ word: 'CAT', start: 2, end: 0 }, { word: 'WONDER', start: 12, end: 17 }],
  placements: [],
};

export const DisplaySettings = {
  name: 'WordSearchDisplaySettings',
  props: { options: { type: Object, required: true } },
  emits: ['update', 'close'],
  setup(props, { emit }) {
    const dialog = ref(null);
    const close = () => { if (dialog.value?.open) dialog.value.close(); };
    onMounted(() => dialog.value.showModal());
    onBeforeUnmount(close);
    onDeactivated(close);
    return () => h('dialog', {
      ref: dialog, class: 'word-search-display-settings', 'aria-labelledby': 'search-display-title',
      onCancel: (event) => { event.preventDefault(); emit('close'); },
    }, [
      h('header', [
        h('h2', { id: 'search-display-title' }, 'Word Search display'),
        h('button', { type: 'button', class: 'quiet-button', autofocus: true, onClick: () => emit('close') }, 'Done'),
      ]),
      h('p', { class: 'word-search-help' }, 'Applies to every word search. Changes save automatically and are included in backups.'),
      ...DISPLAY_FIELDS.map((field) => {
        const id = `search-display-${field.key}`;
        const disabled = field.key === 'cellSize' && props.options.fit === 'screen';
        const update = (event) => emit('update', {
          ...props.options, [field.key]: field.choices ? event.target.value : Number(event.target.value),
        });
        return h('div', { class: ['word-search-display-field', { 'is-disabled': disabled }], key: field.key }, [
          h('label', { for: id }, field.label),
          field.choices ? h('select', { id, value: props.options[field.key], onChange: update },
            field.choices.map((choice) => h('option', { value: choice.value }, choice.label)))
            : h('div', { class: 'word-search-display-range' }, [
              h('input', {
                id, type: 'range', min: field.min, max: field.max, step: field.step,
                value: props.options[field.key], onInput: update, disabled,
                'aria-describedby': disabled ? 'search-fit-help' : undefined,
                'aria-valuetext': `${props.options[field.key]}${field.unit}`,
              }),
              h('output', { for: id }, `${props.options[field.key]}${field.unit}`),
            ]),
        ]);
      }),
      h('p', { id: 'search-fit-help', class: 'word-search-help' }, 'Fit mode chooses cell size automatically, with a 30px minimum. Choose “Use preferred cell size” to adjust it yourself. Larger puzzles scroll when needed.'),
      h('p', { id: 'search-preview-help', class: 'word-search-help' }, 'Preview: try dragging or choosing two letters.'),
      h(PuzzleGrid, { game: preview, options: props.options, helpId: 'search-preview-help' }),
      h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('update', defaultDisplayOptions()) }, 'Reset display defaults'),
    ]);
  },
};
