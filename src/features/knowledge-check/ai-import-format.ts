import { parseAiImportJson } from '../../core/ai-json.ts';
import { categoryScopedPrompt, type AiCardScope } from '../../core/ai-study-categories.ts';
import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { isRecord } from '../../core/validation.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import { createQuestion, MAX_TEXT, questionReady, validateQuestions, type Question } from './question-model.ts';
import { AI_QUESTION_TYPES, allocateQuestions, questionTypeLabel, type QuestionWeights } from './ai-question-mix.ts';

export const REVIEW_AI_FORMAT = 'dynamic-learner-review';
export interface ReviewAiImport { title: string; description: string; questions: Question[] }
export interface ReviewAiPreferences { count: number; weights: QuestionWeights; coverage: 'essentials' | 'balanced' | 'comprehensive' }

export function reviewAiPrompt(preferences: ReviewAiPreferences, scope: AiCardScope | null): string {
  const counts = allocateQuestions(preferences.weights, preferences.count);
  const examples: Record<keyof QuestionWeights, object> = {
    'multiple-choice': { type: 'multiple-choice', prompt: 'Which symbol represents gold?', choices: ['Au', 'Ag', 'Fe', 'Cu'], answer: 'Au', explanation: 'Au represents gold.' },
    'true-false': { type: 'true-false', prompt: 'The chemical symbol for gold is Au.', answer: 'True' },
    'fill-in-the-blanks': { type: 'fill-in-the-blanks', prompt: 'The chemical symbol for gold is {{Au}}.' },
    'short-answer': { type: 'short-answer', prompt: 'What is the chemical symbol for gold?', answer: 'Au' },
    statement: { type: 'statement', prompt: 'Gold has the chemical symbol Au.' },
  };
  const prompt = `Using the original source material supplied earlier in this conversation, construct a Dynamic Learner Review knowledge set.

Scope: ${scope ? 'Only the selected category described above.' : 'The overall subject: distribute useful questions across its major topics.'}
Coverage: ${preferences.coverage === 'essentials' ? 'Core concepts only.' : preferences.coverage === 'comprehensive' ? 'Broad useful coverage, without trivia or repetition.' : 'Major ideas and useful supporting facts.'}

Create EXACTLY ${preferences.count} items, with this exact question mix (counts already account for rounding):
${AI_QUESTION_TYPES.map(type => `- ${questionTypeLabel(type)}: ${preferences.weights[type]}% preference → ${counts[type]} items`).join('\n')}
Types with zero items are forbidden. Do not substitute another type. If the source cannot support this many useful items, ask me to reduce the count instead of inventing facts.

Question quality:
- Multiple choice: normally four distinct, plausible choices, exactly one correct. Put the correct choice's exact text in answer. Avoid giveaway wording, arbitrary tricks, "all of the above", and always putting the correct answer first. Mix the answer positions.
- True/false: one clear factual claim, with answer exactly "True" or "False". Include both outcomes when useful, without ambiguous qualifiers or trick statements.
- Fill in the blanks: {{answer}} markers inside concise, contextual statements. Almost always one word per blank; 2–3 only for an indivisible term. For separate items use {{letters}} and {{numbers}} or {{letters}} or {{numbers}}, preserving the source meaning. Keep meaningful context visible; several related blanks are welcome. Keep terminology and blank boundaries consistent throughout, never alternating a full term like "nullword" with "null" for the same concept.
- Short answer, ONLY when enabled: a specific quick-recall question with an answer of 1–5 words, not an essay or a list.
- Statement, ONLY when enabled: a concise authored fact or transition with no answer, choices, or explanation; it is not scored.
- Make every item self-contained, accurate, and based on the source. Avoid duplicates and unsupported facts. Do not include citations, URLs, source markers, IDs, session settings, or other application data.
- An optional explanation may give one short clarifying sentence for a scored question. It must not be present on a Statement.

Return ONLY one JSON code block using this structure:
\`\`\`json
${JSON.stringify({ format: REVIEW_AI_FORMAT, version: 1, title: 'Short knowledge set title', description: 'Brief scope of this knowledge set.', questions: AI_QUESTION_TYPES.filter(type => counts[type] > 0).map(type => examples[type]) }, null, 2)}
\`\`\`

These are format examples only; use the requested counts and source content, not these example facts. Title: 1–${MAX_NAME_LENGTH} characters. Description: at most ${MAX_TEXT} characters. Prompt, answer, explanation, and each choice: at most ${MAX_TEXT} characters of plain text.
Use only type/prompt/choices/answer/optional explanation on multiple choice; omit choices on true/false and short answer. On fill in the blanks use type/prompt/optional explanation, with answers embedded in {{markers}}. On statements use only type/prompt.`;
  return scope ? categoryScopedPrompt(prompt, scope, 'Review questions') : prompt;
}

