import { AI_PARAMETERIZED_EXAMPLE, AI_SOLVER_EXAMPLE, PARAMETERIZED_AI_GUIDANCE, parseAiSolvers, resolveAiParameters } from './ai-parameterized-format.ts';
import { parseAiImportJson } from '../../core/ai-json.ts';
import { categoryScopedPrompt, type AiCardScope } from '../../core/ai-study-categories.ts';
import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { isRecord } from '../../core/validation.ts';
import { AI_MARKDOWN_CONTEXT_GUIDANCE } from '../../core/ai-formatting-guidance.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import { createQuestion, MAX_TEXT, MAX_QUESTION_CONTEXT, questionReady, validateQuestions, MAX_QUESTIONS, type Question } from './question-model.ts';
import { MAX_DROPDOWN_CHOICES, MAX_DROPDOWN_ROWS, validateDropdownMatches } from './dropdown-model.ts';
import { AI_QUESTION_TYPES, DEFAULT_AI_WEIGHTS, allocateQuestions, questionCountProblem, questionTypeLabel, type QuestionWeights } from './ai-question-mix.ts';

export const REVIEW_AI_FORMAT = 'dynamic-learner-review';
export interface ReviewAiImport { title: string; description: string; questions: Question[]; warnings: string[] }
export type ReviewAiMixMode = 'custom' | 'ai';
export interface ReviewAiPreferences {
  count: number;
  mixMode: ReviewAiMixMode;
  weights: QuestionWeights;
  coverage: 'essentials' | 'balanced' | 'comprehensive';
}

