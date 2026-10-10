import type { ReviewOrder } from './review-setup.ts';
import { useDialog } from '../../components/use-dialog.ts';

import { defineComponent, type PropType, h, ref } from 'vue';

export type FillBlankSessionMode = 'review' | 'view';

export const FillBlankReviewSetup = defineComponent({
  name: 'FillBlankReviewSetup',
  props: {
    mode: { type: String as PropType<FillBlankSessionMode>, required: true },
    initialOrder: { type: String as PropType<ReviewOrder>, required: true },
    cardCount: { type: Number, required: true },
    modal: { type: Boolean, default: true },
  },
  emits: {
    'cancel': () => true,
    'start': (_order: ReviewOrder) => true,
  },
  setup(props, { emit }) {
    const { dialog } = useDialog({ modal: () => props.modal });
    const order = ref(props.initialOrder);

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

    return () => {
      const viewing = props.mode === 'view';
      return h('dialog', {
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
            emit('start', order.value);
          },
        }, [
          h('p', { class: 'review-setup-step' },
            `Set up ${viewing ? 'view' : 'review'} · ${props.cardCount} ${props.cardCount === 1 ? 'card' : 'cards'}`),
          h('h2', { id: 'fill-blank-review-setup-heading' }, 'What order should the cards use?'),
          h('p', { class: 'review-setup-description' }, viewing
            ? 'View shows the completed answers immediately so you can read through the cards without scoring.'
            : 'Review hides the answers so you can fill the blanks, verify them, and score the session.'),
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
              viewing ? 'Start view' : 'Start review'),
          ]),
        ]),
      ]);
    };
  },
});
