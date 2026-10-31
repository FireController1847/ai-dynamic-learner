import { defineComponent, h, ref, watch, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import type { TeachingBlock } from './teaching-blocks.ts';
import { renderTeachingRich as rich } from './teaching-text.ts';

type Practice = Extract<TeachingBlock, { kind: 'guided-practice' }>;
const stageNames = {
  guided: 'Try it together',
  apply: 'Use what you learned',
  revisit: 'Remember and connect',
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
          h('span', { class: 'guide-practice-note' }, 'Not a test · Go at your own pace'),
        ]),
        h('div', { class: 'guide-practice-setup' }, [
          h('strong', props.block.stage === 'revisit' ? 'Remember the idea' : 'First, the idea'),
          rich(props.block.setup),
        ]),
        h('div', { class: 'guide-practice-prompt' }, [
          h('span', { class: 'guide-lesson-small-label' }, 'A little thought experiment'),
          rich(props.block.prompt),
        ]),
        !revealed ? [
          h('label', { class: 'guide-practice-thinking' }, [
            h('span', 'What do you think? (optional)'),
            h('textarea', { rows: 2, maxlength: 1200, value: thinking.value,
              placeholder: 'A prediction, a quick sketch in words, or nothing at all…',
              onInput: (event: Event) => { thinking.value = inputValue(event); } }),
          ]),
          hinted ? h('div', { class: 'guide-practice-hint' }, [
            h('span', { class: 'guide-lesson-small-label' }, 'A clue to help'),
            rich(props.block.hint),
          ]) : null,
          h('div', { class: 'guide-practice-actions' }, [
            !hinted ? h('button', { type: 'button', class: 'quiet-button',
              onClick: () => emit('answer', 'hint') }, 'Give me a clue') : null,
            h('button', { type: 'button', class: 'card-primary-button',
              onClick: () => emit('answer', 'revealed') }, 'Show me how it works'),
          ]),
        ] : [
          h('div', { class: 'guide-practice-reveal', role: 'status' }, [
            h('span', { class: 'guide-lesson-small-label' }, 'Let’s work it through'),
            rich(props.block.reveal),
            thinking.value.trim() ? h('div', { class: 'guide-practice-reflection' }, [
              h('strong', 'Your earlier thought'),
              h('p', thinking.value),
            ]) : null,
            props.block.reflection ? h('div', { class: 'guide-practice-reflection' }, [
              h('span', { class: 'guide-lesson-small-label' }, 'One more connection'),
              rich(props.block.reflection),
            ]) : null,
          ]),
          h('button', { type: 'button', class: 'quiet-button guide-practice-retry',
            onClick: () => { thinking.value = ''; emit('answer', ''); } }, 'Try recalling it again'),
        ],
      ]);
    };
  },
});
