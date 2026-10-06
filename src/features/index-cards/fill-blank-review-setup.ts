import type { ReviewOrder } from './review-setup.ts';
import {
  DEFAULT_ANSWER_STRICTNESS,
  type AnswerStrictness,
} from './fill-blank-model.ts';
import { useDialog } from '../../components/use-dialog.ts';

import { defineComponent, type PropType, h, ref } from 'vue';

const STRICTNESS_CHOICES: readonly {
  value: AnswerStrictness;
  label: string;
  description: string;
}[] = [
  { value: 1, label: '1 — Strict', description: 'Normalized exact answers only.' },
  { value: 2, label: '2 — Flexible', description: 'Also allow minor spelling differences.' },
  { value: 3, label: '3 — Linguistic', description: 'Also allow grammatical and morphological equivalents.' },
  { value: 4, label: '4 — Semantic', description: 'Also allow conservative high-confidence synonyms and equivalent wording.' },
];

export const FillBlankReviewSetup = defineComponent({
  name: 'FillBlankReviewSetup',
  props: {
    initialOrder: { type: String as PropType<ReviewOrder>, required: true },
    initialStrictness: {
      type: Number as PropType<AnswerStrictness>,
      default: DEFAULT_ANSWER_STRICTNESS,
    },
    cardCount: { type: Number, required: true },
    modal: { type: Boolean, default: true },
  },
  emits: {
    'cancel': () => true,
    'start': (_order: ReviewOrder, _strictness: AnswerStrictness) => true,
  },
  setup(props, { emit }) {
    const { dialog } = useDialog({ modal: () => props.modal });
    const order = ref(props.initialOrder);
    const strictness = ref<AnswerStrictness>(props.initialStrictness);

    function orderChoice(value: ReviewOrder, label: string, description: string) {
      return h('label', { class: 'review-choice', key: value }, [
        h('input', {
          type: 'radio',
          name: 'fill-blank-review-order',
          value,
          checked: order.value === value,
          autofocus: order.value === value,
          onChange: () => { order.value = value; },
        }),
        h('span', [
          h('strong', label),
          h('span', { class: 'review-choice-description' }, description),
        ]),
      ]);
    }

    function strictnessChoice(choice: typeof STRICTNESS_CHOICES[number]) {
      return h('label', { class: 'review-choice', key: choice.value }, [
        h('input', {
          type: 'radio',
          name: 'fill-blank-answer-strictness',
          value: choice.value,
          checked: strictness.value === choice.value,
          onChange: () => { strictness.value = choice.value; },
        }),
        h('span', [
          h('strong', choice.label),
          h('span', { class: 'review-choice-description' }, choice.description),
        ]),
      ]);
    }

    return () => h('dialog', {
      ref: dialog,
      class: 'review-setup',
      'aria-labelledby': 'fill-blank-review-setup-heading',
      'data-tips-tutorial': !props.modal ? '' : undefined,
      inert: !props.modal,
      onCancel: (event: Event) => { event.preventDefault(); emit('cancel'); },
    }, [
      h('form', {
        onSubmit: (event: Event) => {
          event.preventDefault();
          emit('start', order.value, strictness.value);
        },
      }, [
        h('p', { class: 'review-setup-step' }, `Set up review · ${props.cardCount} ${props.cardCount === 1 ? 'card' : 'cards'}`),
        h('h2', { id: 'fill-blank-review-setup-heading' }, 'What order should the cards use?'),
        h('p', { class: 'review-setup-description' },
          'Fill the blanks, flip to the answer key if you get stuck, then verify all of your answers at once.'),
        h('fieldset', { class: 'review-choices' }, [
          h('legend', { class: 'visually-hidden' }, 'Review order'),
          orderChoice('forward', 'First to last', 'Start with your first card.'),
          orderChoice('backward', 'Last to first', 'Start with your last card.'),
          orderChoice('shuffle', 'Mix them up', 'Use a new random order.'),
        ]),
        h('p', { class: 'review-setup-step' }, 'Answer strictness'),
        h('fieldset', { class: 'review-choices' }, [
          h('legend', { class: 'visually-hidden' }, 'Answer strictness'),
          ...STRICTNESS_CHOICES.map(strictnessChoice),
        ]),
        h('div', { class: 'review-setup-actions' }, [
          h('button', {
            type: 'button',
            class: 'quiet-button review-cancel-button',
            onClick: () => emit('cancel'),
          }, 'Cancel'),
          h('button', { type: 'submit', class: 'card-primary-button' }, 'Start review'),
        ]),
      ]),
    ]);
  },
});