export function reviewAiPrompt(preferences: ReviewAiPreferences, scope: AiCardScope | null): string {
  const countProblem = questionCountProblem(preferences.count);
  if (countProblem) throw new Error(countProblem);
  const aiChoosesMix = preferences.mixMode === 'ai';
  const counts = aiChoosesMix ? null : allocateQuestions(preferences.weights, preferences.count);
  const enabledTypes = AI_QUESTION_TYPES.filter(type => counts === null || counts[type] > 0);
  const allowParameterized = counts === null || counts.parameterized > 0;
  const examples: Record<keyof QuestionWeights, object> = {
    'multiple-choice': { type: 'multiple-choice', prompt: 'Which symbol represents gold?', choices: ['Au', 'Ag', 'Fe', 'Cu'],
      answer: 'Au', choicePool: { displayCount: 4, distractors: ['Pt', 'Sn', 'Pb', 'Zn'] },
      explanation: 'Au represents gold.' },
    'true-false': { type: 'true-false', prompt: 'The chemical symbol for gold is Au.', answer: 'True' },
    'fill-in-the-blanks': { type: 'fill-in-the-blanks', prompt: 'Use the table: A = {{amylase}} and B = {{pepsin}}.', context: '| Substrate | Enzyme label |\n| --- | --- |\n| Starch | A |\n| Protein | B |' },
    'short-answer': { type: 'short-answer', prompt: 'What is the chemical symbol for gold?', answer: 'Au' },
    dropdown: { type: 'dropdown', prompt: 'Match each element to its symbol.', choices: ['Au', 'Ag', 'Fe'],
      matches: [{ label: 'Gold', answer: 'Au' }, { label: 'Silver', answer: 'Ag' }] },
    parameterized: AI_PARAMETERIZED_EXAMPLE,
    statement: { type: 'statement', prompt: 'Gold has the chemical symbol Au.' },
  };
  const quality: Record<keyof QuestionWeights, string> = {
    'multiple-choice': '- Multiple Choice: typically four distinct, plausible choices, using closely related alternatives from the same topic. Use answer for one correct choice or correctAnswers for genuinely multiple correct choices, never both. When many plausible incorrect terms exist, prefer a reusable choicePool (displayCount 2–8 and 1–100 additional distinct incorrect terms) rather than duplicate copies of one question. Correct answers always appear, while the incorrect slots are sampled from the base choices and additional pool. Avoid giveaway distractors.',
    'true-false': '- True/False: a clear, unambiguous claim with answer exactly "True" or "False".',
    'fill-in-the-blanks': '- Fill in the Blanks: {{answer}} markers belong ONLY in the plain-text prompt. Prefer a single word, number, or indivisible term per blank. For association tables/diagrams in Markdown context, label missing cells A/B/1/2 and ask A = {{term}}, B = {{term}} in the prompt. Multiple related blanks are encouraged; never reveal the answer in context.',
    'short-answer': '- Short Answer: only short, uniquely checkable responses (usually 1–5 words) that cannot be assessed more reliably with another type.',
    dropdown: `- Dropdown: directly test matching relationships, with 1–${MAX_DROPDOWN_ROWS} labeled rows (label/answer) and 2–${MAX_DROPDOWN_CHOICES} distinct shared choices. Every answer must appear in choices; use plausible neighbors. A matching table counts as one item.`,
    'statement': '- Statement: unscored directions/context only; do not substitute it for meaningful scored questions.',
    parameterized: PARAMETERIZED_AI_GUIDANCE,
  };
  const fields: Record<keyof QuestionWeights, string> = {
    'multiple-choice': 'Use type/prompt/choices/answer/optional explanation; multi-answer replaces answer with correctAnswers. Optional choicePool: { displayCount: integer 2–8, distractors: string[] of 1–100 unique extra incorrect terms }. Correct answers must be in choices and count toward displayCount; remaining slots sample from base incorrect choices plus additional terms. Do not provide both answer and correctAnswers.',
    'true-false': 'Use type/prompt/answer/optional explanation on true/false; omit choices.',
    'short-answer': 'Use type/prompt/answer/optional explanation on short answer; omit choices.',
    'dropdown': 'On Dropdown use type/prompt/choices/matches/optional explanation, with correct answers inside the matching rows and no top-level answer.',
    'fill-in-the-blanks': 'On fill in the blanks use type/prompt/optional explanation, with answers embedded in {{markers}}.',
    'statement': 'On statements use only type/prompt.',
    'parameterized': 'On parameterized questions use type/prompt/parameters/optional explanation, and place referenced JavaScript solver packages in the optional top-level solvers array.',
  };
  const prompt = `Using the original source material supplied earlier in this conversation, create a Dynamic Learner Review knowledge set as a teacher or instructor would assess it.

Scope: ${scope ? 'Only the selected category described above.' : 'The overall subject, covering its important topics.'}
Coverage: ${preferences.coverage === 'essentials' ? 'Core concepts only.' : preferences.coverage === 'comprehensive' ? 'Broad useful coverage without trivia or repetition.' : 'Major ideas and useful supporting facts.'}
Create EXACTLY ${preferences.count} items.
${aiChoosesMix
    ? 'Choose question types and counts to suit the material; omit unsuitable types. Favor scored questions over arbitrary quotas or unscored filler.'
    : `Use EXACTLY this mix:
${enabledTypes.map(type => `- ${questionTypeLabel(type)}: ${counts![type]} items`).join('\n')}`}
Use ONLY these types: ${enabledTypes.map(questionTypeLabel).join(', ')}. If the source cannot support the count, ask to reduce it rather than invent content.

Choose the approach from the material (respect any specified type counts):
1. LOGIC / NUMBERS / PROCEDURES: Favor reusable Parameterized questions wherever inputs, calculations, rules, or algorithms can genuinely vary. Test the method with many valid solvable variants, not one fixed numerical result. Supply feasible ranges, constraints and complete solvers as needed. Never randomize fixed facts, diagnostic thresholds, or medical constants. If Parameterized is unavailable or unsuitable, use another enabled type.
2. RECALL / FIXED FACTS / MEDICAL / ASSOCIATIONS: Favor Multiple Choice, Fill in the Blanks, and matching Dropdowns. Test relationships directly (enzyme ↔ substrate, function ↔ term, symptom ↔ condition, threshold ↔ meaning). Reverse associations where useful; use plausible near-miss distractors to test distinctions, not obviously wrong options. Keep grading unambiguous.

Think like an instructor when CHOOSING what to test, not when wording the questions. Emphasize what the source repeats, compares, demonstrates, or expects learners to apply. Vary scenarios and difficulty without redundant questions or outside facts.
Write natural, standalone exam questions, contexts, and explanations. NEVER say "from the notes", "in class", "according to the lecture", "as discussed", "in the material", or similar references to lessons, instructors, sources, or studying. Ask directly about the concept; referencing a table or diagram actually included in the question's context is fine.

Use creative, relevant Markdown context: GFM tables, comparison charts, supplied-figure relationships, short text diagrams/flows (fenced text), and KaTeX math. Present data or labeled gaps for interpretation rather than answer keys. For table-based Fill in the Blanks, put labeled unknown cells in context but scored {{blanks}} ONLY in prompt. Use context where it helps; omit decorative or invented figures, unsupported image URLs, and raw HTML.

Type-specific rules:
${enabledTypes.map(type => quality[type]).join('\n')}
- Questions must be self-contained, source-grounded, distinct, and fairly graded. Never include citations, URLs, source markers, question IDs, or settings; parameter/solver identifiers are permitted. Brief explanations may clarify scored answers.

${AI_MARKDOWN_CONTEXT_GUIDANCE}

Return ONLY one fenced JSON code block in this structure:
\`\`\`json
${JSON.stringify({ format: REVIEW_AI_FORMAT, version: 1, title: 'Short knowledge set title', description: 'Brief scope of this knowledge set.', ...(allowParameterized ? { solvers: [AI_SOLVER_EXAMPLE] } : {}), questions: enabledTypes.map(type => examples[type]) }, null, 2)}
\`\`\`

Examples show structure only, not required types or facts. ${allowParameterized ? 'Include solvers only when a Parameterized question needs them. ' : ''}Title: 1–${MAX_NAME_LENGTH} characters; description, prompt, answer, explanation, and choices: at most ${MAX_TEXT} characters each; context: at most ${MAX_QUESTION_CONTEXT} characters. Escape newlines and backslashes inside JSON strings.
${enabledTypes.map(type => fields[type]).join('\n')}
All scored types may include optional context.`;
  return scope ? categoryScopedPrompt(prompt, scope, 'Review questions') : prompt;
}

