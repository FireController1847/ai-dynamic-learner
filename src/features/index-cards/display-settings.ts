import type { DisplayOptions } from './display-options.ts';
import { inputValue } from '../../core/dom.ts';
import { useDialog } from '../../components/use-dialog.ts';
import { DISPLAY_FIELDS, defaultDisplayOptions } from './display-options.ts';

import { defineComponent, type PropType, h } from 'vue';

export const DisplaySettings = defineComponent({
  name: 'DisplaySettings',
  props: { options: { type: Object as PropType<DisplayOptions>, required: true } },
  emits: { 'update': (_options: DisplayOptions) => true, 'close': () => true },
  setup(props, { emit }) {
    const { dialog } = useDialog();

    function control(field: (typeof DISPLAY_FIELDS)[number]) {
      const id = `card-display-${field.key}`;
      const update = (event: Event) => emit('update', {
        ...props.options,
        [field.key]: field.choices ? inputValue(event) : Number(inputValue(event)),
      });
      return h('div', { class: 'display-setting', key: field.key }, [
        h('label', { for: id }, field.label),
        field.choices ? h('select', { id, value: props.options[field.key], onChange: update },
          field.choices.map((choice) => h('option', { value: choice.value }, choice.label)))
          : h('div', { class: 'display-setting-range' }, [
            h('input', {
              id, type: 'range', min: field.min, max: field.max, step: field.step,
              value: props.options[field.key], onInput: update,
              'aria-valuetext': `${props.options[field.key]} ${field.unit}`,
            }),
            h('output', { for: id }, `${props.options[field.key]}${field.unit}`),
          ]),
      ]);
    }

    return () => h('dialog', {
      ref: dialog, class: 'display-settings', 'aria-labelledby': 'display-settings-title',
      onCancel: (event: Event) => { event.preventDefault(); emit('close'); },
    }, [
      h('header', { class: 'display-settings-header' }, [
        h('h2', { id: 'display-settings-title' }, 'Display options'),
        h('button', { type: 'button', class: 'quiet-button', autofocus: true, onClick: () => emit('close') }, 'Done'),
      ]),
      h('p', { class: 'display-settings-description' }, 'Applies to every set. Changes save automatically and are included in backups.'),
      h('div', { class: 'display-settings-fields' }, DISPLAY_FIELDS.map(control)),
      h('p', { class: 'display-settings-description' }, 'Text size changes the letters, not the line spacing. Positive vertical offsets move text down. Card size keeps the 5:3 shape and fits the available space.'),
      h('div', { class: 'display-settings-preview', 'aria-label': 'Card appearance preview' }, [
        h('div', { class: 'ruled-card-stack' }, [
          h('div', { class: 'card-face' }, [
            h('div', { class: 'card-face-heading' }, [
              h('input', { class: 'card-title-input', value: 'Your index cards', readonly: true, tabindex: -1, 'aria-label': 'Preview title' }),
            ]),
            h('textarea', {
              class: 'card-writing', readonly: true, 'aria-label': 'Preview text',
              value: 'A thought to keep.\nEach line has room.\n\nSerif or Sans.\n\n\n\n\nThe last sample line.',
            }),
          ]),
        ]),
      ]),
      h('button', {
        type: 'button', class: 'quiet-button',
        onClick: () => emit('update', defaultDisplayOptions()),
      }, 'Reset display defaults'),
    ]);
  },
});
