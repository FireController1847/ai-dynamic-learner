import { AI_PARAMETERIZED_EXAMPLE, AI_SOLVER_EXAMPLE, PARAMETERIZED_AI_GUIDANCE, parseAiSolvers, resolveAiParameters } from './ai-parameterized-format.ts';
import { parseAiImportJson } from '../../core/ai-json.ts';
import { categoryScopedPrompt, type AiCardScope } from '../../core/ai-study-categories.ts';
import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { isRecord } from '../../core/validation.ts';
import { AI_MARKDOWN_CONTEXT_GUIDANCE } from '../../core/ai-formatting-guidance.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import { createQuestion, MAX_TEXT, MAX_QUESTION_CONTEXT, questionProblem, questionReady, validateQuestions, MAX_QUESTIONS, type Question } from './question-model.ts';
import { MAX_DROPDOWN_CHOICES, MAX_DROPDOWN_ROWS, validateDropdownMatches } from './dropdown-model.ts';
import { AI_QUESTION_TYPES, DEFAULT_AI_WEIGHTS, allocateQuestions, questionCountProblem, questionTypeLabel, type QuestionWeights } from './ai-question-mix.ts';
import { reviewAiFocusPrompt, type ReviewAiFocus } from './ai-focus.ts';

export const REVIEW_AI_FORMAT = 'dynamic-learner-review';
export interface ReviewAiSubjectCoverage { subject: string; questionNumbers: number[] }
export interface ReviewAiConfidence {
  overallCoverage: number;
  examConfidence: number;
  subjectConfidence: number;
  studyConfidence: number;
  coverageExplanation: string;
  uncoveredSubjects: string[];
  confidenceExplanation: string;
}
export interface ReviewAiImport {
  title: string; description: string; questions: Question[]; warnings: string[];
  /** A transient AI audit; it does not change the persisted question schema. */
  coverage: ReviewAiSubjectCoverage[] | null;
  confidence: ReviewAiConfidence | null;
}
export type ReviewAiMixMode = 'custom' | 'ai';
export interface ReviewAiPreferences {
  count: number;
  mixMode: ReviewAiMixMode;
  /** Omission retains the original AI-selection prompt for other callers. */
  aiFocus?: ReviewAiFocus;
  weights: QuestionWeights;
  coverage: 'essentials' | 'balanced' | 'comprehensive';
}

