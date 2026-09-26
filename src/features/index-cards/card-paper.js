import { MAX_CARD_TEXT_LENGTH, MAX_CARD_TITLE_LENGTH } from './card-model.js';

const { h } = window.Vue;

// Keep both surfaces mounted so flipping rotates the paper, not mirrored text.
export const CardPaper = {
  name: 'CardPaper',
  props: {
    card: { type: Object, required: true },
    side: { type: String, required: true },
    position: { type: Number, required: true },
  },
  setup(props, { expose }) {
    const editors = {};
    expose({ focus: () => editors[props.side]?.focus() });

    function face(side) {
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
            placeholder: side === 'front' ? 'Untitled card' : '',
            'aria-label': `${label} title`,
            onInput: (event) => { props.card[titleKey] = event.target.value; },
          }),
          h('span', { class: 'card-face-side' }, label),
          h('span', { class: 'card-face-number', 'aria-hidden': 'true' }, String(props.position).padStart(2, '0')),
        ]),
        h('textarea', {
          ref: (element) => { editors[side] = element; },
          class: 'card-writing', value: props.card[side],
          maxlength: MAX_CARD_TEXT_LENGTH, spellcheck: true,
          'aria-label': `${label} of card ${props.position}`,
          placeholder: side === 'front' ? 'Write a question, word, or idea…' : 'Write the answer or the other side…',
          onInput: (event) => { props.card[side] = event.target.value; },
        }),
      ]);
    }

    return () => h('div', {
      class: ['card-flipper', { 'is-back': props.side === 'back' }],
    }, [face('front'), face('back')]);
  },
};
