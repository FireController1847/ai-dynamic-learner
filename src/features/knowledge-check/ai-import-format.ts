import { AI_PARAMETERIZED_EXAMPLE, AI_SOLVER_EXAMPLE, PARAMETERIZED_AI_GUIDANCE, parseAiSolvers, resolveAiParameters } from './ai-parameterized-format.ts';
import { parseAiImportJson } from '../../core/ai-json.ts';
import { categoryScopedPrompt, type AiCardScope } from '../../core/ai-study-categories.ts';
import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { isRecord } from '../../core/validation.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import { createQuestion, MAX_TEXT, MAX_QUESTION_CONTEXT, questionReady, validateQuestions, MAX_QUESTIONS, type Question } from './question-model.ts';
import { MAX_DROPDOWN_CHOICES, MAX_DROPDOWN_ROWS, validateDropdownMatches } from './dropdown-model.ts';
import { AI_QUESTION_TYPES, allocateQuestions, questionCountProblem, questionTypeLabel, type QuestionWeights } from './ai-question-mix.ts';

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
    'multiple-choice': { type: 'multiple-choice', prompt: 'Which symbol represents gold?', choices: ['Au', 'Ag', 'Fe', 'Cu'], answer: 'Au', explanation: 'Au represents gold.' },
    'true-false': { type: 'true-false', prompt: 'The chemical symbol for gold is Au.', answer: 'True' },
    'fill-in-the-blanks': { type: 'fill-in-the-blanks', prompt: 'The chemical symbol for gold is {{Au}}.' },
    'short-answer': { type: 'short-answer', prompt: 'What is the chemical symbol for gold?', answer: 'Au' },
    dropdown: { type: 'dropdown', prompt: 'Match each element to its symbol.', choices: ['Au', 'Ag', 'Fe'],
      matches: [{ label: 'Gold', answer: 'Au' }, { label: 'Silver', answer: 'Ag' }] },
    parameterized: AI_PARAMETERIZED_EXAMPLE,
    statement: { type: 'statement', prompt: 'Gold has the chemical symbol Au.' },
  };
  const quality: Record<keyof QuestionWeights, string> = {
    'multiple-choice': `- Multiple choice: normally four distinct, plausible choices and one correct answer in answer. When the source clearly supports a select-all question, optionally use correctAnswers (an array of correct choice texts) instead of answer; all and only those choices must be selected. Avoid giveaway wording, arbitrary tricks, "all of the above", and always putting the correct answer first. Mix answer positions.`,
    'true-false': `- True/false: one clear factual claim, with answer exactly "True" or "False". Include both outcomes when useful, without ambiguous qualifiers or trick statements.`,
    'fill-in-the-blanks': `- Fill in the blanks: {{answer}} markers inside concise, contextual statements. Almost always one word per blank; 2–3 only for an indivisible term. For separate items use {{letters}} and {{numbers}} or {{letters}} or {{numbers}}, preserving the source meaning. Keep meaningful context visible; several related blanks are welcome. Keep terminology and blank boundaries consistent throughout, never alternating a full term like "nullword" with "null" for the same concept. Keep {{answer}} markers only in "prompt"; optional Markdown context is background material and must not replace the blank-aware prompt.`,
    'short-answer': `- Short answer: a specific quick-recall question with an answer of 1–5 words, not an essay or a list.`,
    'dropdown': `- Dropdown: one matching question with a shared list of 2–${MAX_DROPDOWN_CHOICES} distinct choices and 1–${MAX_DROPDOWN_ROWS} labeled rows in "matches". Each row has "label" and "answer"; its answer must exactly match one choice. Keep rows related and labels distinct. Choices may be reused when factually appropriate. The entire matching question counts as one item in the requested mix.`,
    'statement': `- Statement: a concise authored fact or transition with no answer, choices, or explanation; it is not scored.`,
    parameterized: PARAMETERIZED_AI_GUIDANCE,
  };
  const fields: Record<keyof QuestionWeights, string> = {
    'multiple-choice': 'By default, use type/prompt/choices/answer/optional explanation. To make a multi-select question, replace answer with a correctAnswers array listing all correct choice texts; do not include both fields.',
    'true-false': 'Use type/prompt/answer/optional explanation on true/false; omit choices.',
    'short-answer': 'Use type/prompt/answer/optional explanation on short answer; omit choices.',
    'dropdown': 'On Dropdown use type/prompt/choices/matches/optional explanation, with correct answers inside the matching rows and no top-level answer.',
    'fill-in-the-blanks': 'On fill in the blanks use type/prompt/optional explanation, with answers embedded in {{markers}}.',
    'statement': 'On statements use only type/prompt.',
    'parameterized': 'On parameterized questions use type/prompt/parameters/optional explanation, and place referenced JavaScript solver packages in the optional top-level solvers array.',
  };
  const prompt = `Using the original source material supplied earlier in this conversation, construct a Dynamic Learner Review knowledge set.

Scope: ${scope ? 'Only the selected category described above.' : 'The overall subject: distribute useful questions across its major topics.'}
Coverage: ${preferences.coverage === 'essentials' ? 'Core concepts only.' : preferences.coverage === 'comprehensive' ? 'Broad useful coverage, without trivia or repetition.' : 'Major ideas and useful supporting facts.'}

Create EXACTLY ${preferences.count} items.
${aiChoosesMix
    ? `Choose the question types and their counts yourself based on what best tests understanding of the source. You may use any mix of the supported types listed below, including omitting types that do not suit this content. Do not impose fixed percentages, quotas, or an equal split. Prefer a varied, purposeful mix of useful scored questions; use unscored Statements only when they genuinely help with context or instructions. For numerical or procedural material, prefer valid Parameterized questions whenever they can meaningfully generate solvable numeric variants rather than asking for one fixed numerical answer. Use the other question types only when a valid reusable generator would not make sense or cannot be specified reliably. Make each question type earn its place.`
    : `Use this exact question mix (counts already account for rounding):