export function reviewAiPrompt(preferences: ReviewAiPreferences, scope: AiCardScope | null): string {
  const countProblem = questionCountProblem(preferences.count);
  if (countProblem) throw new Error(countProblem);
  const aiChoosesMix = preferences.mixMode === 'ai';
  const focusPrompt = aiChoosesMix ? reviewAiFocusPrompt(preferences.aiFocus) : '';
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
Depth: ${preferences.coverage === 'essentials' ? 'Concise questions on every subject.' : preferences.coverage === 'comprehensive' ? 'Detailed questions on every subject.' : 'Balanced questions across every subject.'}
Generate EXACTLY ${preferences.count} questions when the source supports that many meaningful questions. Never exceed ${preferences.count}. Cover as many distinct source topics as possible within this count, combining closely related topics into meaningful scored questions where appropriate. If exhaustive coverage cannot fit, report the omissions in the confidence statistics; do not generate extra questions. Do not invent filler if the source is too limited.
${aiChoosesMix
    ? 'Choose question types and counts to suit the material; omit unsuitable types. Favor scored questions over arbitrary quotas or unscored filler.' + (focusPrompt ? `\nSelected focus (guidance, not a quota): ${focusPrompt}` : '')
    : `Use EXACTLY this mix:
${enabledTypes.map(type => `- ${questionTypeLabel(type)}: ${counts![type]} items`).join('\n')}`}
Use ONLY these types: ${enabledTypes.map(questionTypeLabel).join(', ')}. If fewer useful questions are possible, return fewer without filler. Respect the configured count even when it prevents full subject coverage; describe resulting gaps honestly in confidence.

SUBJECT COVERAGE AUDIT — complete BEFORE and AFTER writing questions while respecting the requested count:
- Inventory EVERY testable subject in the supplied material: all study-guide objectives, headings, subheadings, bullets, definitions, facts, figures, numerical values, formulas, associations, exceptions, comparisons, and examples. A study guide is a checklist; do not skip any item, even if it seems minor.
- For a selected category, inventory and test EVERY subject inside that category, not only its title/description or the most important points. For the overall subject, cover the entire supplied source. Questions may cover multiple subjects only if each one is genuinely tested.
- Ensure each inventoried subject is tested by at least one meaningful scored question. Do not output the internal subject-by-subject inventory.
- Cross-check the original source against the inventory again before returning JSON. Do not falsely claim full coverage. If a topic cannot fit within the requested number, list it under confidence.uncoveredSubjects and lower overallCoverage appropriately.

Choose the approach from the material (respect requested type counts where possible):
1. LOGIC / NUMBERS / PROCEDURES: Favor reusable Parameterized questions wherever inputs, calculations, rules, or algorithms can genuinely vary. Test the method with many valid solvable variants, not one fixed numerical result. Supply feasible ranges, constraints and complete solvers as needed. Never randomize fixed facts, diagnostic thresholds, or medical constants. If Parameterized is unavailable or unsuitable, use another enabled type.
2. RECALL / FIXED FACTS / MEDICAL / ASSOCIATIONS: Favor Multiple Choice, Fill in the Blanks, and matching Dropdowns. Test relationships directly (enzyme ↔ substrate, function ↔ term, symptom ↔ condition, threshold ↔ meaning). Reverse associations where useful; use plausible near-miss distractors to test distinctions, not obviously wrong options. Keep grading unambiguous.

Think like an instructor when CHOOSING what to test, not when wording the questions. Emphasize what the source repeats, compares, demonstrates, or expects learners to apply. Vary scenarios and difficulty without redundant questions or outside facts. Reject questions whose answer is given away by their wording, which test only the presence of a word in the prompt, or whose distractors are obviously nonsensical; each question should genuinely test knowledge or reasoning.
Write natural, standalone exam questions, contexts, and explanations. NEVER say "from the notes", "in class", "according to the lecture", "as discussed", "in the material", or similar references to lessons, instructors, sources, or studying. Ask directly about the concept; referencing a table or diagram actually included in the question's context is fine.

Use creative, relevant Markdown context: GFM tables, comparison charts, supplied-figure relationships, short text diagrams/flows (fenced text), and KaTeX math. Present data or labeled gaps for interpretation rather than answer keys. For table-based Fill in the Blanks, put labeled unknown cells in context but scored {{blanks}} ONLY in prompt. Use context where it helps; omit decorative or invented figures, unsupported image URLs, and raw HTML.

Type-specific rules:
${enabledTypes.map(type => quality[type]).join('\n')}
- Questions must be self-contained, source-grounded, distinct, and fairly graded. Never include citations, URLs, source markers, question IDs, or settings; parameter/solver identifiers are permitted. Brief explanations may clarify scored answers.

${AI_MARKDOWN_CONTEXT_GUIDANCE}

CONFIDENCE FORMAT CHECK:
Use a top-level "confidence" object with EXACTLY these fields: overallCoverage, examConfidence, subjectConfidence, studyConfidence, coverageExplanation, uncoveredSubjects, confidenceExplanation.
The four percentages MUST be whole JSON numbers from 0 to 100 (85, NOT "85%" or 0.85). The two explanations must be nonempty strings (maximum 500 characters). uncoveredSubjects must be an array of specific omitted-topic strings, or [] if no particular missing topic can be identified. For coverage below 100 with no identifiable missing topics, explain the uncertainty or inadequate depth in coverageExplanation; do not invent topics.
Verify this object and the entire JSON before responding.

Return ONLY one fenced JSON code block in this structure:
\`\`\`json
${JSON.stringify({ format: REVIEW_AI_FORMAT, version: 1, title: 'Short knowledge set title', description: 'Brief scope of this knowledge set.', ...(allowParameterized ? { solvers: [AI_SOLVER_EXAMPLE] } : {}), questions: enabledTypes.map(type => examples[type]), confidence: { overallCoverage: 85, examConfidence: 90, subjectConfidence: 86, studyConfidence: 90, coverageExplanation: 'Short explanation of coverage estimate.', uncoveredSubjects: ['Specific source topics not adequately tested'], confidenceExplanation: 'Short explanation of evidence and uncertainty.' } }, null, 2)}
\`\`\`

Examples show structure only, not required types or facts. ${allowParameterized ? 'Include solvers only when a Parameterized question needs them. ' : ''}Title: 1–${MAX_NAME_LENGTH} characters; description, prompt, answer, explanation, and choices: at most ${MAX_TEXT} characters each; context: at most ${MAX_QUESTION_CONTEXT} characters. Escape newlines and backslashes inside JSON strings.
${enabledTypes.map(type => fields[type]).join('\n')}
All scored types may include optional context. New AI-created sets REQUIRE a concise confidence object. Do NOT output a long subject checklist. All percentages are subjective estimates (integers 0–100), NOT verified probabilities. overallCoverage estimates the fraction of provided source/category assessed by the questions; examConfidence estimates likelihood these questions resemble exam content; subjectConfidence estimates relevance and accuracy to the chosen subject; studyConfidence estimates usefulness for learning AND exam preparation. Explain uncertainty, particularly if the supplied material is insufficient. If coverage is below 100, list identifiable gaps in uncoveredSubjects; when no distinct omitted topic can be identified, use [] and explain the uncertainty in coverageExplanation. Never report 100 unless all supplied material was assessed.`;
  return scope ? categoryScopedPrompt(prompt, scope, 'Review questions') : prompt;
}

