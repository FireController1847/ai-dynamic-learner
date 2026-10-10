import type { GeneratedVariant } from '../../core/parameterized/generator.ts';
import { validateGeneratedVariant } from '../../core/parameterized/variant-validation.ts';
import { formatAnswer } from '../../core/parameterized/answers.ts';
import { isRecord } from '../../core/validation.ts';
import { materializeQuestionAsync } from './parameterized-model.ts';
import { validateQuestions, type Question, type QuestionResponse } from './question-model.ts';
import { validateSetOptions } from './set-options.ts';
import type { SessionSettings } from './session-settings.ts';
import { seededRandom } from '../../core/parameterized/random.ts';

export interface ParameterizedSessionSnapshot {
  version: 1; instances?: Record<string, GeneratedVariant>; templates: Question[]; seeds: Record<string, string>; settings: SessionSettings;
  position: number; responses: Record<string, QuestionResponse>; feedbackResponses: Record<string, QuestionResponse>;
  checked: string[]; revealed: string[]; hints: string[]; attempts: Record<string, number>;
  submitted: boolean; expired: boolean; deadline: number | null;
  studyChecks: number; studyCorrectChecks: number; studyVisited: string[]; studyPassRecorded: boolean;
}
const MAX_SNAPSHOT = 4 * 1024 * 1024;
export const sessionStorageKey = (id: string, mode: string) => `dynamic-learner.review.generated-session.v1:${id}:${mode}`;
function natural(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
export function validateSessionSnapshot(value: unknown): asserts value is ParameterizedSessionSnapshot {
  if (!isRecord(value) || value.version !== 1 || Object.keys(value).some(key => ![
    'version','instances','templates','seeds','settings','position','responses','feedbackResponses','checked','revealed','hints','attempts',
    'submitted','expired','deadline','studyChecks','studyCorrectChecks','studyVisited','studyPassRecorded',
  ].includes(key))) throw new Error('Unsupported saved generated session.');
  validateQuestions(value.templates);
  if (!value.templates.length || !value.templates.some(question => question.type === 'parameterized')) throw new Error('Saved session has no generated templates.');
  const ids = new Set(value.templates.map(question => question.id));
  if (!isRecord(value.settings) || Object.keys(value.settings).some(key => ![
    'order','presentation','allowBack','questionLimit','shuffleChoices','shortAnswerStrictness','fillBlankAnswerStrictness','quizAttempts','timeLimitMinutes','showTestAnswers',
  ].includes(key))) throw new Error('Invalid saved session settings.');
  const settings = value.settings;
  // Old in-progress sessions were all one-at-a-time. Preserve that layout on resume.
  if (settings.presentation === undefined) settings.presentation = 'one-at-a-time';
  if (settings.allowBack === undefined) settings.allowBack = true;
  validateSetOptions({ description: '', assessmentOrder: settings.order, assessmentQuestionLimit: settings.questionLimit,
    quizPresentation: settings.presentation, testPresentation: settings.presentation,
    quizAllowBack: settings.allowBack, testAllowBack: settings.allowBack,
    shuffleChoices: settings.shuffleChoices, shortAnswerStrictness: settings.shortAnswerStrictness,
    fillBlankAnswerStrictness: settings.fillBlankAnswerStrictness, quizAttempts: settings.quizAttempts,
    timeLimitMinutes: settings.timeLimitMinutes, showTestAnswers: settings.showTestAnswers });
  if (!natural(value.position) || value.position >= value.templates.length || !natural(value.studyChecks) ||
      !natural(value.studyCorrectChecks) || value.studyCorrectChecks > value.studyChecks ||
      typeof value.submitted !== 'boolean' || typeof value.expired !== 'boolean' || typeof value.studyPassRecorded !== 'boolean' ||
      value.deadline !== null && (!natural(value.deadline) || value.deadline > 8640000000000000)) throw new Error('Invalid saved session progress.');
  for (const key of ['checked','revealed','hints','studyVisited']) {
    const list = value[key];
    if (!Array.isArray(list) || list.length > ids.size || new Set(list).size !== list.length || list.some(id => typeof id !== 'string' || !ids.has(id))) throw new Error('Invalid saved session flags.');
  }
  for (const key of ['responses','feedbackResponses']) {
    const entries = value[key];
    if (!isRecord(entries) || Object.entries(entries).some(([id, response]) => !ids.has(id) ||
      !(typeof response === 'string' && response.length <= 2000 || Array.isArray(response) && response.length <= 1000 &&
        response.every(text => typeof text === 'string' && text.length <= 2000)))) throw new Error('Invalid saved responses.');
  }
  if (!isRecord(value.attempts) || Object.entries(value.attempts).some(([id, count]) => !ids.has(id) || !natural(count))) throw new Error('Invalid saved attempts.');
  if (value.instances !== undefined) {
    if (!isRecord(value.instances) || Object.keys(value.instances).some(id => !ids.has(id))) throw new Error('Invalid saved instance IDs.');
    for (const [id, instance] of Object.entries(value.instances)) {
      validateGeneratedVariant(instance);
      const template = value.templates.find(question => question.id === id);
      if (template?.type !== 'parameterized') throw new Error('Generated instance has no template.');
      const definitions = template.parameters!.rules.answers;
      const keys = template.parameters!.presentation === 'fill-in-the-blanks' ? [...template.prompt.matchAll(/\[\[([A-Za-z][A-Za-z0-9_]*)\]\]/g)].map(match => match[1]) : definitions.map(answer => answer.key);
      if (keys.length !== instance.answers.length || instance.answers.some((answer, index) => answer.key !== keys[index])) throw new Error('Saved instance answer keys do not match its template.');
      for (const answer of instance.answers) {
        const definition = definitions.find(definition => definition.key === answer.key)!;
        const formatted = formatAnswer(definition, answer.value);
        if (formatted.text !== answer.text || formatted.matching !== answer.matching || formatted.absoluteTolerance !== answer.absoluteTolerance || formatted.relativeTolerance !== answer.relativeTolerance) throw new Error('Saved answer formatting or tolerances do not match the template.');
      }
    }
  }
  const seeds = value.seeds;
  if (!isRecord(seeds) || Object.entries(seeds).some(([id, seed]) => !ids.has(id) || typeof seed !== 'string' || !seed || seed.length > 128) ||
      value.templates.some(question => typeof seeds[question.id] !== 'string')) throw new Error('Missing variant seeds.');
  if (isRecord(value.instances) && Object.entries(value.instances).some(([id, instance]) => isRecord(instance) && instance.seed !== seeds[id])) throw new Error('Saved instance seed mismatch.');
}
export function readSession(key: string): ParameterizedSessionSnapshot | null {
  const text = localStorage.getItem(key);
  if (!text) return null;
  if (text.length > MAX_SNAPSHOT) throw new Error('Saved session exceeds the size limit.');
  const value: unknown = JSON.parse(text); validateSessionSnapshot(value); return value;
}
export function writeSession(key: string, snapshot: ParameterizedSessionSnapshot): void {
  const text = JSON.stringify(snapshot);
  if (text.length > MAX_SNAPSHOT) throw new Error('Session is too large to save locally.');
  localStorage.setItem(key, text);
}
/** Choices use a separate deterministic stream; reloading never changes their order. */
export async function sessionVariant(template: Question, seed: string, shuffleChoices: boolean, signal?: AbortSignal, cached?: GeneratedVariant): Promise<Question> {
  const question = await materializeQuestionAsync(template, seed, signal, cached);
  if (shuffleChoices && ['multiple-choice','dropdown'].includes(question.type)) {
    const random = seededRandom(`${seed}:choices`);
    for (let index = question.choices.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [question.choices[index], question.choices[other]] = [question.choices[other]!, question.choices[index]!];
    }
  }
  return question;
}