${enabledTypes.map(type => `- ${questionTypeLabel(type)}: ${preferences.weights[type]}% preference → ${counts![type]} items`).join('\n')}`}
Use only these supported question types: ${enabledTypes.map(questionTypeLabel).join(', ')}. Do not substitute another type. If the source cannot support this many useful items, ask me to reduce the count instead of inventing facts.

Question quality:
${aiChoosesMix ? `IMPORTANT — question-type priorities for this AI-selected mix (apply throughout, not just once):
- NUMBERS FIRST → PARAMETERIZED: Whenever a question involves numbers, quantities, calculations, formulas, measurements, numerical comparisons, or multi-step procedures, ALWAYS first try to express it as a Parameterized (procedurally generated) question. STRONGLY prefer Parameterized over fixed numeric Multiple Choice, Fill in the Blanks, or Short Answer wherever a valid parameterized generator is possible. Make the numbers vary across generated instances while preserving the taught method and verifiable answer. Supply complete, valid parameter rules and solver definitions where needed. Do not invent unsupported formulas, quantities, or source facts; for inherently fixed numerical facts that cannot sensibly vary, use an appropriate non-generated type.
- FILL IN THE BLANKS: Prefer exactly ONE word, digit string, or indivisible technical term per blank. Avoid multi-word expected responses whenever possible because matching them is unreliable; rewrite the sentence to isolate a single meaningful term, or choose a better question type. Use a multi-word blank only when the source requires one indivisible phrase and no better type works.
- SHORT ANSWER LAST: Avoid Short Answer unless necessary for a uniquely identifiable, concise response that cannot be assessed more reliably with another supported question type. Ambiguous or subjective phrasing is not suitable for automatic answer checking. Prefer Parameterized for numerical answers and other structured types for text answers.
- MULTIPLE CHOICE VARIETY: When choosing Multiple Choice, intentionally mix single-answer questions (one \`answer\` string, radio buttons) and multi-answer questions (a \`correctAnswers\` array, checkboxes). Use multi-answer only when multiple choices are genuinely correct and all can be established unambiguously from the source; do not force a fake second correct answer. Use a meaningful variety across multiple MC questions, not an obligatory 50/50 split.
` : ''}${enabledTypes.map(type => quality[type]).join('\n')}
- Make every item self-contained, accurate, and based on the source. Avoid duplicates and unsupported facts. Do not include citations, URLs, source markers, question/library IDs, or session settings.${allowParameterized ? ' Required solver IDs and parameter-generation rules are allowed only for parameterized questions.' : ''}
${enabledTypes.some(type => type !== 'statement') ? '- An optional explanation may give one short clarifying sentence for a scored question.\n' : ''}- Keep "prompt" as the concise main question/title in plain text. When useful, add an optional "context" string with GitHub-flavored Markdown: passages, tables, lists, task lists, links, strikethrough, or fenced code. This is supporting material shown separately from the title, not an answer key or feedback. Omit filler context. Do not use raw HTML.
- Keep response text as plain text.

Vary the presentation across the knowledge set:
- Intentionally mix concise standalone questions with questions that use meaningful Markdown context. For medium or large sets, include several context-based questions when the material supports them; do not make every question the same simple recall format. This is a flexible writing goal, not another percentage quota.
- Use small GFM tables for comparisons, classifications, timelines, or data interpretation; brief passages or scenarios for application questions; lists for processes or related facts; and fenced code blocks for code-reading questions when relevant to the subject.
- Make the context useful to answering the question: ask the learner to interpret, compare, infer, or apply something in it. Do not add a decorative table or simply repeat the question beneath its title.
- Base all context on the source's information and concepts. Do not invent unsupported factual claims or include a labeled answer key. Keep context compact, preserve the ${aiChoosesMix ? 'AI-selected, content-appropriate question-type mix' : 'requested question-type mix'}, and leave some questions without context. If the source does not benefit from added context, prioritize clarity over forcing variety.

Return ONLY one JSON code block using this structure:
\`\`\`json
${JSON.stringify({ format: REVIEW_AI_FORMAT, version: 1, title: 'Short knowledge set title', description: 'Brief scope of this knowledge set.', ...(allowParameterized ? { solvers: [AI_SOLVER_EXAMPLE] } : {}), questions: enabledTypes.map(type => examples[type]) }, null, 2)}
\`\`\`

These are format examples only, not required proportions or a requirement to use every type. ${allowParameterized ? 'Omit solvers unless an included Parameterized question actually needs uploaded JavaScript solver packages. ' : ''}Use the ${aiChoosesMix ? 'AI-selected distribution and' : 'requested counts and'} source content, not these example facts. Title: 1–${MAX_NAME_LENGTH} characters. Description: at most ${MAX_TEXT} characters. Prompt, answer, explanation, and each choice: at most ${MAX_TEXT} characters of plain text. Optional context: at most ${MAX_QUESTION_CONTEXT} characters of Markdown, encoded as a JSON string (escape newlines inside strings).
${enabledTypes.map(type => fields[type]).join('\n')}
Any of these types may also include the optional context field.`;
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
      type === 'multiple-choice' ? ['type', 'prompt', 'answer', 'correctAnswers', 'choices', 'explanation'] : ['type', 'prompt', 'answer', 'explanation'];
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