export function parseReviewAiImport(text: string, preferences: ReviewAiPreferences, options: { requireCoverage?: boolean } = {}): ReviewAiImport {
  const countProblem = questionCountProblem(preferences.count);
  if (countProblem) throw new Error(countProblem);
  const expected = preferences.mixMode === 'ai' ? null : allocateQuestions(preferences.weights, preferences.count);
  const value = parseAiImportJson(text);
  if (!isRecord(value) || Object.keys(value).some(key => !['format', 'version', 'title', 'description', 'questions', 'solvers', 'coverage', 'confidence'].includes(key)) ||
      value.format !== REVIEW_AI_FORMAT || value.version !== 1 || typeof value.title !== 'string' ||
      !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH ||
      typeof value.description !== 'string' || value.description.length > MAX_TEXT ||
      !Array.isArray(value.questions) || value.questions.length < 1 || value.questions.length > MAX_QUESTIONS) {
    throw new Error(`Paste a supported Review response with 1–${MAX_QUESTIONS} items, a title, and a description.`);
  }
  const warnings: string[] = [];
  if (value.questions.length !== preferences.count) warnings.push(`Requested ${preferences.count} questions; the AI response contains ${value.questions.length}.`);
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
    if (!questionReady(question)) throw new Error(`Item ${index + 1}: ${questionProblem(question) || 'Question is incomplete.'}`);
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
  let coverage: ReviewAiSubjectCoverage[] | null = null;
  if (value.coverage !== undefined) {
    if (!Array.isArray(value.coverage) || !value.coverage.length || value.coverage.length > MAX_QUESTIONS) {
      throw new Error('Coverage must list 1–200 source subjects and their scored question numbers.');
    }
    const seen = new Set<string>();
    coverage = value.coverage.map((entry: unknown, index): ReviewAiSubjectCoverage => {
      if (!isRecord(entry) || Object.keys(entry).some(key => !['subject', 'questionNumbers'].includes(key)) ||
          typeof entry.subject !== 'string' || !entry.subject.trim() ||
          entry.subject.trim().length > MAX_NAME_LENGTH || !Array.isArray(entry.questionNumbers) ||
          !entry.questionNumbers.length || entry.questionNumbers.length > questions.length ||
          entry.questionNumbers.some(number => !Number.isInteger(number) || number < 1 || number > questions.length) ||
          new Set(entry.questionNumbers).size !== entry.questionNumbers.length ||
          entry.questionNumbers.some(number => questions[Number(number) - 1].type === 'statement')) {
        throw new Error('Coverage subject ' + (index + 1) + ' needs a valid name and scored question numbers starting at 1.');
      }
      const subject = entry.subject.trim(), normalized = subject.toLocaleLowerCase();
      if (seen.has(normalized)) throw new Error('Coverage subject ' + (index + 1) + ' repeats: ' + subject);
      seen.add(normalized);
      return { subject, questionNumbers: [...entry.questionNumbers] as number[] };
    });
  }
  let confidence: ReviewAiConfidence | null = null;
  if (value.confidence !== undefined) {
    const data = value.confidence;
    const percentageFields = ['overallCoverage', 'examConfidence', 'subjectConfidence', 'studyConfidence'] as const;
    if (!isRecord(data)) throw new Error('confidence must be a JSON object with four percentages, explanations and uncoveredSubjects.');
    for (const key of percentageFields) {
      if (!Number.isInteger(data[key]) || (data[key] as number) < 0 || (data[key] as number) > 100)
        throw new Error('confidence.' + key + ' must be a whole number from 0 to 100, not a percentage string or fraction.');
    }
    for (const key of ['coverageExplanation', 'confidenceExplanation'] as const) {
      if (typeof data[key] !== 'string' || !data[key].trim() || data[key].length > 500)
        throw new Error('confidence.' + key + ' must be a nonempty explanation of at most 500 characters.');
    }
    if (!Array.isArray(data.uncoveredSubjects) ||
        data.uncoveredSubjects.some(item => typeof item !== 'string' || !item.trim() || item.length > 160))
      throw new Error('confidence.uncoveredSubjects must be an array of short strings, or [] if no specific topic was missed.');

    if (!isRecord(data) || Object.keys(data).some(key => ![...percentageFields, 'coverageExplanation', 'uncoveredSubjects', 'confidenceExplanation'].includes(key)) ||
        percentageFields.some(key => !Number.isInteger(data[key]) || (data[key] as number) < 0 || (data[key] as number) > 100) ||
        typeof data.coverageExplanation !== 'string' || !data.coverageExplanation.trim() || data.coverageExplanation.length > 500 ||
        typeof data.confidenceExplanation !== 'string' || !data.confidenceExplanation.trim() || data.confidenceExplanation.length > 500 ||
        !Array.isArray(data.uncoveredSubjects) || data.uncoveredSubjects.some(item => typeof item !== 'string' || !item.trim() || item.length > 160)) {
      throw new Error('Confidence needs four whole-number percentages (0–100), two brief explanations, and an uncoveredSubjects array ([] is allowed if no specific omission can be named).');
    }
    confidence = { overallCoverage: data.overallCoverage as number, examConfidence: data.examConfidence as number,
      subjectConfidence: data.subjectConfidence as number, studyConfidence: data.studyConfidence as number,
      coverageExplanation: data.coverageExplanation.trim(), uncoveredSubjects: [...data.uncoveredSubjects] as string[],
      confidenceExplanation: data.confidenceExplanation.trim() };
  } else if (options.requireCoverage) {
    throw new Error('The AI omitted the required confidence statistics. Ask for complete JSON with confidence percentages and explanations.');
  }
  return { title: value.title.trim(), description: value.description.trim(), questions, warnings, coverage, confidence };
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
