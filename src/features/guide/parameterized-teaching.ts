import { validateTemplate, type GeneratedVariant } from '../../core/parameterized/generator.ts';
import { validateGenerationRules, type GenerationRules, type QuestionTemplate } from '../../core/parameterized/template.ts';
import { isRecord } from '../../core/validation.ts';

export interface ParameterizedTeachingContent {
  prompt: string; steps: string[]; takeaway: string; rules: GenerationRules;
}
export interface TeachingVariantState { n: number; revealed: boolean; overrides: Record<string, number>; traceStep?: number; traceRevealed?: boolean }

export const defaultTeachingContent = (): ParameterizedTeachingContent => ({
  prompt: 'What is {{a}} + {{b}}?',
  steps: ['Start with the two generated values: **{{a}}** and **{{b}}**.',
    'Add them together: {{a}} + {{b}} = {{result}}.'],
  takeaway: 'The result is **{{result}}**. Generate another example or adjust the inputs to see how it changes.',
  rules: { version: 1, variables: [
    { name: 'a', kind: 'integer', min: 1, max: 10 },
    { name: 'b', kind: 'integer', min: 1, max: 10 },
  ], constraints: [], answers: [
    { key: 'result', label: 'Sum', expression: 'a + b', matching: 'numeric', precision: 0 },
  ] },
});

/** Uses Review's exact expression validator, dependency checks and deterministic generator. */
export function teachingTemplate(value: ParameterizedTeachingContent): QuestionTemplate {
  validateGenerationRules(value.rules);
  const template: QuestionTemplate = {
    ...value.rules,
    texts: { prompt: value.prompt, takeaway: value.takeaway,
      ...Object.fromEntries(value.steps.map((step, index) => ['step' + index, step])) },
  };
  validateTemplate(template);
  return template;
}
export function validTeachingContent(value: ParameterizedTeachingContent) {
  if (typeof value.prompt !== 'string' || !value.prompt.trim() || value.prompt.length > 10000 ||
      !Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 12 ||
      value.steps.some(step => typeof step !== 'string' || !step.trim() || step.length > 10000) ||
      typeof value.takeaway !== 'string' || !value.takeaway.trim() || value.takeaway.length > 10000)
    throw new Error('Parameterized teaching needs a prompt, 1–12 walkthrough steps, and a takeaway.');
  teachingTemplate(value);
}
/** Persist a deterministic state, not generated answers or solver results. */
export function readTeachingState(raw: string | undefined): TeachingVariantState {
  const empty = { n: 0, revealed: false, overrides: {} };
  if (!raw) return empty;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || !Number.isSafeInteger(value.n) || Number(value.n) < 0 ||
        Number(value.n) > 1000000 || typeof value.revealed !== 'boolean' ||
        !isRecord(value.overrides) || Object.keys(value.overrides).length > 8 ||
        Object.entries(value.overrides).some(([name, number]) =>
          !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) || typeof number !== 'number' || !Number.isFinite(number)))
      return empty;
    return {
      n: value.n as number, revealed: value.revealed,
      overrides: value.overrides as Record<string, number>,
      ...(Number.isInteger(value.traceStep) && Number(value.traceStep) >= 0 &&
         Number(value.traceStep) < 1000 ? { traceStep: Number(value.traceStep) } : {}),
      ...(typeof value.traceRevealed === 'boolean' ? { traceRevealed: value.traceRevealed } : {}),
    };
  } catch { return empty; }
}
export function writeTeachingState(value: TeachingVariantState): string {
  const raw = JSON.stringify(value);
  if (raw.length > 2048) throw new Error('Teaching example state exceeded its storage limit.');
  return raw;
}
/** Clamp user-provided variable changes to the rule's precision lattice. */
export function controlledTeachingTemplate(
  value: ParameterizedTeachingContent, overrides: Record<string, number>,
): QuestionTemplate {
  const variables = value.rules.variables.map(variable => {
    const input = overrides[variable.name];
    if ((variable.kind !== 'integer' && variable.kind !== 'decimal') || input === undefined) return variable;
    const factor = variable.kind === 'integer' ? 1 : 10 ** (variable.precision ?? 2);
    const bounded = Math.round(Math.max(variable.min, Math.min(variable.max, input)) * factor) / factor;
    return { ...variable, min: bounded, max: bounded };
  });
  const rules: GenerationRules = { ...value.rules, variables };
  return teachingTemplate({ ...value, rules });
}
export function teachingAnswerLines(variant: GeneratedVariant): string[] {
  return variant.answers.map(answer => answer.label + ': ' + answer.text);
}
