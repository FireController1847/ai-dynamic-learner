import { isRecord } from '../validation.ts';
import { validName } from './template.ts';
import type { GeneratedVariant } from './generator.ts';
const text = (value: unknown, maximum: number): value is string => typeof value === 'string' && value.length <= maximum;
const natural = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function validateGeneratedVariant(value: unknown): asserts value is GeneratedVariant {
  if (!isRecord(value) || value.version !== 1 || Object.keys(value).some(key => !['version','seed','attempt','values','texts','answers','choices','trace'].includes(key)) ||
      !text(value.seed, 128) || !value.seed || !natural(value.attempt) || value.attempt >= 128 ||
      !isRecord(value.values) || Object.keys(value.values).length > 128 || Object.entries(value.values).some(([name, scalar]) => !validName(name) ||
        !(typeof scalar === 'number' && Number.isFinite(scalar) || typeof scalar === 'boolean' || text(scalar, 12000))) ||
      !isRecord(value.texts) || Object.keys(value.texts).length > 128 || Object.values(value.texts).some(region => !text(region, 12000)) ||
      !Array.isArray(value.answers) || !value.answers.length || value.answers.length > 1000 ||
      !Array.isArray(value.choices) || value.choices.length > 27 || value.choices.some(choice => !text(choice, 2000)) ||
      !Array.isArray(value.trace) || value.trace.length > 1000 || value.trace.some(line => !text(line, 12000))) throw new Error('Invalid saved generated instance.');
  for (const answer of value.answers as unknown[]) {
    if (!isRecord(answer) || Object.keys(answer).some(key => !['key','label','value','text','matching','absoluteTolerance','relativeTolerance'].includes(key)) ||
        typeof answer.key !== 'string' || !validName(answer.key) || !text(answer.label, 2000) || !text(answer.text, 2000) ||
        !(typeof answer.value === 'number' && Number.isFinite(answer.value) || typeof answer.value === 'boolean' || text(answer.value, 2000)) ||
        !['numeric','exact'].includes(String(answer.matching)) || answer.matching === 'numeric' && typeof answer.value !== 'number' ||
        ['absoluteTolerance','relativeTolerance'].some(key => typeof answer[key] !== 'number' || !Number.isFinite(answer[key]) || answer[key] < 0)) throw new Error('Invalid saved generated answer.');
  }
}
