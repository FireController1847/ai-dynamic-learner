import { computed, defineComponent, h, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { MAX_DROPDOWN_CHOICES, MAX_DROPDOWN_ROWS } from './dropdown-model.ts';
import { MAX_TEXT, type Question } from './question-model.ts';

export const DropdownEditor = defineComponent({
  name: 'DropdownQuestionEditor',
  props: { question: { type: Object as PropType<Question>, required: true } },
  setup(props) {
    const rows = computed(() => props.question.matches ?? []);
    return () => h('div', { class: 'knowledge-dropdown-editor' }, [
      h('fieldset', { class: 'knowledge-choice-editor' }, [
        h('legend', 'Dropdown choices'),
        h('p', { class: 'knowledge-muted' }, 'Every row uses this choice list. Choices may be reused across rows.'),
        ...props.question.choices.map((choice, index) => h('div', { class: 'knowledge-choice-row', key: index }, [
          h('input', { value: choice, maxlength: MAX_TEXT, 'aria-label': `Dropdown choice ${index + 1}`,
            onInput: (event: Event) => {
              const next = inputValue(event);
              for (const row of rows.value) if (choice.trim() && row.answer.trim() === choice.trim()) row.answer = next;
              props.question.choices[index] = next;
            } }),
          h('button', { type: 'button', class: 'icon-button delete-button', disabled: props.question.choices.length <= 2,
            'aria-label': `Remove dropdown choice ${index + 1}`, onClick: () => {
              for (const row of rows.value) if (row.answer.trim() === choice.trim()) row.answer = '';
              props.question.choices.splice(index, 1);
            } }, [h(Icon, { name: 'trash' })]),
        ])),
        h('button', { type: 'button', class: 'quiet-button', disabled: props.question.choices.length >= MAX_DROPDOWN_CHOICES,
          onClick: () => props.question.choices.push('') }, 'Add choice'),
      ]),
      h('fieldset', { class: 'knowledge-dropdown-rows' }, [
        h('legend', 'Matching rows'),
        ...rows.value.map((row, index) => h('div', { class: 'knowledge-dropdown-editor-row', key: index }, [
          h('label', { class: 'knowledge-field' }, [`Row ${index + 1} label`, h('input', {
            value: row.label, maxlength: MAX_TEXT, onInput: (event: Event) => { row.label = inputValue(event); },
          })]),
          h('label', { class: 'knowledge-field' }, ['Correct answer', h('select', {
            value: row.answer, 'aria-label': `Correct answer for ${row.label || `row ${index + 1}`}`,
            onChange: (event: Event) => { row.answer = inputValue(event); },
          }, [h('option', { value: '', disabled: true }, 'Select the correct answer'),
            ...props.question.choices.filter(choice => choice.trim()).map(choice => h('option', { value: choice }, choice))])]),
          h('button', { type: 'button', class: 'icon-button delete-button', disabled: rows.value.length <= 1,
            'aria-label': `Remove matching row ${index + 1}`, onClick: () => rows.value.splice(index, 1) }, [h(Icon, { name: 'trash' })]),
        ])),
        h('button', { type: 'button', class: 'quiet-button', disabled: rows.value.length >= MAX_DROPDOWN_ROWS,
          onClick: () => { (props.question.matches ??= []).push({ label: '', answer: '' }); } }, 'Add matching row'),
      ]),
    ]);
  },
});
