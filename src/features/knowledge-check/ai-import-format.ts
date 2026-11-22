import { AI_PARAMETERIZED_EXAMPLE, AI_SOLVER_EXAMPLE, PARAMETERIZED_AI_GUIDANCE, parseAiSolvers, resolveAiParameters } from './ai-parameterized-format.ts';
import { parseAiImportJson } from '../../core/ai-json.ts';
import type { AiPromptVariant } from '../../core/ai-prompt-variants.ts';
import { AI_BOUNDED_INFERENCE_PROMPT } from '../../core/ai-source-inference.ts';
import { AI_SOURCE_DIFFICULTY_PROMPT } from '../../core/ai-source-difficulty.ts';
import { AI_SOURCE_UNITS_PROMPT, parseAiSourceUnits, type AiSourceUnit } from '../../core/ai-source-units.ts';
import { parseAiConfidenceValues, MAX_AI_CONFIDENCE_TOPIC_LENGTH } from '../../core/ai-confidence-repair.ts';
import { assertAiTarget } from '../../core/ai-app-identity.ts';
import { categoryScopedPrompt, type AiCardScope } from '../../core/ai-study-categories.ts';
import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { isRecord } from '../../core/validation.ts';
import { AI_MARKDOWN_CONTEXT_GUIDANCE } from '../../core/ai-formatting-guidance.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import { createQuestion, MAX_TEXT, MAX_QUESTION_CONTEXT, questionProblem, questionReady, validateQuestions, type Question } from './question-model.ts';
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
  sourceUnits?: AiSourceUnit[];
  confidence: ReviewAiConfidence | null;
}
export type ReviewAiMixMode = 'custom' | 'ai';
export interface ReviewAiPreferences {
  count: number;
  mixMode: ReviewAiMixMode;
  /** Omission retains the original AI-selection prompt for other callers. */
  aiFocus?: ReviewAiFocus;
  weights: QuestionWeights;
  coverage: 'exam-prep' | 'essentials' | 'balanced';
}

/**
 * FROZEN PROMPT CONTRACT — USER-APPROVED (October 2026).
 *
 * The Review AI generation prompt has been carefully tuned for source fidelity,
 * question clarity, helpful non-spoiling explanations, question-count limits,
 * coverage estimates, and file-based JSON output. Its wording is intentionally
 * stable and fragile: DO NOT rewrite, simplify, reformat, consolidate, or
 * "improve" the generated prompt as part of unrelated refactors, cleanup,
 * UX changes, or shared-prompt migrations.
 *
 * Modify its instructions ONLY when the user EXPLICITLY requests a change to
 * the Review AI prompt itself. Preserve all other prompt constraints and verify
 * the resulting generated text and schema when such a change is authorized.
 * Changes to surrounding application code do not authorize prompt edits.
 */
