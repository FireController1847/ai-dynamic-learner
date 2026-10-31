import { defineComponent, h, onBeforeUnmount, ref, watch, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import { generateVariantAsync, type GeneratedVariant } from '../../core/parameterized/generator.ts';
import type { TeachingBlock } from './teaching-blocks.ts';
import { controlledTeachingTemplate, readTeachingState, teachingAnswerLines, writeTeachingState,
  type TeachingVariantState } from './parameterized-teaching.ts';
import { renderTeachingRich as rich } from './teaching-text.ts';

type ParameterizedBlock = Extract<TeachingBlock, { kind: 'parameterized' }>;

export const ParameterizedTeachingView = defineComponent({
  name: 'ParameterizedTeachingView',
  props: {
    block: { type: Object as PropType<ParameterizedBlock>, required: true },
    response: { type: String, default: '' },
  },
  emits: { updateResponse: (_value: string) => true },
  setup(props, { emit }) {
    const variant = ref<GeneratedVariant | null>(null);
    const problem = ref('');
    const loading = ref(false);
    let controller = new AbortController();
    onBeforeUnmount(() => controller.abort());

    const state = () => readTeachingState(props.response);
    function persist(next: TeachingVariantState) {
      try { emit('updateResponse', writeTeachingState(next)); }
      catch (error) { problem.value = error instanceof Error ? error.message : String(error); }
    }
    function newExample() {
      const current = state();
      persist({ n: (current.n + 1) % 1000001, revealed: false, overrides: {} });
    }
    function changeVariable(name: string, value: number) {
      if (!Number.isFinite(value)) return;
      const current = state();
      persist({ ...current, revealed: false, overrides: { ...current.overrides, [name]: value } });
    }
    watch(() => [props.response, JSON.stringify(props.block)], async () => {
      controller.abort(); controller = new AbortController(); const request = controller;
      variant.value = null; problem.value = ''; loading.value = true;
      try {
        const current = state();
        const template = controlledTeachingTemplate(props.block, current.overrides);
        const generated = await generateVariantAsync(template, props.block.id + ':' + current.n, request.signal);
        if (!request.signal.aborted) variant.value = generated;
      } catch (error) {
        if (!request.signal.aborted) problem.value = error instanceof Error ? error.message : String(error);
      } finally {
        if (controller === request) loading.value = false;
      }
    }, { immediate: true });

    return () => {
      const generated = variant.value;
      const saved = state();
      const adjustable = props.block.rules.variables.filter(variable =>
        variable.kind === 'integer' || variable.kind === 'decimal').slice(0, 8);
      return h('div', { class: 'guide-parameterized' }, [
        generated ? [
          rich(generated.texts.prompt ?? props.block.prompt),
          adjustable.length ? h('fieldset', { class: 'guide-parameterized-controls' }, [
            h('legend', 'Explore the variables'),
            ...adjustable.map(variable => {
              if (variable.kind !== 'integer' && variable.kind !== 'decimal') return null;
              const number = Number(generated.values[variable.name]);
              const step = variable.kind === 'integer' ? 1 : 10 ** -(variable.precision ?? 2);
              const useSlider = variable.max - variable.min <= 1000 && variable.max > variable.min;
              return h('label', { key: variable.name, class: 'guide-parameterized-variable' }, [
                h('span', [h('strong', variable.name), h('output', String(number))]),
                h('input', {
                  type: useSlider ? 'range' : 'number',
                  min: variable.min, max: variable.max, step,
                  value: number, 'aria-label': 'Adjust ' + variable.name,
                  onChange: (event: Event) => changeVariable(variable.name, Number(inputValue(event))),
                }),
              ]);
            }),
            h('p', { class: 'guide-teach-hint' },
              'Adjust a value to see a new calculation. Constraints and generated answers remain checked.'),
          ]) : null,
          h('div', { class: 'guide-parameterized-actions' }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: newExample }, 'Generate new example'),
            h('button', { type: 'button', class: 'card-primary-button',
              onClick: () => persist({ ...saved, revealed: !saved.revealed }) },
              saved.revealed ? 'Hide walkthrough' : 'Reveal walkthrough'),
          ]),
          saved.revealed ? h('section', { class: 'guide-parameterized-solution', 'aria-label': 'Worked solution' }, [
            h('h5', 'Step-by-step solution'),
            h('ol', props.block.steps.map((_, index) =>
              h('li', { key: index }, rich(generated.texts['step' + index] ?? '')))),
            h('dl', { class: 'guide-parameterized-answers' }, generated.answers.flatMap(answer => [
              h('dt', answer.label), h('dd', answer.text),
            ])),
            rich(generated.texts.takeaway ?? props.block.takeaway),
            generated.trace.length ? h('details', [
              h('summary', 'Solver walkthrough'),
              h('ol', generated.trace.map((line, index) => h('li', { key: index }, rich(line)))),
            ]) : null,
          ]) : h('p', { class: 'guide-lesson-prompt' },
            'Predict the result, adjust the values, then reveal the reasoning. Nothing is graded.'),
        ] : [
          loading.value ? h('p', { role: 'status' }, 'Generating an example…') : null,
          problem.value ? h('div', { class: 'guide-teach-error', role: 'alert' }, [
            h('strong', 'This example could not be generated.'),
            h('p', problem.value),
            h('button', { type: 'button', class: 'quiet-button', onClick: newExample }, 'Try another example'),
          ]) : null,
        ],
      ]);
    };
  },
});
