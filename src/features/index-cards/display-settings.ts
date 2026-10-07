import type { CardDisplayOptions, DisplayOptions } from './display-options.ts';
import {
  DEFAULT_ANSWER_STRICTNESS,
  type AnswerStrictness,
} from './fill-blank-model.ts';
import type { SetModeId } from './set-modes.ts';
import { inputValue } from '../../core/dom.ts';
import { AnswerStrictnessField } from '../../components/answer-strictness-field.ts';
import { useDialog } from '../../components/use-dialog.ts';
import {
  DISPLAY_FIELDS, defaultCardDisplayOptions, displayForMode, displayStyles, resolvedDisplayOptions,
  validateDisplayOptions,
} from './display-options.ts';
import { SET_MODES } from './set-modes.ts';

import { defineComponent, type PropType, h, ref } from 'vue';

function keyForMode(mode: SetModeId): keyof DisplayOptions {
  return mode === 'fill-in-the-blanks' ? 'fillInTheBlanks' : 'flashCards';
}

export const DisplaySettings = defineComponent({
  name: 'DisplaySettings',
  props: {
    options: { type: Object as PropType<DisplayOptions>, required: true },
    answerStrictness: { type: Number as PropType<AnswerStrictness>, default: DEFAULT_ANSWER_STRICTNESS },
    initialTab: { type: String as PropType<SetModeId>, default: 'flash-cards' },
  },
  emits: {
    'update': (_options: DisplayOptions) => true,
    'update-answer-strictness': (_strictness: AnswerStrictness) => true,
    'close': () => true,
  },
  setup(props, { emit }) {
    const { dialog } = useDialog();
    const tab = ref<SetModeId>(props.initialTab);

    function selectTab(event: KeyboardEvent, index: number) {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % SET_MODES.length;
      else if (event.key === 'ArrowLeft') next = (index + SET_MODES.length - 1) % SET_MODES.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = SET_MODES.length - 1;
      else return;
      event.preventDefault();
      tab.value = SET_MODES[next]!.id;
      dialog.value?.querySelector<HTMLButtonElement>(`#index-cards-tab-${tab.value}`)?.focus();
    }

    function control(field: (typeof DISPLAY_FIELDS)[number]) {
      const mode = tab.value;
      const key = keyForMode(mode);
      const options = resolvedDisplayOptions(props.options);
      const modeOptions = displayForMode(options, mode);
      const value = modeOptions[field.key];
      const id = `card-display-${mode}-${field.key}`;
      const update = (event: Event) => {
        const next: DisplayOptions = {
          ...options,
          [key]: {
            ...modeOptions,
            [field.key]: field.choices ? inputValue(event) : Number(inputValue(event)),
          },
        };
        validateDisplayOptions(next);
        emit('update', next);
      };

      return h('div', { class: 'display-setting', key: id }, [
        h('label', { for: id }, field.label),
        field.choices ? h('select', { id, value, onChange: update },
          field.choices.map((choice) => h('option', { value: choice.value }, choice.label)))
          : h('div', { class: 'display-setting-range' }, [
            h('input', {
              id,
              type: 'range',
              min: field.min,
              max: field.max,
              step: field.step,
              value,
              onInput: update,
              'aria-valuetext': `${value}${field.unit}`,
            }),
            h('output', { for: id }, `${value}${field.unit}`),
          ]),
      ]);
    }

    function flashPreview(options: CardDisplayOptions) {
      return h('div', {
        class: 'display-settings-preview',
        style: displayStyles(options),
        'aria-label': 'Flash Cards appearance preview',
      }, [
        h('div', { class: 'ruled-card-stack' }, [
          h('div', { class: 'card-face' }, [
            h('div', { class: 'card-face-heading' }, [
              h('input', {
                class: 'card-title-input',
                value: 'Your index cards',
                readonly: true,
                tabindex: -1,
                'aria-label': 'Preview title',
              }),
            ]),
            h('textarea', {
              class: 'card-writing',
              readonly: true,
              tabindex: -1,
              'aria-label': 'Preview text',
              value: 'A thought to keep.\nEach line has room.\n\nSerif or Sans.\n\n\n\n\nThe last sample line.',
            }),
          ]),
        ]),
      ]);
    }

    function fillBlankPreview(options: CardDisplayOptions) {
      return h('div', {
        class: 'display-settings-preview',
        style: displayStyles(options),
        'aria-label': 'Fill in the Blanks appearance preview',
      }, [
        h('div', { class: 'ruled-card-stack' }, [
          h('div', { class: 'card-face fill-blank-face' }, [
            h('div', { class: 'card-face-heading' }, [
              h('span', { class: 'fill-blank-review-title' }, 'A quick recall'),
            ]),
            h('div', { class: 'fill-blank-writing fill-blank-settings-sample' }, [
              'The capital of France is ',
              h('span', { class: 'fill-blank-input-slot', style: { '--blank-width': '6ch' } }, [
                h('span', { class: 'fill-blank-input-sizing', 'aria-hidden': 'true' }, 'Paris'),
                h('span', { class: 'fill-blank-input fill-blank-input-preview' }, 'Paris'),
              ]),
              '.',
            ]),
          ]),
        ]),
      ]);
    }

    function resetCurrentMode() {
      const options = resolvedDisplayOptions(props.options);
      emit('update', { ...options, [keyForMode(tab.value)]: defaultCardDisplayOptions() });
    }

    return () => {
      const options = resolvedDisplayOptions(props.options);
      const current = displayForMode(options, tab.value);
      return h('dialog', {
        ref: dialog,
        class: 'display-settings index-cards-display-settings',
        'aria-labelledby': 'display-settings-title',
        onCancel: (event: Event) => { event.preventDefault(); emit('close'); },
      }, [
        h('header', { class: 'display-settings-header' }, [
          h('h2', { id: 'display-settings-title' }, 'Index Cards settings'),
          h('button', {
            type: 'button',
            class: 'quiet-button',
            autofocus: true,
            onClick: () => emit('close'),
          }, 'Done'),
        ]),
        h('p', { class: 'display-settings-description' },
          'Each study mode has its own appearance settings. Fill in the Blanks also has answer-matching behavior. Changes save automatically and are included in backups.'),
        h('div', { class: 'index-cards-display-tabs', role: 'tablist', 'aria-label': 'Study mode' },
          SET_MODES.map((mode, index) => h('button', {
            type: 'button',
            role: 'tab',
            id: `index-cards-tab-${mode.id}`,
            'aria-selected': tab.value === mode.id,
            'aria-controls': `index-cards-display-panel-${mode.id}`,
            tabindex: tab.value === mode.id ? 0 : -1,
            onClick: () => { tab.value = mode.id; },
            onKeydown: (event: KeyboardEvent) => selectTab(event, index),
          }, mode.label))),
        ...SET_MODES.map((mode) => h('section', {
          key: mode.id,
          id: `index-cards-display-panel-${mode.id}`,
          role: 'tabpanel',
          'aria-labelledby': `index-cards-tab-${mode.id}`,
          hidden: tab.value !== mode.id,
          tabindex: 0,
        }, tab.value !== mode.id ? [] : [
          h('div', { class: 'display-settings-fields' }, [
            ...DISPLAY_FIELDS.filter((field) =>
              field.key !== 'blankLength' || mode.id === 'fill-in-the-blanks').map(control),
            mode.id === 'fill-in-the-blanks' ? h(AnswerStrictnessField, {
              id: 'index-cards-answer-strictness',
              value: props.answerStrictness,
              fieldClass: 'display-setting',
              onChange: (value: AnswerStrictness) => emit('update-answer-strictness', value),
            }) : null,
          ]),
          h('p', { class: 'display-settings-description' },
            'Text size changes the letters, not the line spacing. Positive vertical offsets move text down. Card size keeps the 5:3 shape and fits the available space.'),
          mode.id === 'fill-in-the-blanks' ? h('p', { class: 'display-settings-description' },
            'Tiny starts at two character widths; Short starts at four. Both use tighter spacing. Medium matches the answer’s width. Long uses the original blank lengths. Review blanks grow as you type. Answer strictness applies to every Fill-in-the-Blanks set: 1 is exact, 2 adds spelling tolerance, 3 adds linguistic equivalents, and 4 adds conservative semantic equivalents.') : null,
          mode.id === 'fill-in-the-blanks' ? fillBlankPreview(current) : flashPreview(current),
          h('button', {
            type: 'button',
            class: 'quiet-button',
            onClick: resetCurrentMode,
          }, `Reset ${mode.label} defaults`),
        ])),
      ]);
    };
  },
});
