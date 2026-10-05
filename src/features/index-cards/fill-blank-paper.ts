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
  },
  emits: { 'update-response': (_index: number, _value: string) => true },
  setup(props, { emit }) {
    function title() {
      return props.card.title?.trim() || 'Untitled card';
    }

    function promptFace() {
      const template = parseFillBlankTemplate(props.card.front);
      return h('div', {
        class: 'card-face card-face--front fill-blank-face',
        inert: props.verified,
        'aria-hidden': props.verified,
      }, [
        h('div', { class: 'card-face-heading' }, [
          h('span', { class: 'fill-blank-review-title' }, title()),
          h('span', { class: 'card-face-side' }, 'Fill in'),
          h('span', { class: 'card-face-number', 'aria-hidden': 'true' }, String(props.position).padStart(2, '0')),
        ]),
        h('div', { class: 'fill-blank-writing', 'aria-label': `Fill in the blanks for card ${props.position}` },
          template.segments.map((segment) => {
            if (segment.type === 'text') return h('span', { class: 'fill-blank-text' }, segment.text);
            const response = props.responses[segment.index] ?? '';
            const width = Math.max(6, Math.min(28, response.length + 1));
            return h('input', {
              key: `blank-${segment.index}`,
              class: 'fill-blank-input',
              type: 'text',
              value: response,
              autocomplete: 'off',
              spellcheck: false,
              style: { width: `${width}ch` },
              'aria-label': `Blank ${segment.index + 1}`,
              onInput: (event: Event) => emit('update-response', segment.index, inputValue(event)),
            });
          })),
      ]);
    }

    function answerFace() {
      const template = parseFillBlankTemplate(props.card.front);
      return h('div', {
        class: 'card-face card-face--back fill-blank-face fill-blank-answer-face',
        inert: !props.verified,
        'aria-hidden': !props.verified,
      }, [
        h('div', { class: 'card-face-heading' }, [
          h('span', { class: 'fill-blank-review-title' }, title()),
          h('span', { class: 'card-face-side' }, 'Verified'),
          h('span', { class: 'card-face-number', 'aria-hidden': 'true' }, String(props.position).padStart(2, '0')),
        ]),
        h('div', { class: 'fill-blank-writing fill-blank-results', 'aria-label': `Verified answers for card ${props.position}` },
          template.segments.map((segment) => {
            if (segment.type === 'text') return h('span', { class: 'fill-blank-text' }, segment.text);
            const response = props.responses[segment.index] ?? '';
            const correct = isFillBlankAnswerCorrect(segment.answer, response);
            return h('span', {
              key: `result-${segment.index}`,
              class: ['fill-blank-result', { 'is-correct': correct, 'is-incorrect': !correct }],
            }, [
              h('span', { class: 'fill-blank-correct-answer' }, segment.answer),
              !correct ? h('span', { class: 'fill-blank-wrong-answer' }, response) : null,
            ]);
          })),
        props.card.back.trim() ? h('div', { class: 'fill-blank-explanation' }, [
          h('strong', 'Notes'),
          h('p', props.card.back),
        ]) : null,
      ]);
    }

    return () => h('div', {
      class: ['card-flipper', 'fill-blank-flipper', { 'is-back': props.verified }],
    }, [promptFace(), answerFace()]);
  },
});