export function parseReviewAiImport(text: string, preferences: ReviewAiPreferences): ReviewAiImport {
  const countProblem = questionCountProblem(preferences.count);
  if (countProblem) throw new Error(countProblem);
  const expected = preferences.mixMode === 'ai' ? null : allocateQuestions(preferences.weights, preferences.count);
  const value = parseAiImportJson(text);
  if (!isRecord(value) || Object.keys(value).some(key => !['format', 'version', 'title', 'description', 'questions', 'solvers'].includes(key)) ||
      value.format !== REVIEW_AI_FORMAT || value.version !== 1 || typeof value.title !== 'string' ||
      !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH ||
      typeof value.description !== 'string' || value.description.length > MAX_TEXT ||
      !Array.isArray(value.questions) || value.questions.length < 1 || value.questions.length > MAX_QUESTIONS) {
    throw new Error(`Paste a supported Review response with 1–${MAX_QUESTIONS} items, a title, and a description.`);
  }
  const warnings: string[] = [];
  if (value.questions.length !== preferences.count) warnings.push(`Requested ${preferences.count} items; this JSON contains ${value.questions.length}.`);
  const packages = parseAiSolvers(value.solvers);
  const entries: unknown[] = value.questions;
  const questions = entries.map((entry, index): Question => {
    if (!isRecord(entry) || !AI_QUESTION_TYPES.some(type => type === entry.type) ||
        typeof entry.prompt !== 'string' || !entry.prompt.trim() || entry.prompt.length > MAX_TEXT) {
      throw new Error(`Item ${index + 1} needs a supported type and a non-empty prompt.`);
    }
    const type = AI_QUESTION_TYPES.find(type => type === entry.type)!;
    const fields = type === 'parameterized' ? ['type', 'prompt', 'parameters', 'explanation'] : type === 'statement' ? ['type', 'prompt'] : type === 'dropdown' ? ['type', 'prompt', 'choices', 'matches', 'explanation'] : type === 'fill-in-the-blanks' ? ['type', 'prompt', 'explanation'] :
      type === 'multiple-choice' ? ['type', 'prompt', 'answer', 'correctAnswers', 'choices', 'choicePool', 'explanation'] : ['type', 'prompt', 'answer', 'explanation'];
    fields.push('context');
    if (Object.keys(entry).some(key => !fields.includes(key)) ||
        (Object.hasOwn(entry, 'context') && (typeof entry.context !== 'string' || entry.context.length > MAX_QUESTION_CONTEXT)) ||
        (Object.hasOwn(entry, 'explanation') && (typeof entry.explanation !== 'string' || entry.explanation.length > MAX_TEXT))) {
      throw new Error(`Item ${index + 1} contains unsupported fields or an invalid explanation.`);
    }
    const question = createQuestion(type);
    question.prompt = entry.prompt.trim();
    question.explanation = typeof entry.explanation === 'string' ? entry.explanation.trim() : '';
    if (typeof entry.context === 'string') question.context = entry.context.trim();
    if (type === 'parameterized') question.parameters = resolveAiParameters(entry.parameters, packages);
    if (type === 'multiple-choice' && Object.hasOwn(entry, 'correctAnswers')) {
      if (Object.hasOwn(entry, 'answer') || !Array.isArray(entry.correctAnswers) ||
          entry.correctAnswers.length < 1 || entry.correctAnswers.length > 8 ||
          entry.correctAnswers.some(answer => typeof answer !== 'string' || !answer.trim() || answer.length > MAX_TEXT)) {
        throw new Error(`Item ${index + 1} needs 1–8 valid correct choices, without a separate answer field.`);
      }
      question.correctAnswers = entry.correctAnswers.map((answer: string) => answer.trim());
    } else if (type !== 'parameterized' && type !== 'statement' && type !== 'fill-in-the-blanks' && type !== 'dropdown') {
      if (typeof entry.answer !== 'string' || !entry.answer.trim() || entry.answer.length > MAX_TEXT) throw new Error(`Item ${index + 1} needs a short correct answer.`);
      question.answer = entry.answer.trim();
    }
    if (type === 'multiple-choice' || type === 'dropdown') {
      const limit = type === 'dropdown' ? MAX_DROPDOWN_CHOICES : 8;
      if (!Array.isArray(entry.choices) || entry.choices.length < 2 || entry.choices.length > limit ||
          entry.choices.some(choice => typeof choice !== 'string' || !choice.trim() || choice.length > MAX_TEXT)) {
        throw new Error(`Item ${index + 1} needs 2–${limit} non-empty answer choices.`);
      }
      question.choices = entry.choices.map((choice: string) => choice.trim());
    }
    if (type === 'multiple-choice' && Object.hasOwn(entry, 'choicePool')) {
      const pool = entry.choicePool;
      if (!isRecord(pool) || Object.keys(pool).some(key => !['displayCount', 'distractors'].includes(key)) ||
          !Number.isInteger(pool.displayCount) || (pool.displayCount as number) < 2 ||
          (pool.displayCount as number) > 8 || !Array.isArray(pool.distractors) ||
          pool.distractors.length < 1 || pool.distractors.length > 100 ||
          pool.distractors.some(term => typeof term !== 'string' || !term.trim() || term.length > MAX_TEXT)) {
        throw new Error(`Item ${index + 1} needs a valid choicePool with displayCount 2–8 and 1–100 extra incorrect terms.`);
      }
      question.choicePool = {
        displayCount: pool.displayCount as number,
        distractors: pool.distractors.map((term: string) => term.trim()),
      };
    }
    if (type === 'dropdown') {
      validateDropdownMatches(entry.matches, MAX_TEXT);
      question.matches = entry.matches.map(row => ({ label: row.label.trim(), answer: row.answer.trim() }));
    }
    if (type === 'fill-in-the-blanks') {
      const template = parseFillBlankTemplate(question.prompt);
      if (!template.answers.length || /\{\{[^{}]*[\r\n][^{}]*\}\}/u.test(question.prompt) ||
          template.segments.some(segment => segment.type === 'text' && /[{}]/u.test(segment.text)) ||
          !template.segments.some(segment => segment.type === 'text' && /[\p{L}\p{N}]/u.test(segment.text))) {
        throw new Error(`Item ${index + 1} needs valid {{answer}} blanks with visible context.`);
      }
    }
    if (!questionReady(question)) throw new Error(`Item ${index + 1} is incomplete or its correct answer(s) do not match distinct choices.`);
    return question;
  });
  for (const pkg of packages) {
    if (!questions.some(question => question.parameters?.rules.solver?.package?.id === pkg.id && question.parameters.rules.solver.package.solverVersion === pkg.solverVersion)) warnings.push(`Solver “${pkg.label}” is unused and will not be imported.`);
  }
  validateQuestions(questions);
  if (expected !== null) {
    for (const type of AI_QUESTION_TYPES) {
      const actual = questions.filter(question => question.type === type).length;
      if (actual !== expected[type]) warnings.push(`${questionTypeLabel(type)}: requested ${expected[type]}, received ${actual}.${preferences.weights[type] === 0 && actual > 0 ? ' This type is disabled in the current mix.' : ''}`);
    }
  }
  return { title: value.title.trim(), description: value.description.trim(), questions, warnings };
}

/** Accept a complete AI knowledge-set response OR a bare question array.
 * The caller appends the validated questions without replacing the set metadata.
 */
export function parseReviewQuestionsImport(text: string, requestedCount: number): ReviewAiImport {
  const source = parseAiImportJson(text);
  const envelope = Array.isArray(source)
    ? { format: REVIEW_AI_FORMAT, version: 1, title: 'Additional questions', description: '', questions: source }
    : isRecord(source) && !Object.hasOwn(source, 'format') &&
      Object.keys(source).every(key => key === 'questions' || key === 'solvers')
      ? { ...source, format: REVIEW_AI_FORMAT, version: 1, title: 'Additional questions', description: '' }
      : source;
  return parseReviewAiImport(JSON.stringify(envelope), {
    count: requestedCount, mixMode: 'ai', coverage: 'balanced', weights: { ...DEFAULT_AI_WEIGHTS },
  });
}
