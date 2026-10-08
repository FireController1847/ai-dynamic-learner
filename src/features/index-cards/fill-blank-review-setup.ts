import type { ReviewOrder } from './review-setup.ts';
import { useDialog } from '../../components/use-dialog.ts';

import { defineComponent, type PropType, h, ref } from 'vue';

export type FillBlankSessionMode = 'review' | 'view';

export const FillBlankReviewSetup = defineComponent({
  name: 'FillBlankReviewSetup',
  props: {
    initialMode: { type: String as PropType<FillBlankSessionMode>, default: 'review' },
    initialOrder: { type: String as PropType<ReviewOrder>, required: true },
    cardCount: { type: Number, required: true },
    modal: { type: Boolean, default: true },
  },
  emits: {
    'cancel': () => true,
    'start': (_mode: FillBlankSessionMode, _order: ReviewOrder) => true,
  },
  setup(props, { emit }) {
    const { dialog } = useDialog({ modal: () => props.modal });
    const mode = ref<FillBlankSessionMode>(props.initialMode);
    const order = ref(props.initialOrder);

    function modeChoice(value: FillBlankSessionMode, label: string, description: string) {
      return h('label', { class: 'review-choice', key: value }, [
        h('input', {
          type: 'radio',
          name: 'fill-blank-session-mode',
          value,
          checked: mode.value === value,
          autofocus: mode.value === value,
          onChange: () => { mode.value = value; },
        }),
        h('span', [
          h('strong', label),
          h('span', { class: 'review-choice-description' }, description),
        ]),
      ]);
    }

    function orderChoice(value: ReviewOrder, label: string, description: string) {
      return h('label', { class: 'review-choice', key: value }, [
        h('input', {
          type: 'radio',
          name: 'fill-blank-review-order',
          value,
          checked: order.value === value,
          onChange: () => { order.value = value; },
        }),
        h('span', [
          h('strong', label),
          h('span', { class: 'review-choice-description' }, description),
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
          emit('start', mode.value, order.value);
        },
      }, [
        h('p', { class: 'review-setup-step' }, `Set up session · ${props.cardCount} ${props.cardCount === 1 ? 'card' : 'cards'}`),
        h('h2', { id: 'fill-blank-review-setup-heading' }, 'How do you want to use these cards?'),
        h('p', { class: 'review-setup-description' }, mode.value === 'review'
          ? 'Review hides the answers so you can fill the blanks, verify them, and score the session.'
          : 'View shows the completed answers immediately so you can read through the cards without scoring.'),
        h('fieldset', { class: 'review-choices fill-blank-session-mode-choices' }, [
          h('legend', { class: 'visually-hidden' }, 'Session mode'),
          modeChoice('review', 'Review', 'Recall the missing words, then check and score your answers.'),
          modeChoice('view', 'View', 'Show the answers from the start and browse without scoring.'),
        ]),
        h('h3', { class: 'review-setup-section-heading' }, 'Card order'),
        h('fieldset', { class: 'review-choices fill-blank-review-order-choices' }, [
          h('legend', { class: 'visually-hidden' }, 'Card order'),
          orderChoice('forward', 'First to last', 'Start with your first card.'),
          orderChoice('backward', 'Last to first', 'Start with your last card.'),
          orderChoice('shuffle', 'Mix them up', 'Use a new random order.'),
        ]),
        h('div', { class: 'review-setup-actions' }, [
          h('button', {
            type: 'button',
            class: 'quiet-button review-cancel-button',
            onClick: () => emit('cancel'),
          }, 'Cancel'),
          h('button', { type: 'submit', class: 'card-primary-button' },
            mode.value === 'review' ? 'Start review' : 'Start view'),
        ]),
      ]),
    ]);
  },
});
