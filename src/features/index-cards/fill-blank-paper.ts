import type { Card } from './card-model.ts';
import { inputValue } from '../../core/dom.ts';
import { isFillBlankAnswerCorrect, parseFillBlankTemplate } from './fill-blank-model.ts';

import { defineComponent, type PropType, h } from 'vue';

export const FillBlankPaper = defineComponent({
  name: 'FillBlankPaper',
  props: {
    card: { type: Object as PropType<Card>, required: true },
    position: { type: Number, required: true },
    responses: { type: Array as PropType<string[]>, required: true },
    verified: Boolean,
    side: { type: String as PropType<'front' | 'back'>, default: 'front' },
  },
  emits: { 'update-response': (_index: number, _value: string) => true },
  setup(props, { emit }) {
    function title() {
      return props.card.title?.trim() || 'Untitled card';
    }

    function blankNumber(index: number) {
      return h('sub', { class: 'fill-blank-number', 'aria-hidden': 'true' }, String(index + 1));
    }

    return () => {
      const template = parseFillBlankTemplate(props.card.front);

      const prompt = h('div', {
        class: 'card-face card-face--front fill-blank-face fill-blank-review-card',
        inert: props.side === 'back',
        'aria-hidden': props.side === 'back',
      }, [
        h('div', { class: 'card-face-heading' }, [
          h('span', { class: 'fill-blank-review-title' }, title()),
          h('span', { class: 'card-face-side' }, 'Prompt'),
          h('span', { class: 'card-face-number', 'aria-hidden': 'true' }, String(props.position).padStart(2, '0')),
        ]),
        h('div', {
          class: 'fill-blank-writing',
          'aria-label': `Fill in the blanks for card ${props.position}`,
        }, template.segments.map((segment) => {
          if (segment.type === 'text') return h('span', { class: 'fill-blank-text' }, segment.text);

          const response = props.responses[segment.index] ?? '';
          const width = Math.max(6, Math.min(28, response.length + 1));
          return h('span', { key: `blank-${segment.index}`, class: 'fill-blank-review-blank' }, [
            blankNumber(segment.index),
            h('input', {
              class: 'fill-blank-input',
              type: 'text',
              value: response,
              readonly: props.verified,
              autocomplete: 'off',
              spellcheck: false,
              style: { width: `${width}ch` },
              'aria-label': `Blank ${segment.index + 1}`,
              onInput: (event: Event) => {
                if (!props.verified) emit('update-response', segment.index, inputValue(event));
              },
            }),
          ]);
        })),
      ]);

      const results = h('div', {
        class: 'card-face card-face--back fill-blank-face fill-blank-review-card fill-blank-results-card',
        inert: props.side !== 'back',
        'aria-hidden': props.side !== 'back',
      }, [
        h('div', { class: 'card-face-heading fill-blank-back-heading' }, [
          h('span', { class: 'card-face-number', 'aria-hidden': 'true' }, String(props.position).padStart(2, '0')),
        ]),
        h('div', {
          class: 'fill-blank-writing fill-blank-results',
          'aria-label': `Verified answers for card ${props.position}`,
        }, template.segments.map((segment) => {
          if (segment.type === 'text') return h('span', { class: 'fill-blank-text' }, segment.text);

          const response = props.responses[segment.index] ?? '';
          const correct = isFillBlankAnswerCorrect(segment.answer, response);
          return h('span', {
            key: `result-${segment.index}`,
            class: ['fill-blank-review-blank', 'fill-blank-result', { 'is-correct': correct, 'is-incorrect': !correct }],
          }, [
            blankNumber(segment.index),
            h('span', { class: 'fill-blank-result-copy' }, [
              h('span', { class: 'fill-blank-correct-answer' }, segment.answer),
              !correct ? h('span', { class: 'fill-blank-wrong-answer' }, response) : null,
            ]),
          ]);
        })),
      ]);

      return h('div', {
        class: ['card-flipper', 'fill-blank-review-flipper', { 'is-back': props.side === 'back' }],
      }, [prompt, results]);
    };
  },
});
