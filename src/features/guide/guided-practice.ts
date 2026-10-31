import { defineComponent, h, ref, watch, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import type { TeachingBlock } from './teaching-blocks.ts';
import { renderTeachingRich as rich } from './teaching-text.ts';

type Practice = Extract<TeachingBlock, { kind: 'guided-practice' }>;
const stageNames = {
  guided: 'Explore',
  apply: 'Apply',
  revisit: 'Connect',
} as const;

/** Source-backed teaching comes before prediction. No answer checking or score. */
export const GuideGuidedPractice = defineComponent({
  name: 'GuideGuidedPractice',
  props: {
    block: { type: Object as PropType<Practice>, required: true },
    response: { type: String, default: '' },
  },
  emits: { answer: (_value: string) => true },
  setup(props, { emit }) {
    const thinking = ref('');
    watch(() => props.block.id, () => { thinking.value = ''; });
    return () => {
      const revealed = props.response === 'revealed';
      const hinted = props.response === 'hint' || revealed;
      return h('section', { class: 'guide-practice', 'aria-label': stageNames[props.block.stage] }, [
        h('div', { class: 'guide-practice-stage' }, [
          h('span', { class: 'guide-lesson-small-label' }, stageNames[props.block.stage]),
        ]),
        h('div', { class: 'guide-practice-setup' }, [
          h('strong', props.block.stage === 'revisit' ? 'Recall the idea' : 'The idea'),
          rich(props.block.setup),
        ]),
        h('div', { class: 'guide-practice-prompt' }, [
          h('span', { class: 'guide-lesson-small-label' }, 'Consider'),
          rich(props.block.prompt),
        ]),
        !revealed ? [
          h('label', { class: 'guide-practice-thinking' }, [
            h('span', 'Your thoughts (optional)'),
            h('textarea', { rows: 2, maxlength: 1200, value: thinking.value,
              placeholder: 'Write a thought, or leave this blank…',
              onInput: (event: Event) => { thinking.value = inputValue(event); } }),
          ]),
          hinted ? h('div', { class: 'guide-practice-hint' }, [
            h('span', { class: 'guide-lesson-small-label' }, 'Hint'),
            rich(props.block.hint),
          ]) : null,
          h('div', { class: 'guide-practice-actions' }, [
            !hinted ? h('button', { type: 'button', class: 'quiet-button',
              onClick: () => emit('answer', 'hint') }, 'Show hint') : null,
            h('button', { type: 'button', class: 'card-primary-button',
              onClick: () => emit('answer', 'revealed') }, 'Reveal explanation'),
          ]),
        ] : [
          h('div', { class: 'guide-practice-reveal', role: 'status' }, [
            h('span', { class: 'guide-lesson-small-label' }, 'Explanation'),
            rich(props.block.reveal),
            thinking.value.trim() ? h('div', { class: 'guide-practice-reflection' }, [
              h('strong', 'Your earlier thought'),
              h('p', thinking.value),
            ]) : null,
            props.block.reflection ? h('div', { class: 'guide-practice-reflection' }, [
              h('span', { class: 'guide-lesson-small-label' }, 'Connection'),
              rich(props.block.reflection),
            ]) : null,
          ]),
          h('button', { type: 'button', class: 'quiet-button guide-practice-retry',
            onClick: () => { thinking.value = ''; emit('answer', ''); } }, 'Think again'),
        ],
      ]);
    };
  },
});
