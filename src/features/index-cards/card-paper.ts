import type { Card, CardSide } from './card-model.ts';
import { inputValue } from '../../core/dom.ts';
import { MAX_CARD_TEXT_LENGTH, MAX_CARD_TITLE_LENGTH } from './card-model.ts';

import { defineComponent, type PropType, h } from 'vue';

// Keep both surfaces mounted so flipping rotates the paper, not mirrored text.
export const CardPaper = defineComponent({
  name: 'CardPaper',
  props: {
    card: { type: Object as PropType<Card>, required: true },
    side: { type: String as PropType<CardSide>, required: true },
    position: { type: Number, required: true },
    reviewing: Boolean,
  },
  setup(props, { expose }) {
    const editors: Partial<Record<CardSide, HTMLTextAreaElement>> = {};
    expose({ focus: () => editors[props.side]?.focus() });

    function face(side: CardSide) {
      const active = props.side === side;
      const titleKey = side === 'front' ? 'title' : 'backTitle';
      const label = side === 'front' ? 'Front' : 'Back';
      return h('div', {
        class: ['card-face', `card-face--${side}`], key: side,
        inert: !active, 'aria-hidden': !active,
      }, [
        h('div', { class: 'card-face-heading' }, [
          h('input', {
            class: 'card-title-input', type: 'text', value: props.card[titleKey] ?? '',
            maxlength: MAX_CARD_TITLE_LENGTH,
            placeholder: side === 'front' && !props.reviewing ? 'Untitled card' : '',
            'aria-label': `${label} title`,
            onInput: (event: Event) => { props.card[titleKey] = inputValue(event); },
          }),
          h('span', { class: 'card-face-side' }, label),
          h('span', { class: 'card-face-number', 'aria-hidden': 'true' }, String(props.position).padStart(2, '0')),
        ]),
        h('textarea', {
          ref: (element) => { if (element instanceof HTMLTextAreaElement) editors[side] = element; else delete editors[side]; },
          class: 'card-writing', value: props.card[side],
          maxlength: MAX_CARD_TEXT_LENGTH, spellcheck: true,
          'aria-label': `${label} of card ${props.position}`,
          placeholder: side === 'front' ? 'Write a question, word, or idea…' : 'Write the answer or the other side…',
          onInput: (event: Event) => { props.card[side] = inputValue(event); },
        }),
      ]);
    }

    return () => h('div', {
      class: ['card-flipper', { 'is-back': props.side === 'back' }],
    }, [face('front'), face('back')]);
  },
});