export function parseReviewAiImport(text: string, preferences: ReviewAiPreferences): ReviewAiImport {
  const expected = allocateQuestions(preferences.weights, preferences.count);
  const value = parseAiImportJson(text);
  if (!isRecord(value) || Object.keys(value).some(key => !['format', 'version', 'title', 'description', 'questions'].includes(key)) ||
      value.format !== REVIEW_AI_FORMAT || value.version !== 1 || typeof value.title !== 'string' ||
      !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH ||
      typeof value.description !== 'string' || value.description.length > MAX_TEXT ||
      !Array.isArray(value.questions) || value.questions.length !== preferences.count) {
    throw new Error(`Paste a supported Review response with exactly ${preferences.count} items, a title, and a description.`);
  }
  const entries: unknown[] = value.questions;
  const questions = entries.map((entry, index): Question => {
    if (!isRecord(entry) || !AI_QUESTION_TYPES.some(type => type === entry.type) ||
        typeof entry.prompt !== 'string' || !entry.prompt.trim() || entry.prompt.length > MAX_TEXT) {
      throw new Error(`Item ${index + 1} needs a supported type and a non-empty prompt.`);
    }
    const type = AI_QUESTION_TYPES.find(type => type === entry.type)!;
    const fields = type === 'statement' ? ['type', 'prompt'] : type === 'fill-in-the-blanks' ? ['type', 'prompt', 'explanation'] :
      type === 'multiple-choice' ? ['type', 'prompt', 'answer', 'choices', 'explanation'] : ['type', 'prompt', 'answer', 'explanation'];
    if (Object.keys(entry).some(key => !fields.includes(key)) ||
        (Object.hasOwn(entry, 'explanation') && (typeof entry.explanation !== 'string' || entry.explanation.length > MAX_TEXT))) {
      throw new Error(`Item ${index + 1} contains unsupported fields or an invalid explanation.`);
    }
    const question = createQuestion(type);
    question.prompt = entry.prompt.trim();
    question.explanation = typeof entry.explanation === 'string' ? entry.explanation.trim() : '';
    if (type !== 'statement' && type !== 'fill-in-the-blanks') {
      if (typeof entry.answer !== 'string' || !entry.answer.trim() || entry.answer.length > MAX_TEXT) throw new Error(`Item ${index + 1} needs a short correct answer.`);
      question.answer = entry.answer.trim();
    }
    if (type === 'multiple-choice') {
      if (!Array.isArray(entry.choices) || entry.choices.length < 2 || entry.choices.length > 8 ||
          entry.choices.some(choice => typeof choice !== 'string' || !choice.trim() || choice.length > MAX_TEXT)) {
        throw new Error(`Item ${index + 1} needs 2–8 non-empty answer choices.`);
      }
      question.choices = entry.choices.map((choice: string) => choice.trim());
    }
    if (type === 'fill-in-the-blanks') {
      const template = parseFillBlankTemplate(question.prompt);
      if (!template.answers.length || /\{\{[^{}]*[\r\n][^{}]*\}\}/u.test(question.prompt) ||
          template.segments.some(segment => segment.type === 'text' && /[{}]/u.test(segment.text)) ||
          !template.segments.some(segment => segment.type === 'text' && /[\p{L}\p{N}]/u.test(segment.text))) {
        throw new Error(`Item ${index + 1} needs valid {{answer}} blanks with visible context.`);
      }
    }
    if (!questionReady(question)) throw new Error(`Item ${index + 1} is incomplete or its correct answer does not match a distinct choice.`);
    return question;
  });
  validateQuestions(questions);
  for (const type of AI_QUESTION_TYPES) {
    const actual = questions.filter(question => question.type === type).length;
    if (actual !== expected[type]) throw new Error(`${questionTypeLabel(type)}: expected ${expected[type]} items, received ${actual}. Regenerate using the current prompt and mix.`);
  }
  return { title: value.title.trim(), description: value.description.trim(), questions };
}
