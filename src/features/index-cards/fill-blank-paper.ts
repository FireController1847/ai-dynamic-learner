import type { Card } from './card-model.ts';
import { inputValue } from '../../core/dom.ts';
import { isFillBlankAnswerCorrect, parseFillBlankTemplate } from './fill-blank-model.ts';

import { defineComponent, type PropType, h } from 'vue';

export interface FillBlankPaperHandle {
  focusBlank(index: number): void;
}

export const FillBlankPaper = defineComponent({
  name: 'FillBlankPaper',
  props: {
    card: { type: Object as PropType<Card>, required: true },
    position: { type: Number, required: true },
    responses: { type: Array as PropType<string[]>, required: true },
    verified: Boolean,
    side: { type: String as PropType<'front' | 'back'>, default: 'front' },
    resultReviewIndex: { type: Number as PropType<number | null>, default: null },
  },
  emits: {
    'update-response': (_index: number, _value: string) => true,
    'blank-focus': (_index: number) => true,
    'blank-enter': (_index: number, _direction: 1 | -1) => true,
  },
  setup(props, { emit, expose }) {
    const inputs: Array<HTMLInputElement | null> = [];

    expose({
      focusBlank(index: number) {
        inputs[index]?.focus();
      },
    } satisfies FillBlankPaperHandle);

    function title() {
      return props.card.title?.trim() || '';
    }

    function blankNumber(index: number) {
      return h('sub', { class: 'fill-blank-number', 'aria-hidden': 'true' }, String(index + 1));
    }

    function answerKey(answers: string[], label: string) {
      return answers.length
        ? h('ol', { class: 'fill-blank-answer-key fill-blank-review-answer-key', 'aria-label': label },
          answers.map((answer, index) => h('li', { key: `${index}-${answer}` }, [
            h('span', { class: 'fill-blank-answer-key-number', 'aria-hidden': 'true' }, `${index + 1}.`),
            h('span', answer),
          ])))
        : h('p', { class: 'fill-blank-answer-key-empty' }, 'No blanks on this card.');
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
            h('span', { class: 'fill-blank-input-slot', style: { '--blank-width': `${width}ch` } }, [
              h('span', { class: 'fill-blank-input-sizing', 'aria-hidden': 'true' }, segment.answer),
              h('span', { class: 'fill-blank-input-sizing fill-blank-input-growth', 'aria-hidden': 'true' },
                response ? `${response}\u00a0` : ''),
              h('input', {
                ref: (element) => { inputs[segment.index] = element instanceof HTMLInputElement ? element : null; },
                class: 'fill-blank-input',
                type: 'text',
                value: response,
                readonly: props.verified,
                autocomplete: 'off',
                spellcheck: false,
                'aria-label': `Blank ${segment.index + 1} of ${template.answers.length}`,
                onFocus: () => emit('blank-focus', segment.index),
                onInput: (event: Event) => {
                  if (!props.verified) emit('update-response', segment.index, inputValue(event));
                },
                onKeydown: (event: KeyboardEvent) => {
                  if (props.verified || event.key !== 'Enter') return;
                  event.preventDefault();
                  emit('blank-enter', segment.index, event.shiftKey ? -1 : 1);
                },
              }),
            ]),
          ]);
        })),
      ]);

      const backBody = props.verified
        ? h('div', {
          class: 'fill-blank-writing fill-blank-results',
          'aria-label': `Verified answers for card ${props.position}`,
        }, template.segments.map((segment) => {
          if (segment.type === 'text') return h('span', { class: 'fill-blank-text' }, segment.text);

          const response = props.responses[segment.index] ?? '';
          const correct = isFillBlankAnswerCorrect(segment.answer, response);
          const reviewing = props.resultReviewIndex === segment.index;
          return h('span', {
            key: `result-${segment.index}`,
            class: ['fill-blank-review-blank', 'fill-blank-result', {
              'is-correct': correct,
              'is-incorrect': !correct,
              'is-reviewing-result': reviewing,
            }],
          }, [
            blankNumber(segment.index),
            h('span', { class: 'fill-blank-result-copy' }, [
              h('span', { class: 'fill-blank-correct-answer' }, segment.answer),
              !correct ? h('span', { class: 'fill-blank-wrong-answer' }, response) : null,
              reviewing && correct ? h('span', { class: 'fill-blank-correct-effect', 'aria-hidden': 'true' },
                Array.from({ length: 8 }, (_, spark) => h('span', {
                  class: `fill-blank-correct-spark fill-blank-correct-spark-${spark + 1}`,
                }, '✦'))) : null,
            ]),
          ]);
        }))
        : answerKey(template.answers, `Answer key for card ${props.position}`);

      const back = h('div', {
        class: 'card-face card-face--back fill-blank-face fill-blank-review-card fill-blank-results-card',
        inert: props.side !== 'back',
        'aria-hidden': props.side !== 'back',
      }, [
        h('div', { class: 'card-face-heading fill-blank-back-heading' }, [
          h('span', { class: 'card-face-number', 'aria-hidden': 'true' }, String(props.position).padStart(2, '0')),
        ]),
        backBody,
      ]);

      return h('div', {
        class: ['card-flipper', 'fill-blank-review-flipper', { 'is-back': props.side === 'back' }],
      }, [prompt, back]);
    };
  },
});
