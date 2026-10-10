import { defineComponent, h, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import type { AnswerDefinition, GenerationRules, VariableDefinition } from '../../core/parameterized/template.ts';
import type { Scalar } from '../../core/parameterized/expression.ts';
import { registeredSolvers } from '../../core/parameterized/solvers.ts';

function numberInput(label: string, value: number | undefined, update: (value: number | undefined) => void, optional = false) {
  return h('label', { class: 'knowledge-field' }, [label, h('input', { type: 'number', step: 'any', value: value ?? '',
    onInput: (event: Event) => { const text = inputValue(event); update(!text.trim() ? optional ? undefined : NaN : Number(text)); },
  })]);
}
function textInput(label: string, value: string, update: (value: string) => void) {
  return h('label', { class: 'knowledge-field' }, [label, h('input', { value, maxlength: 2000,
    onInput: (event: Event) => update(inputValue(event)),
  })]);
}
function choiceLines(text: string): Scalar[] {
  return text.split('\n').filter(line => line.trim()).map(line => {
    try { const value: unknown = JSON.parse(line); if (['number','boolean','string'].includes(typeof value)) return value as Scalar; }
    catch { /* Unquoted text is a string choice. */ }
    return line.trim();
  });
}
export const ParameterizedVariables = defineComponent({
  props: { rules: { type: Object as PropType<GenerationRules>, required: true } },
  setup(props) {
    function changeKind(index: number, kind: string) {
      const name = props.rules.variables[index]!.name;
      const variable: VariableDefinition = kind === 'choice' ? { name, kind, values: ['first', 'second'] } :
        kind === 'derived' ? { name, kind, expression: '' } : { name, kind: kind === 'decimal' ? 'decimal' : 'integer', min: 1, max: 10 };
      props.rules.variables[index] = variable;
    }
    return () => h('fieldset', { class: 'knowledge-choice-editor' }, [h('legend', 'Variables'),
      ...props.rules.variables.map((variable, index) => h('div', { class: 'knowledge-parameter-row', key: index }, [
        textInput('Name', variable.name, value => { variable.name = value; }),
        h('label', { class: 'knowledge-field' }, ['Generate', h('select', { value: variable.kind,
          onChange: (event: Event) => changeKind(index, inputValue(event)),
        }, (['integer','decimal','choice','derived'] as const).map(kind => h('option', { value: kind }, { integer: 'Integer range', decimal: 'Decimal range', choice: 'Choose from a list', derived: 'Expression' }[kind])))]),
        variable.kind === 'integer' || variable.kind === 'decimal' ? [
          numberInput('Minimum', variable.min, value => { variable.min = value ?? NaN; }),
          numberInput('Maximum', variable.max, value => { variable.max = value ?? NaN; }),
          variable.kind === 'decimal' ? numberInput('Decimal places (default 2)', variable.precision, value => { variable.precision = value; }, true) : null,
        ] : variable.kind === 'derived' ? textInput('Expression', variable.expression, value => { variable.expression = value; }) :
          variable.kind === 'choice' ? h('label', { class: 'knowledge-field' }, ['Choices (one per line; numbers and true/false supported)', h('textarea', {
            rows: 3, value: variable.values.map(value => JSON.stringify(value)).join('\n'), maxlength: 12000,
            onChange: (event: Event) => { variable.values = choiceLines(inputValue(event)); },
          })]) : null,
        h('button', { type: 'button', class: 'quiet-button', disabled: props.rules.variables.length <= 1,
          onClick: () => props.rules.variables.splice(index, 1) }, 'Remove variable'),
      ])),
      h('button', { type: 'button', class: 'quiet-button', disabled: props.rules.variables.length >= 32,
        onClick: () => { let number = props.rules.variables.length + 1;
          while (props.rules.variables.some(variable => variable.name === `v${number}`) || props.rules.answers.some(answer => answer.key === `v${number}`)) number++;
          props.rules.variables.push({ name: `v${number}`, kind: 'integer', min: 1, max: 10 });
        } }, 'Add variable'),
    ]);
  },
});
export const ParameterizedAnswers = defineComponent({
  props: { rules: { type: Object as PropType<GenerationRules>, required: true } },
  setup(props) {
    function changeSource(answer: AnswerDefinition, source: string) {
      delete answer.expression; delete answer.solverKey;
      if (source === 'solver') answer.solverKey = props.rules.solver?.package?.outputs[0] ?? registeredSolvers().find(solver => solver.id === props.rules.solver?.id)?.outputs[0] ?? '';
      else answer.expression = '';
    }
    return () => h('fieldset', { class: 'knowledge-choice-editor' }, [h('legend', 'Computed answers'),
      ...props.rules.answers.map((answer, index) => h('div', { class: 'knowledge-parameter-row', key: index }, [
        textInput('Answer key', answer.key, value => { answer.key = value; }),
        textInput('Field label', answer.label, value => { answer.label = value; }),
        props.rules.solver ? h('label', { class: 'knowledge-field' }, ['Calculate using', h('select', {
          value: answer.solverKey !== undefined ? 'solver' : 'expression', onChange: (event: Event) => changeSource(answer, inputValue(event)),
        }, [h('option', { value: 'expression' }, 'Expression'), h('option', { value: 'solver' }, 'Solver output')])]) : null,
        answer.solverKey !== undefined ? textInput('Solver output key', answer.solverKey, value => { answer.solverKey = value; }) :
          textInput('Answer expression', answer.expression ?? '', value => { answer.expression = value; }),
        h('label', { class: 'knowledge-field' }, ['Matching', h('select', { value: answer.matching,
          onChange: (event: Event) => { answer.matching = inputValue(event) === 'numeric' ? 'numeric' : 'exact'; },
        }, [h('option', { value: 'numeric' }, 'Numeric'), h('option', { value: 'exact' }, 'Exact text')])]),
        h('details', [h('summary', 'Formatting and tolerances'),
          numberInput('Decimal places (blank keeps full precision)', answer.precision, value => { answer.precision = value; }, true),
          h('label', { class: 'knowledge-field' }, ['Rounding', h('select', { value: answer.rounding ?? 'round',
            onChange: (event: Event) => { const value = inputValue(event); if (value === 'round' || value === 'floor' || value === 'ceil') answer.rounding = value; },
          }, ['round','floor','ceil'].map(method => h('option', { value: method }, method)))]),
          answer.matching === 'numeric' ? [
            numberInput('Absolute tolerance', answer.absoluteTolerance, value => { answer.absoluteTolerance = value; }, true),
            numberInput('Relative tolerance (0.01 = 1%)', answer.relativeTolerance, value => { answer.relativeTolerance = value; }, true),
          ] : null,
        ]),
        h('button', { type: 'button', class: 'quiet-button', disabled: props.rules.answers.length <= 1,
          onClick: () => props.rules.answers.splice(index, 1) }, 'Remove answer'),
      ])),
      h('button', { type: 'button', class: 'quiet-button', disabled: props.rules.answers.length >= 20,
        onClick: () => { let number = props.rules.answers.length + 1;
          while (props.rules.answers.some(answer => answer.key === `answer${number}`) || props.rules.variables.some(variable => variable.name === `answer${number}`)) number++;
          props.rules.answers.push({ key: `answer${number}`, label: `Answer ${number}`, matching: 'numeric', expression: '' });
        } }, 'Add answer'),
    ]);
  },
});
