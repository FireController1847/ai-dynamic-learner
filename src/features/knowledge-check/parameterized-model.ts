import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { isRecord } from '../../core/validation.ts';
import { generateVariant, generateVariantAsync, validateTemplate, type GeneratedVariant } from '../../core/parameterized/generator.ts';
import { validateGenerationRules, type GenerationRules, type QuestionTemplate } from '../../core/parameterized/template.ts';
import { dropdownProblem } from './dropdown-model.ts';
import type { Question } from './question-model.ts';
export interface Parameterization {
  presentation: 'fields' | 'multiple-choice' | 'true-false' | 'fill-in-the-blanks' | 'dropdown';
  rules: GenerationRules; rows?: { label: string; answerKey: string }[];
}
export function defaultParameterization(): Parameterization {
  return { presentation: 'fields', rules: { version: 1, variables: [
    { name: 'a', kind: 'integer', min: 1, max: 10 }, { name: 'b', kind: 'integer', min: 1, max: 10 },
  ], constraints: [], answers: [{ key: 'result', label: 'Your answer', expression: 'a + b', matching: 'numeric', precision: 0 }] } };
}
export function validateParameterization(value: unknown): asserts value is Parameterization {
  if (!isRecord(value) || Object.keys(value).some(key => !['presentation','rules','rows'].includes(key)) ||
      !['fields','multiple-choice','true-false','fill-in-the-blanks','dropdown'].includes(String(value.presentation))) throw new Error('Invalid parameterized presentation.');
  validateGenerationRules(value.rules);
  const rules = value.rules;
  validateTemplate({ ...rules, texts: {} });
  if (value.rows !== undefined && (!Array.isArray(value.rows) || value.rows.length > 20 || value.rows.some(row => !isRecord(row) ||
    Object.keys(row).some(key => !['label','answerKey'].includes(key)) || typeof row.label !== 'string' || row.label.length > 2000 ||
    typeof row.answerKey !== 'string' || !rules.answers.some(answer => answer.key === row.answerKey)))) throw new Error('Invalid generated matching rows.');
  if (value.presentation === 'dropdown' && (!Array.isArray(value.rows) || !value.rows.length)) throw new Error('Dropdown templates need matching rows.');
  if (['multiple-choice','true-false'].includes(String(value.presentation)) && value.rules.answers.length !== 1) throw new Error('This presentation needs exactly one computed answer.');
  if (value.presentation === 'multiple-choice' && !value.rules.distractors?.length) throw new Error('Multiple choice needs computed distractor expressions.');
}
export function questionTemplate(question: Question): QuestionTemplate {
  validateParameterization(question.parameters);
  const texts: Record<string,string> = { prompt: question.prompt, context: question.context ?? '', explanation: question.explanation };
  question.parameters.rows?.forEach((row, index) => { texts[`row${index}`] = row.label; });
  const rules = { ...question.parameters.rules };
  if (!['multiple-choice','dropdown'].includes(question.parameters.presentation)) delete rules.distractors;
  return { ...rules, texts };
}
export function parameterizedProblem(question: Question): string {
  try {
    const template = questionTemplate(question);
    validateTemplate(template);
    if (question.parameters?.presentation === 'fill-in-the-blanks') {
      const withoutSlots = question.prompt.replace(/\[\[[A-Za-z][A-Za-z0-9_]*\]\]/g, '');
      if (/\[\[|\]\]/.test(withoutSlots)) throw new Error('Malformed generated blank marker.');
      const keys = [...question.prompt.matchAll(/\[\[([A-Za-z][A-Za-z0-9_]*)\]\]/g)].map(match => match[1]);
      if (!keys.length || keys.some(key => !template.answers.some(answer => answer.key === key))) throw new Error('Use [[answerKey]] for every generated blank.');
    }
    return '';
  } catch (error) { return error instanceof Error ? error.message : String(error); }
}
export function materializeQuestion(question: Question, seed: string): Question {
  if (question.type !== 'parameterized') return { ...question, choices: [...question.choices], ...(question.matches ? { matches: question.matches.map(row => ({ ...row })) } : {}) };
  const variant = generateVariant(questionTemplate(question), seed);
  return questionFromVariant(question, variant);
}
export async function materializeQuestionAsync(question: Question, seed: string, signal?: AbortSignal, cached?: GeneratedVariant): Promise<Question> {
  if (question.type !== 'parameterized') return materializeQuestion(question, seed);
  const variant = cached ?? await generateVariantAsync(questionTemplate(question), seed, signal);
  return questionFromVariant(question, variant);
}
function questionFromVariant(question: Question, variant: GeneratedVariant): Question {
  const mode = question.parameters!.presentation;
  const result: Question = { id: question.id, type: mode === 'fields' ? 'parameterized' : mode,
    prompt: variant.texts.prompt!, context: variant.texts.context, explanation: variant.texts.explanation ?? '', choices: [], answer: '', generated: variant };
  if (mode === 'multiple-choice') {
    result.choices = variant.choices.map(choice => choice.trim());
    if (result.choices.length < 2 || result.choices.length > 8 || new Set(result.choices).size !== result.choices.length) throw new Error('Generated multiple-choice options must be distinct (2–8).');
    result.answer = variant.answers[0]!.text.trim();
  } else if (mode === 'true-false') {
    if (typeof variant.answers[0]!.value !== 'boolean') throw new Error('True/false answer expressions must return a boolean.');
    result.answer = variant.answers[0]!.value ? 'True' : 'False';
  } else if (mode === 'fill-in-the-blanks') {
    const expectedKeys = [...question.prompt.matchAll(/\[\[([A-Za-z][A-Za-z0-9_]*)\]\]/g)].map(match => match[1]);
    const actualKeys = [...result.prompt.matchAll(/\[\[([A-Za-z][A-Za-z0-9_]*)\]\]/g)].map(match => match[1]);
    if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) throw new Error('Generated variable values introduced unintended blank slots.');
    const ordered = [] as GeneratedVariant['answers'];
    result.prompt = result.prompt.replace(/\[\[([A-Za-z][A-Za-z0-9_]*)\]\]/g, (_match, key: string) => {
      const answer = variant.answers.find(answer => answer.key === key);
      if (!answer || /[{}\r\n]/.test(answer.text)) throw new Error('Generated blank answer is invalid.');
      ordered.push(answer); return `{{${answer.text}}}`;
    });
    const parsed = parseFillBlankTemplate(result.prompt);
    if (!ordered.length || parsed.answers.length !== ordered.length || parsed.answers.some((answer, index) => answer !== ordered[index]!.text.trim())) throw new Error('Generated blanks contain invalid or unintended markers.');
    result.generated = { ...variant, answers: ordered };
  } else if (mode === 'dropdown') {
    result.choices = [...new Set(variant.choices.map(choice => choice.trim()))];
    if (result.choices.length < 2 || result.choices.length > 20) throw new Error('Generated dropdown needs 2–20 choices.');
    result.matches = question.parameters!.rows!.map((row, index) => ({ label: variant.texts[`row${index}`]!, answer: variant.answers.find(answer => answer.key === row.answerKey)!.text.trim() }));
    const problem = dropdownProblem(result.matches, result.choices);
    if (problem) throw new Error(problem);
  }
  if (!result.prompt.trim() || result.prompt.length > 2000 || result.context!.length > 12000 || result.explanation.length > 2000 || result.choices.some(choice => !choice || choice.length > 2000) || variant.answers.some(answer => !answer.text.trim() || answer.text.length > 2000 || !answer.label.trim() || answer.label.length > 2000)) throw new Error('Generated content exceeds question limits.');
  return result;
}
