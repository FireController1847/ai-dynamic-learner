import type { Scalar } from './expression.ts';
import type { AnswerDefinition } from './template.ts';
export interface GeneratedAnswer { key: string; label: string; value: Scalar; text: string; matching: 'numeric' | 'exact'; absoluteTolerance: number; relativeTolerance: number }
export function formatAnswer(definition: AnswerDefinition, input: Scalar): GeneratedAnswer {
  let value = input, text = String(input);
  if (definition.matching === 'numeric' && typeof value !== 'number') throw new Error(`${definition.key} requires a numeric result.`);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Answer must be finite.');
    if (definition.precision !== undefined) {
      const factor = 10 ** definition.precision;
      const rounded = definition.rounding === 'floor' ? Math.floor(value * factor) : definition.rounding === 'ceil' ? Math.ceil(value * factor) : Math.round(value * factor);
      value = rounded / factor; text = value.toFixed(definition.precision);
    } else text = String(value);
    if (!Number.isFinite(value)) throw new Error('Formatted answer must be finite.');
  }
  return { key: definition.key, label: definition.label, value, text, matching: definition.matching,
    absoluteTolerance: definition.absoluteTolerance ?? 0, relativeTolerance: definition.relativeTolerance ?? 0 };
}
export function generatedAnswerCorrect(answer: GeneratedAnswer, response: string): boolean {
  const text = response.trim();
  if (answer.matching === 'exact') return text === answer.text.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) || typeof answer.value !== 'number') return false;
  const value = Number(text);
  if (!Number.isFinite(value)) return false;
  const tolerance = Math.max(answer.absoluteTolerance, answer.relativeTolerance * Math.abs(answer.value));
  return Math.abs(value - answer.value) <= tolerance + Number.EPSILON * Math.max(1, Math.abs(answer.value)) * 4;
}
