import { computed, defineComponent, h, ref, watch, onBeforeUnmount, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import { newVariantSeed } from '../../core/parameterized/random.ts';
import type { SolverPackage } from '../../core/parameterized/solver-package.ts';
import { SolverEditor } from './solver-editor.ts';
import { MarkdownContent } from '../../components/markdown-content.ts';
import type { Question } from './question-model.ts';
import { materializeQuestionAsync, parameterizedProblem, validateParameterization, type Parameterization } from './parameterized-model.ts';
import { ParameterizedAnswers, ParameterizedVariables } from './parameterized-fields.ts';

export const ParameterizedEditor = defineComponent({
  props: { question: { type: Object as PropType<Question>, required: true }, packages: { type: Array as PropType<SolverPackage[]>, default: () => [] } },
  emits: { draftProblem: (_message: string) => true, uploadSolver: (_pkg: SolverPackage) => true },
  setup(props, { emit }) {
    const preview = ref<Question | null>(null);
    const previewError = ref('');
    const previewing = ref(false);
    let previewController = new AbortController();
    onBeforeUnmount(() => previewController.abort());
    const advanced = ref(false);
    const json = ref('');
    const jsonError = ref('');
    const problem = computed(() => parameterizedProblem(props.question));
    watch(() => props.question, () => { previewController.abort(); previewing.value = false; preview.value = null; previewError.value = ''; }, { deep: true });
    async function previewVariant() {
      previewController.abort(); previewController = new AbortController(); const controller = previewController;
      previewing.value = true;
      try { const variant = await materializeQuestionAsync(props.question, newVariantSeed(), controller.signal);
        if (!controller.signal.aborted) { preview.value = variant; previewError.value = ''; }
      } catch (error) { if (!controller.signal.aborted) { preview.value = null; previewError.value = error instanceof Error ? error.message : String(error); } }
      finally { if (previewController === controller) previewing.value = false; }
    }
    function applyJson() {
      try {
        const value: unknown = JSON.parse(json.value); validateParameterization(value);
        const next = { ...props.question, parameters: value };
        const message = parameterizedProblem(next); if (message) throw new Error(message);
        props.question.parameters = value; advanced.value = false; jsonError.value = ''; emit('draftProblem', '');
      } catch (error) { jsonError.value = error instanceof Error ? error.message : String(error); }
    }
    function lines(label: string, values: string[], update: (values: string[]) => void) {
      return h('label', { class: 'knowledge-field' }, [label, h('textarea', { rows: 3, value: values.join('\n'), maxlength: 12000,
        onInput: (event: Event) => update(inputValue(event).split('\n').map(line => line.trim()).filter(Boolean)),
      })]);
    }
    return () => {
      const parameters = props.question.parameters!;
      const rules = parameters.rules;
      const generated = preview.value?.generated;
      return h('section', { class: 'knowledge-parameterized-editor', 'aria-label': 'Parameterized question rules' }, [
        h('p', { class: 'knowledge-muted' }, 'Use {{name}} in the question, Markdown context, and explanation. Define an expression for each answer. Values are generated once per session.'),
        h('label', { class: 'knowledge-field' }, ['Answer format', h('select', { value: parameters.presentation, disabled: advanced.value,
          onChange: (event: Event) => {
            const value = inputValue(event);
            if (['fields','multiple-choice','true-false','fill-in-the-blanks','dropdown'].includes(value)) parameters.presentation = value as Parameterization['presentation'];
            if (value === 'multiple-choice' && !rules.distractors?.length) rules.distractors = [`${rules.answers[0]!.key} + 1`, `${rules.answers[0]!.key} - 1`, `${rules.answers[0]!.key} + 2`];
            if (value !== 'dropdown') delete parameters.rows;
            if (!['multiple-choice','dropdown'].includes(value)) delete rules.distractors;
            if (value === 'true-false') rules.answers.forEach(answer => { answer.matching = 'exact'; });
            if (value === 'dropdown' && !parameters.rows?.length) parameters.rows = [{ label: 'Result', answerKey: rules.answers[0]!.key }];
          },
        }, [ ['fields','Typed answer fields'], ['multiple-choice','Multiple choice'], ['true-false','True or false'],
          ['fill-in-the-blanks','Fill in the blanks'], ['dropdown','Dropdown matching'],
        ].map(([value, label]) => h('option', { value }, label)))]),
        parameters.presentation === 'fill-in-the-blanks' ? h('p', 'Use [[answerKey]] where a computed blank belongs; {{variable}} inserts visible values.') : null,
        advanced.value ? [
          h('label', { class: 'knowledge-field' }, ['Advanced rules JSON', h('textarea', { rows: 20, value: json.value, maxlength: 100000,
            onInput: (event: Event) => { json.value = inputValue(event); }, spellcheck: false,
          })]),
          jsonError.value ? h('p', { role: 'alert', class: 'knowledge-message' }, jsonError.value) : null,
          h('div', { class: 'knowledge-actions' }, [
            h('button', { type: 'button', class: 'card-primary-button', onClick: applyJson }, 'Apply rules'),
            h('button', { type: 'button', class: 'quiet-button', onClick: () => { advanced.value = false; emit('draftProblem', ''); } }, 'Cancel rules edit'),
          ]),
        ] : [
          h(ParameterizedVariables, { rules }),
          lines('Constraints (one expression per line, optional)', rules.constraints, values => { rules.constraints = values; }),
          h(SolverEditor, { rules, packages: props.packages, onUpload: (pkg: SolverPackage) => emit('uploadSolver', pkg) }),
          h(ParameterizedAnswers, { rules }),
          ['multiple-choice','dropdown'].includes(parameters.presentation) ? lines('Distractor expressions (one per line)', rules.distractors ?? [], values => { rules.distractors = values; }) : null,
          parameters.presentation === 'dropdown' ? h('fieldset', { class: 'knowledge-choice-editor' }, [h('legend', 'Matching rows'),
            ...(parameters.rows ?? []).map((row, index) => h('div', { class: 'knowledge-parameter-row', key: index }, [
              h('label', { class: 'knowledge-field' }, ['Row label', h('input', { value: row.label, maxlength: 2000,
                onInput: (event: Event) => { row.label = inputValue(event); } })]),
              h('label', { class: 'knowledge-field' }, ['Computed answer', h('select', { value: row.answerKey,
                onChange: (event: Event) => { row.answerKey = inputValue(event); },
              }, rules.answers.map(answer => h('option', { value: answer.key }, answer.key)))]),
              h('button', { type: 'button', class: 'quiet-button', onClick: () => parameters.rows?.splice(index, 1) }, 'Remove row'),
            ])),
            h('button', { type: 'button', class: 'quiet-button', disabled: (parameters.rows?.length ?? 0) >= 20,
              onClick: () => { (parameters.rows ??= []).push({ label: '', answerKey: rules.answers[0]!.key }); } }, 'Add row'),
          ]) : null,
          h('button', { type: 'button', class: 'quiet-button', onClick: () => {
            json.value = JSON.stringify(parameters, null, 2); advanced.value = true; jsonError.value = '';
            emit('draftProblem', 'Apply or cancel the advanced rules edit before saving.');
          } }, 'Advanced rules'),
        ],
        problem.value ? h('p', { role: 'status', class: 'knowledge-message' }, problem.value) : null,
        h('button', { type: 'button', class: 'quiet-button', disabled: Boolean(problem.value) || advanced.value || previewing.value,
          onClick: previewVariant }, previewing.value ? 'Generating preview…' : generated ? 'Generate another preview' : 'Preview variant'),
        previewError.value ? h('p', { role: 'alert', class: 'knowledge-message' }, previewError.value) : null,
        generated && preview.value ? h('div', { class: 'knowledge-parameterized-preview' }, [
          h('h4', preview.value.prompt),
          preview.value.context ? h(MarkdownContent, { text: preview.value.context }) : null,
          preview.value.choices.length ? h('ul', preview.value.choices.map(choice => h('li', choice))) : null,
          h('dl', generated.answers.flatMap(answer => [h('dt', answer.label), h('dd', answer.text)])),
          preview.value.explanation ? h('p', preview.value.explanation) : null,
          h('details', [h('summary', 'Inspect generated values and seed'),
            h('p', `Seed: ${generated.seed} · Generation attempt: ${generated.attempt + 1}`),
            h('dl', Object.entries(generated.values).flatMap(([name, value]) => [h('dt', name), h('dd', String(value))])),
            generated.trace.length ? h('ol', generated.trace.map(line => h('li', line))) : null,
          ]),
        ]) : null,
      ]);
    };
  },
});
