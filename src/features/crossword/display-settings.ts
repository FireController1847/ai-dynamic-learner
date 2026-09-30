import type { DisplayOptions } from './display-options.ts';
import { inputValue } from '../../core/dom.ts';
import { useDialog } from '../../components/use-dialog.ts';
import { DISPLAY_FIELDS, defaultDisplayOptions, displayStyles } from './display-options.ts';

import { defineComponent, type PropType, h } from 'vue';

const preview = [
  ['1', 'C'], ['', 'A'], ['', 'T'], ['#', ''],
  ['', 'O'], ['#', ''], ['2', 'R'], ['', 'E'],
  ['3', 'D'], ['', 'A'], ['', 'T'], ['', 'A'],
  ['#', ''], ['', 'E'], ['#', ''], ['', 'D'],
] as const;

export const DisplaySettings = defineComponent({
  name: 'CrosswordDisplaySettings',
  props: { options: { type: Object as PropType<DisplayOptions>, required: true } },
  emits: { 'update': (_options: DisplayOptions) => true, 'close': () => true },
  setup(props, { emit }) {
    const { dialog } = useDialog();

    return () => h('dialog', {
      ref: dialog,
      class: 'crossword-display-settings',
      'aria-labelledby': 'crossword-display-title',
      onCancel: (event: Event) => { event.preventDefault(); emit('close'); },
    }, [
      h('header', [
        h('h2', { id: 'crossword-display-title' }, 'Crossword display'),
        h('button', {
          type: 'button',
          class: 'quiet-button',
          autofocus: true,
          onClick: () => emit('close'),
        }, 'Done'),
      ]),
      h('p', { class: 'crossword-help' },
        'Applies to every crossword. Changes save automatically and are included in backups.'),
      ...DISPLAY_FIELDS.map((field) => {
        const id = `crossword-display-${String(field.key)}`;
        const disabled = field.key === 'cellSize' && props.options.fit === 'screen';
        const update = (event: Event) => emit('update', {
          ...props.options,
          [field.key]: field.choices ? inputValue(event) : Number(inputValue(event)),
        });
        return h('div', {
          key: String(field.key),
          class: ['crossword-display-field', { 'is-disabled': disabled }],
        }, [
          h('label', { for: id }, field.label),
          field.choices
            ? h('select', { id, value: props.options[field.key], onChange: update },
              field.choices.map((choice) => h('option', { value: choice.value }, choice.label)))
            : h('div', { class: 'crossword-display-range' }, [
              h('input', {
                id,
                type: 'range',
                min: field.min,
                max: field.max,
                step: field.step,
                value: props.options[field.key],
                disabled,
                onInput: update,
                'aria-valuetext': `${props.options[field.key]}${field.unit}`,
              }),
              h('output', { for: id }, `${props.options[field.key]}${field.unit}`),
            ]),
        ]);
      }),
      h('p', { class: 'crossword-help' },
        'Fit mode chooses the largest readable cells that fit the available area. Larger puzzles scroll when necessary.'),
      h('div', {
        class: 'crossword-display-preview',
        style: displayStyles(props.options),
        'aria-label': 'Crossword appearance preview',
      }, preview.map(([number, letter]) =>
        number === '#'
          ? h('span', { class: 'crossword-display-preview-cell is-blocked' })
          : h('span', { class: 'crossword-display-preview-cell' }, [
            number ? h('small', number) : null,
            h('strong', letter),
          ]))),
      h('button', {
        type: 'button',
        class: 'quiet-button',
        onClick: () => emit('update', defaultDisplayOptions()),
      }, 'Reset display defaults'),
    ]);
  },
});