export function reviewAiPrompt(preferences: ReviewAiPreferences, scope: AiCardScope | null,
  variant: AiPromptVariant = 'detailed'): string {
  const countProblem = questionCountProblem(preferences.count);
  if (countProblem) throw new Error(countProblem);
  const examPrep = preferences.coverage === 'exam-prep';
  const essentials = preferences.coverage === 'essentials';
  const aiChoosesMix = preferences.mixMode === 'ai';
  const focusPrompt = aiChoosesMix ? reviewAiFocusPrompt(preferences.aiFocus) : '';
  const counts = aiChoosesMix ? null : allocateQuestions(preferences.weights, preferences.count);
  const enabledTypes = AI_QUESTION_TYPES.filter(type => counts === null || counts[type] > 0);
  const allowParameterized = counts === null || counts.parameterized > 0;
  // An AI-selected mix should demonstrate the simplest valid parameterization.
  // Explicitly requested parameterized questions retain the full solver example.
  const expressionParameterizedExample = {
    type: 'parameterized', prompt: 'What is {{a}} + {{b}}?',
    parameters: { presentation: 'fields', rules: { version: 1,
      variables: [{ name: 'a', kind: 'integer', min: 1, max: 10 },
        { name: 'b', kind: 'integer', min: 1, max: 10 }],
      constraints: [],
      answers: [{ key: 'result', label: 'Your answer', expression: 'a + b', matching: 'numeric' }],
    } },
  };
  const examples: Record<keyof QuestionWeights, object> = {
    'multiple-choice': { type: 'multiple-choice', prompt: 'Which symbol represents gold?', choices: ['Au', 'Ag', 'Fe', 'Cu'],
      answer: 'Au', choicePool: { displayCount: 4, distractors: ['Pt', 'Sn', 'Pb', 'Zn'] },
      explanation: 'Think about the historical naming convention used for elemental symbols rather than relying on the English name.' },
    'true-false': { type: 'true-false', prompt: 'The chemical symbol for gold is Au.', answer: 'True' },
    'fill-in-the-blanks': { type: 'fill-in-the-blanks', prompt: 'Use the table: A = {{amylase}} and B = {{pepsin}}.', context: '| Substrate | Enzyme label |\n| --- | --- |\n| Starch | A |\n| Protein | B |' },
    'short-answer': { type: 'short-answer', prompt: 'What is the chemical symbol for gold?', answer: 'Au' },
    dropdown: { type: 'dropdown', prompt: 'Match each element to its symbol.', choices: ['Au', 'Ag', 'Fe'],
      matches: [{ label: 'Gold', answer: 'Au' }, { label: 'Silver', answer: 'Ag' }] },
    parameterized: aiChoosesMix ? expressionParameterizedExample : AI_PARAMETERIZED_EXAMPLE,
    statement: { type: 'statement', prompt: 'Gold has the chemical symbol Au.' },
  };
  const quality: Record<keyof QuestionWeights, string> = {
    'multiple-choice': '- Multiple Choice: typically four distinct, plausible choices, using closely related alternatives from the same topic. Use answer for one correct choice or correctAnswers for genuinely multiple correct choices, never both. When many plausible incorrect terms exist, prefer a reusable choicePool (displayCount 2–8 and 1–100 additional distinct incorrect terms) rather than duplicate copies of one question. Correct answers always appear, while the incorrect slots are sampled from the base choices and additional pool. Avoid giveaway distractors.',
    'true-false': '- True/False: a clear, unambiguous claim with answer exactly "True" or "False".',
    'fill-in-the-blanks': '- Fill in the Blanks: {{answer}} markers belong ONLY in the plain-text prompt. Prefer a single word, number, or indivisible term per blank. For association tables/diagrams in Markdown context, label missing cells A/B/1/2 and ask A = {{term}}, B = {{term}} in the prompt. Multiple related blanks are encouraged; never reveal the answer in context.',
    'short-answer': '- Short Answer: only short, uniquely checkable responses (usually 1–5 words) that cannot be assessed more reliably with another type.',
    dropdown: `- Dropdown: directly test matching relationships, with 1–${MAX_DROPDOWN_ROWS} labeled rows (label/answer) and 2–${MAX_DROPDOWN_CHOICES} distinct shared choices. Every answer must appear in choices; use plausible neighbors. Aim for 3–5 matches per matching question; split larger groups when practical. A matching table counts as one item.`,
    'statement': '- Statement: unscored directions/context only; do not substitute it for meaningful scored questions.',
    parameterized: '- Parameterized: favor genuinely variable, source-supported calculations or procedures and verify every variant is fair and solvable. Choose expressions for simple methods and bounded solvers for algorithms when justified.',
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
  const detailedReasoning = `Using the original source material supplied earlier in this conversation, create a Dynamic Learner Review knowledge set as a teacher or instructor would assess it.

Scope: ${scope ? 'Only the selected category described above.' : examPrep ? 'The overall subject, restricted to strongly evidenced exam content.' : 'The overall subject, covering its important topics.'}
Coverage: ${examPrep ? 'EXAM PREP ONLY — EXPLICITLY focus on material you are almost CERTAIN WILL be on the exam, based on the supplied evidence. IGNORE material that does not lead to likely exam questions. FOCUS HEAVILY on topics, question formats, calculations, and skills the sources indicate WILL be tested. This is NOT a comprehensive review of the source.' : essentials ? 'ESSENTIALS ONLY — focus on core concepts, key facts, and indispensable skills across the subject. Omit minor details, trivia, and nonessential examples.' : 'BALANCED — cover major topics and useful supporting details across the subject, balancing breadth and depth.'}
Generate EXACTLY ${preferences.count} questions when the source supports that many meaningful questions. Never exceed ${preferences.count}. ${examPrep ? 'Prioritize strength of exam evidence over breadth or quotas. Create varied meaningful questions on strongly evidenced exam topics; return fewer if the evidence does not support the count. NEVER pad the set with merely possible exam content. Recommend increasing the count ONLY when additional strongly evidenced exam questions remain untested.' : essentials ? 'Cover essential topics within this count, combining closely related concepts where appropriate. Report omitted essentials in confidence. Recommend increasing the count only when it would improve essential coverage.' : 'Cover as many distinct source topics as possible within this count, combining closely related topics into meaningful scored questions where appropriate. If exhaustive coverage cannot fit, report the omissions in the confidence statistics; do not generate extra questions. When the requested count is materially limiting coverage or study usefulness, explicitly recommend asking Dynamic Learner for an increased question count in coverageExplanation or confidenceExplanation, and state why more questions would help.'} Never imply that increasing the count guarantees exam success. Do not invent filler if the source is too limited.
${aiChoosesMix
    ? 'Choose question types and counts to suit the material; omit unsuitable types. Favor scored questions over arbitrary quotas or unscored filler.' + (focusPrompt ? `\nSelected focus (guidance, not a quota): ${focusPrompt}` : '')
    : `Use EXACTLY this mix${examPrep ? ' when supported by strong exam evidence; never invent or broaden exam content merely to satisfy a type quota' : ''}:
${enabledTypes.map(type => `- ${questionTypeLabel(type)}: ${counts![type]} items`).join('\n')}`}
Use ONLY these types: ${enabledTypes.map(questionTypeLabel).join(', ')}. If fewer useful questions are possible, return fewer without filler. Respect the configured count; ${examPrep ? 'describe missing strongly evidenced exam topics honestly, without treating intentionally excluded non-exam material as a failure.' : 'describe resulting gaps honestly in confidence.'}

${examPrep ? `EXAM EVIDENCE AUDIT — complete BEFORE and AFTER writing questions:
- Examine ALL supplied sources for EXPLICIT exam evidence: instructor statements about what WILL be tested, exam study guides and objectives, exam blueprints, practice exams, previous exams, and directly relevant quiz or assignment questions. Prioritize explicit upcoming-exam guidance over historical or indirect clues. Do not treat every slide, heading, quiz, textbook fact, or example as proof of exam inclusion.
- Distinguish nearly CERTAIN exam topics from merely plausible or unsupported topics. FOCUS HEAVILY on the former, including their demonstrated question styles, procedures, and difficulty. IGNORE the latter even if important to the subject in general. An explicitly exam-focused study guide is strong evidence; ordinary study notes are not an exam checklist.
- Build scored questions ONLY on content with strong source evidence of exam relevance. Revisit high-priority skills with distinct, source-supported variants where useful. Do not expand into lower-confidence material to balance topics, satisfy a quota, or inflate overall coverage.
- Recheck EVERY question against the exam evidence. Remove any item you cannot justify as highly likely to be tested. If exam evidence is weak or missing, do not claim certainty, invent an exam blueprint, or silently fall back to a general review. Return fewer supported questions or, if none qualify, explain that explicit exam guidance is needed rather than fabricate a set.
- Do not output the internal audit. Report omitted high-priority exam topics, evidence limitations, and deliberate exclusion of non-exam material honestly in confidence. Do not claim access to or certainty about an unreleased exam.` : essentials ? `ESSENTIAL COVERAGE AUDIT — complete BEFORE and AFTER writing questions:
- Identify core concepts, definitions, relationships, formulas, and skills necessary to understand the subject or selected category. Prioritize essential material over minor facts, isolated details, and repetition.
- Ensure essential topics are meaningfully tested within the requested count; omit nonessential material rather than treating every source bullet as a required question.
- Cross-check the source again before returning JSON. Do not output the internal inventory or falsely claim full source coverage. Identify omitted essentials and explain intentional exclusions in confidence.` : `SUBJECT COVERAGE AUDIT — complete BEFORE and AFTER writing questions while respecting the requested count:
- Inventory the testable subjects in the supplied material: all study-guide objectives, headings, subheadings, bullets, definitions, facts, figures, numerical values, formulas, associations, exceptions, comparisons, and examples. Use study-guide items to plan coverage; distinguish central objectives from supporting details rather than assuming every bullet requires a separate question.
- For a selected category, inventory and test EVERY subject inside that category, not only its title/description or the most important points. For the overall subject, cover the entire supplied source. Questions may cover multiple subjects only if each one is genuinely tested.
- Maximize meaningful coverage within the requested count, prioritizing core ideas, relationships and skills. Do not compress unrelated details into enormous matching questions just to check off every topic. Report untested content in confidence; do not output the internal inventory.
- Cross-check the original source against the inventory again before returning JSON. Do not falsely claim full coverage. If a topic cannot fit within the requested number, list it under confidence.uncoveredSubjects and lower overallCoverage appropriately.`}

Choose the approach from the material (respect requested type counts where possible):
1. LOGIC / NUMBERS / PROCEDURES: Favor reusable Parameterized questions wherever inputs, calculations, rules, or algorithms can genuinely vary. Test the method with many valid solvable variants, not one fixed numerical result. Supply feasible ranges, constraints and complete solvers as needed. Never randomize fixed facts, diagnostic thresholds, or medical constants. If Parameterized is unavailable or unsuitable, use another enabled type.
2. RECALL / FIXED FACTS / MEDICAL / ASSOCIATIONS: Favor Multiple Choice, Fill in the Blanks, and matching Dropdowns. Test relationships directly (enzyme ↔ substrate, function ↔ term, symptom ↔ condition, threshold ↔ meaning). Reverse associations where useful; use plausible near-miss distractors to test distinctions, not obviously wrong options. Keep grading unambiguous.

- ASSESSMENT DESIGN: When the mix is AI-selected, choose formats deliberately. Do not let multiple-choice or matching dominate by habit. Use scenarios for application, short answer and blanks for recall, matching for tightly related concepts, and Parameterized for reusable methods. A matching table counts as ONE question but its rows are separate answer interactions: keep tables focused (usually 3–5 rows) and avoid excessive workload. When the user chooses a custom mix, follow it instead of overriding it for variety.

Think like an instructor when CHOOSING what to test, not when wording the questions. ${examPrep ? 'Emphasize what the supplied exam evidence explicitly indicates WILL be tested; repetition or importance alone does not establish exam relevance.' : 'Emphasize what the source repeats, compares, demonstrates, or expects learners to apply.'} Vary scenarios and difficulty without redundant questions or outside facts. Reject questions whose answer is given away by their wording, which test only the presence of a word in the prompt, or whose distractors are obviously nonsensical; each question should genuinely test knowledge or reasoning.
STRICT SOURCE FIDELITY — NON-NEGOTIABLE:
${AI_BOUNDED_INFERENCE_PROMPT}
${AI_SOURCE_DIFFICULTY_PROMPT}
- Use ONLY the study material supplied in this AI conversation and the explicitly selected category. Treat it as a closed knowledge source. Do not add facts from general knowledge, training data, web searches, common practice, or assumptions about what instructors normally teach.
- Reasonable, well-supported inference is allowed to clarify an incomplete idea using adjacent source facts and relationships. Do not invent missing details, methods, examples, or claims that the supplied concepts cannot justify.
- Test definitions, facts, comparisons, methods, and relationships present or defensibly implied by the source. Make clear when a conclusion is inferred rather than directly quoted; do not assert uncertainty as fact.
- For numerical questions, use ONLY formulas, input ranges, procedures, and values supplied by the source. Do not invent sample numbers or construct unseen scenarios to make a parameterized question possible. Use parameterization only when the supplied material explicitly supports varying the inputs.
- Apply this rule to EVERY field, including question stems, correct answers, incorrect choices/distractors, answer explanations, contexts, confidence claims, and any generated scenarios. Distractors may be incorrect alternatives only when they are grounded in source-present terms or directly test source-stated distinctions; never introduce unrelated facts as distractors.
- If the source is incomplete, ambiguous, or silent about a topic, DO NOT fill the gap with outside knowledge. Omit the unsupported question and honestly identify the limitation in confidence.coverageExplanation or confidence.uncoveredSubjects. Prefer fewer questions and lower confidence over fabricated coverage.
- Before returning the file, internally verify EVERY question and answer against the original supplied content. Rewrite or remove any item that cannot be directly substantiated. Do not output an invented source citation.

QUESTION CLARITY IS MANDATORY:
- Write in simple, direct, age-appropriate language without sacrificing scientific or technical accuracy. Favor one clear task per question, short sentences, familiar phrasing, and precise terms that learners actually need to know.
- The challenge must come from recalling, understanding, calculating, or applying the subject, NEVER from deciphering deliberately confusing wording. No trick questions, riddles, unnecessary negatives or double negatives, misleading qualifiers, irrelevant details, ambiguous references, or convoluted scenarios.
- Use necessary technical terms and define unfamiliar non-tested terminology in the question when needed. Do not hide the knowledge being tested behind obscure vocabulary or unnecessarily complicated grammar.
- Make answer options concise, grammatically parallel, plausible, distinct, and easy to compare. Distractors should test a real misconception, not exploit reading mistakes or fine-print traps.
- Before finalizing, read every question as a learner unfamiliar with the answer: can they understand exactly what is being asked on the first read? If not, rewrite it. Keep conceptual rigor and meaningful differences without creating confusion.
- Avoid gratuitous complexity in parameterized problems, dropdowns, fill-in-the-blanks, and answer explanations as well. Clarity applies to ALL question types.

EXPLANATION RULES (important): The explanation is a supportive learning hint for someone who may have answered incorrectly. NEVER state, quote, paraphrase, restate, or unmistakably reveal the correct answer in the explanation, including a correct choice, True/False result, filled blank, matching answer, calculated result, or parameterized solution. Instead, give a concise conceptual cue, reasoning strategy, relevant distinction, or next step that helps the learner understand HOW to think about the question and try again. Avoid answer-leaking synonyms and direct elimination hints. Use calm, kind, nonjudgmental wording; do not shame, scold, condescend, blame, or say "obviously" or "you should have known." When no useful non-revealing hint is possible, OMIT explanation rather than writing a disguised answer. Treat the answer field as the only source of the solution.

Write natural, standalone exam questions, contexts, and explanations. NEVER say "from the notes", "in class", "according to the lecture", "as discussed", "in the material", or similar references to lessons, instructors, sources, or studying. Ask directly about the concept; referencing a table or diagram actually included in the question's context is fine.

Use creative, relevant Markdown context: GFM tables, comparison charts, supplied-figure relationships, short text diagrams/flows (fenced text), and KaTeX math. Present data or labeled gaps for interpretation rather than answer keys. For table-based Fill in the Blanks, put labeled unknown cells in context but scored {{blanks}} ONLY in prompt. Use context where it helps; omit decorative or invented figures, unsupported image URLs, and raw HTML.

Type-specific rules:
${enabledTypes.map(type => quality[type]).join('\n')}
- Questions must be self-contained, source-grounded, distinct, and fairly graded. Never include citations, URLs, source markers, question IDs, or settings; parameter/solver identifiers are permitted. Brief explanations may guide the learner toward understanding, but must never disclose the answer.

${AI_MARKDOWN_CONTEXT_GUIDANCE}

All scored types may include optional context. New AI-created sets REQUIRE a concise confidence object. Do NOT output a long subject checklist. All percentages are subjective estimates (integers 0–100), NOT verified probabilities. Calibrate confidently rather than conservatively: when the source is sufficiently detailed, the questions accurately address it, and there are no identifiable shortcomings, lean toward HIGH justified estimates instead of automatically discounting confidence for generic uncertainty. Do not invent weaknesses or reduce scores solely because an exam blueprint is unavailable. However, never inflate scores to hide real omissions, poor question quality, unsupported exam predictions, or thin source materials; describe actual limitations. overallCoverage estimates the fraction of provided source/category assessed by the questions; examConfidence estimates likelihood these questions resemble exam content; subjectConfidence estimates relevance and accuracy to the chosen subject; studyConfidence estimates usefulness for learning AND exam preparation. Explain uncertainty, particularly if the supplied material is insufficient. ${examPrep ? 'Keep overallCoverage honest against the entire supplied source/category; it may be low by design. Explain intentional exclusion of material without strong exam evidence in coverageExplanation. List omitted HIGH-PRIORITY exam topics in uncoveredSubjects, not every deliberately excluded non-exam topic. If examConfidence, subjectConfidence, or studyConfidence is below 80, explain improvements within EXAM PREP ONLY; request clearer exam evidence if needed. Never recommend adding non-exam questions just to raise overallCoverage. Recommend a larger count only for additional strongly evidenced exam material. Lower examConfidence honestly when evidence is insufficient.' : essentials ? 'Keep overallCoverage honest against the entire supplied source/category; it may be low by design. Explain intentional exclusions in coverageExplanation and list omitted essential topics in uncoveredSubjects. Explain improvements within ESSENTIALS ONLY for low confidence scores; do not add nonessential material just to raise overallCoverage. Recommend a larger count only when essential coverage would improve.' : 'If ANY of the four estimates is below 80, explain actionable ways to improve it. Recommend increasing the question count when the limit meaningfully restricts coverage, identifying topics that would benefit; do not exceed the count in this response. Distinguish this from low confidence caused by insufficient source materials, where more questions alone will not solve the problem. If coverage is below 100, list identifiable gaps in uncoveredSubjects; when no distinct omitted topic can be identified, use [] and explain the uncertainty in coverageExplanation.'} Never report 100 unless all supplied material was assessed.`;

  const simpleReasoning = `Using only the supplied study material, create a Dynamic Learner Review knowledge set that tests what the learner needs to understand.
Scope: ${scope ? 'Only the selected category.' : 'The overall subject.'}
Coverage: ${examPrep ? 'EXAM PREP ONLY: Test content supported by explicit exam evidence; do not guess.' : essentials ? 'ESSENTIALS ONLY: Focus on foundational concepts and skills.' : 'BALANCED: Represent major topics and useful supporting details.'}
Generate EXACTLY ${preferences.count} distinct, useful questions when the source supports that many; never exceed the count, invent facts or add repetitive filler. If the source cannot support the count, return fewer and explain actual omissions in confidence.
${aiChoosesMix
  ? 'Choose appropriate question types from: ' + enabledTypes.map(questionTypeLabel).join(', ') + '. Mix formats naturally: multiple-choice for distinctions and application; blanks or short answer for recall; matching for small related groups (usually 3–5 rows); parameterized for genuinely variable source-supported procedures. Do not default to one type or use complex types solely for variety.' + (focusPrompt ? '\nSelected focus (guidance, not a quota): ' + focusPrompt : '')
  : 'Use exactly this requested question mix if the source supports it:\n' + enabledTypes.map(type => '- ' + questionTypeLabel(type) + ': ' + counts![type]).join('\n')}
Use straightforward, standalone wording, credible distractors, and non-spoiling learning hints. Avoid unsupported scenarios, invented numerical ranges and outside facts.
${AI_BOUNDED_INFERENCE_PROMPT}
${AI_SOURCE_DIFFICULTY_PROMPT}
Before creating the file, check the number of questions and the main source topics. Calibrate the four confidence estimates to the content actually tested, listing real omissions without inventing weaknesses.`;

  const jsonContract = `JSON AND METADATA CONTRACT — IDENTICAL FOR SIMPLE AND DETAILED:

SOURCE-UNIT STRUCTURE:
${AI_SOURCE_UNITS_PROMPT}

${allowParameterized ? PARAMETERIZED_AI_GUIDANCE : ''}

CONFIDENCE FORMAT CHECK:
Use a top-level "confidence" object with EXACTLY these fields: overallCoverage, examConfidence, subjectConfidence, studyConfidence, coverageExplanation, uncoveredSubjects, confidenceExplanation.
The four percentages MUST be whole JSON numbers from 0 to 100 (85, NOT "85%" or 0.85). The two explanations must be nonempty strings (maximum 500 characters). uncoveredSubjects must be an array of specific omitted-topic strings (up to ${MAX_AI_CONFIDENCE_TOPIC_LENGTH} characters each), or [] if no particular missing topic can be identified. For coverage below 100 with no identifiable missing topics, explain the uncertainty, inadequate depth, or intentional scope exclusions in coverageExplanation; do not invent topics.
Verify this object and the entire JSON before responding. All scored types may include optional context. overallCoverage measures source content assessed, examConfidence resemblance to evidenced exam material, subjectConfidence relevance and accuracy, and studyConfidence learning usefulness. These are subjective estimates, not measured outcomes.

OUTPUT AS A DOWNLOADABLE JSON FILE, NOT A CHAT CODE BLOCK:
- Create an actual UTF-8 .json file named dynamic-learner-review.json, containing the COMPLETE valid JSON object below, and attach the file to your reply so the user can download it.
- Do not print the JSON in chat, do not split the response into multiple code blocks, and do not truncate the file. Validate its JSON syntax before providing it.
- If this AI environment cannot create or attach a downloadable file, explain that limitation briefly and return the complete raw JSON as a fallback. Never falsely claim a file was attached.

Write the following JSON STRUCTURE to the downloadable file (illustrative schema only):
\`\`\`json
${JSON.stringify({ format: REVIEW_AI_FORMAT, targetApp: 'review', version: 1, title: 'Short knowledge set title', description: 'Brief scope of this knowledge set.', ...(allowParameterized && !aiChoosesMix ? { solvers: [AI_SOLVER_EXAMPLE] } : {}), questions: enabledTypes.map(type => examples[type]), sourceUnits: [], confidence: { overallCoverage: 85, examConfidence: 90, subjectConfidence: 86, studyConfidence: 90, coverageExplanation: 'Short explanation of coverage estimate.', uncoveredSubjects: ['Specific source topics not adequately tested'], confidenceExplanation: 'Short explanation of evidence and uncertainty.' } }, null, 2)}
\`\`\`

Examples show structure only, not required types or facts. The top-level fields, allowed question structures and validation requirements are identical for Simple and Detailed. ${allowParameterized ? 'Include solvers only when a Parameterized question needs them. ' : ''}Title: 1–${MAX_NAME_LENGTH} characters; description, prompt, answer, explanation, and choices: at most ${MAX_TEXT} characters each; context: at most ${MAX_QUESTION_CONTEXT} characters. Escape newlines and backslashes inside JSON strings.
${enabledTypes.map(type => fields[type]).join('\n')}
FINAL FILE VALIDATION: Count the final questions array, check every answer and permitted type, verify sourceUnits.itemNumbers against actual question positions if present, and verify all seven confidence fields. Return one complete, validated JSON file; never fragments, filler or untested solver code.`;
  const prompt = (variant === 'simple' ? simpleReasoning : detailedReasoning) + '\n\n' + jsonContract;
  return scope ? categoryScopedPrompt(prompt, scope, 'Review questions') : prompt;
}

export function parseReviewAiImport(text: string, preferences: ReviewAiPreferences, options: { requireCoverage?: boolean } = {}): ReviewAiImport {
  const countProblem = questionCountProblem(preferences.count);
  if (countProblem) throw new Error(countProblem);
  const expected = preferences.mixMode === 'ai' ? null : allocateQuestions(preferences.weights, preferences.count);
  const value = parseAiImportJson(text);
  assertAiTarget(value, 'review');
  if (!isRecord(value) || value.format !== REVIEW_AI_FORMAT || value.version !== 1) {
    throw new Error('Paste a dynamic-learner-review version-1 JSON object.');
  }
  if (Object.keys(value).some(key => !['format', 'targetApp', 'version', 'title', 'description', 'questions', 'solvers', 'coverage', 'confidence', 'sourceUnits'].includes(key))) {
    throw new Error('The Review response contains unsupported top-level fields.');
  }
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH) {
    throw new Error(`Review title must contain 1–${MAX_NAME_LENGTH} characters.`);
  }
  if (typeof value.description !== 'string' || value.description.length > MAX_TEXT) {
    throw new Error(`Review description must be a string of at most ${MAX_TEXT} characters.`);
  }
  if (!Array.isArray(value.questions) || !value.questions.length) {
    throw new Error('Review questions must be a nonempty array.');
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
  const sourceUnits = parseAiSourceUnits(value.sourceUnits, questions.length);
  for (const unit of sourceUnits ?? []) for (const number of unit.itemNumbers)
    questions[number - 1].sourceUnit = unit.title;
  validateQuestions(questions);
  if (expected !== null) {
    for (const type of AI_QUESTION_TYPES) {
      const actual = questions.filter(question => question.type === type).length;
      if (actual !== expected[type]) warnings.push(`${questionTypeLabel(type)}: requested ${expected[type]}, received ${actual}.${preferences.weights[type] === 0 && actual > 0 ? ' This type is disabled in the current mix.' : ''}`);
    }
  }
  let coverage: ReviewAiSubjectCoverage[] | null = null;
  if (value.coverage !== undefined) {
    if (!Array.isArray(value.coverage) || !value.coverage.length) {
      throw new Error('Coverage must list at least one source subject and its scored question numbers.');
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
    confidence = parseAiConfidenceValues(value.confidence);
  } else if (options.requireCoverage) {
    throw new Error('The AI omitted the required confidence statistics. Ask for complete JSON with confidence percentages and explanations.');
  }
  return { title: value.title.trim(), description: value.description.trim(), questions, warnings, coverage, confidence,
    ...(sourceUnits ? { sourceUnits } : {}) };
}

/** Accept a complete AI knowledge-set response OR a bare question array.
 * The caller appends the validated questions without replacing the set metadata.
 */
export function parseReviewQuestionsImport(text: string, requestedCount: number): ReviewAiImport {
  const source = parseAiImportJson(text);
  const envelope = Array.isArray(source)
    ? { format: REVIEW_AI_FORMAT, targetApp: 'review', version: 1, title: 'Additional questions', description: '', questions: source }
    : isRecord(source) && !Object.hasOwn(source, 'format') &&
      Object.keys(source).every(key => key === 'questions' || key === 'solvers')
      ? { ...source, format: REVIEW_AI_FORMAT, version: 1, title: 'Additional questions', description: '' }
      : source;
  return parseReviewAiImport(JSON.stringify(envelope), {
    count: requestedCount, mixMode: 'ai', coverage: 'balanced', weights: { ...DEFAULT_AI_WEIGHTS },
  });
}
