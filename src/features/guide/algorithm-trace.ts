import { defineComponent, h, ref, watch, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import { renderTeachingRich as rich } from './teaching-text.ts';

/**
 * Any Review-compatible solver may return trace[] describing each algorithm
 * state transition. This view never executes solver code and never grades
 * free-form predictions; the authoritative transition comes from the sandbox.
 */
export const GuideAlgorithmTrace = defineComponent({
  name: 'GuideAlgorithmTrace',
  props: {
    trace: { type: Array as PropType<string[]>, required: true },
    step: { type: Number, required: true },
    revealed: { type: Boolean, required: true },
  },
  emits: { change: (_step: number, _revealed: boolean) => true },
  setup(props, { emit }) {
    const prediction = ref('');
    watch(() => props.step, () => { prediction.value = ''; });
    return () => {
      const count = props.trace.length;
      if (!count) return null;
      const step = Math.min(Math.max(0, props.step), count - 1);
      const visible = props.revealed;
      return h('section', { class: 'guide-algorithm-lab', 'aria-label': 'Practice executing the algorithm' }, [
        h('header', { class: 'guide-algorithm-heading' }, [
          h('div', [
            h('span', { class: 'guide-lesson-small-label' }, 'Algorithm lab · Predict, then reveal'),
            h('h5', 'What happens next?'),
          ]),
          h('span', { class: 'guide-algorithm-counter', 'aria-live': 'polite' }, 'Step ' + (step + 1) + ' of ' + count),
        ]),
        h('div', { class: 'guide-algorithm-progress', role: 'progressbar', 'aria-valuemin': 0,
          'aria-valuemax': count, 'aria-valuenow': step + (visible ? 1 : 0),
          'aria-label': 'Algorithm steps revealed' }, [
          h('div', { style: { width: ((step + (visible ? 1 : 0)) / count * 100) + '%' } }),
        ]),
        !visible ? h('div', { class: 'guide-algorithm-predict' }, [
          h('p', 'Run the next step mentally. What changes in the queue, frames, variables, or state?'),
          h('label', { class: 'guide-algorithm-prediction' }, [
            h('span', 'Your prediction (optional)'),
            h('textarea', {
              value: prediction.value, maxlength: 1200, rows: 2,
              placeholder: 'Describe the next action or resulting state…',
              onInput: (event: Event) => { prediction.value = inputValue(event); },
            }),
          ]),
          h('button', { type: 'button', class: 'card-primary-button',
            onClick: () => emit('change', step, true) }, 'Reveal next step'),
        ]) : h('div', { class: 'guide-algorithm-revealed', role: 'status' }, [
          h('span', { class: 'guide-lesson-small-label' }, 'What the algorithm did'),
          rich(props.trace[step] ?? ''),
          prediction.value.trim() ? h('div', { class: 'guide-algorithm-reflection' }, [
            h('strong', 'Your prediction'),
            h('p', prediction.value),
            h('span', 'Compare the state changes and notice what you anticipated or missed.'),
          ]) : null,
        ]),
        h('nav', { class: 'guide-algorithm-actions', 'aria-label': 'Algorithm step navigation' }, [
          h('button', { type: 'button', class: 'quiet-button', disabled: step === 0,
            onClick: () => emit('change', step - 1, true) }, 'Previous step'),
          visible && step + 1 < count ? h('button', { type: 'button', class: 'card-primary-button',
            onClick: () => emit('change', step + 1, false) }, 'Try next step') : null,
          visible && step + 1 === count ? h('button', { type: 'button', class: 'quiet-button',
            onClick: () => { prediction.value = ''; emit('change', 0, false); } }, 'Practice again') : null,
        ]),
        h('p', { class: 'guide-lesson-prompt' },
          'This is an ungraded learning challenge. Each revealed state is computed from the actual generated inputs.'),
      ]);
    };
  },
});
