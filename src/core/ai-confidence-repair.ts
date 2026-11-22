import { parseAiImportJson } from './ai-json.ts';
import { isRecord } from './validation.ts';

/** Subjective external-AI estimates, never calculated locally. */
export interface AiConfidenceValues {
  overallCoverage: number;
  examConfidence: number;
  subjectConfidence: number;
  studyConfidence: number;
  coverageExplanation: string;
  uncoveredSubjects: string[];
  confidenceExplanation: string;
}

/** Accept the confidence object directly, or inside a minimal confidence wrapper. */
export function parseAiConfidenceReply(text: string): AiConfidenceValues {
  const raw = parseAiImportJson(text);
  const value = isRecord(raw) && Object.keys(raw).length === 1 && 'confidence' in raw
    ? raw.confidence : raw;
  if (!isRecord(value)) throw new Error('Paste a JSON confidence object, not an array or plain text.');
  const scores = ['overallCoverage', 'examConfidence', 'subjectConfidence', 'studyConfidence'] as const;
  const fields = [...scores, 'coverageExplanation', 'uncoveredSubjects', 'confidenceExplanation'];
  if (Object.keys(value).some(key => !fields.includes(key)))
    throw new Error('Paste only the confidence statistics, without questions or other generated content.');
  for (const key of scores) {
    const number = value[key];
    if (typeof number !== 'number' || !Number.isInteger(number) || number < 0 || number > 100)
      throw new Error(key + ' must be a whole-number percentage from 0 to 100.');
  }
  for (const key of ['coverageExplanation', 'confidenceExplanation'] as const) {
    const valueText = value[key];
    if (typeof valueText !== 'string' || !valueText.trim() || valueText.length > 500)
      throw new Error(key + ' must be a brief, nonempty explanation (500 characters or fewer).');
  }
  const missing = value.uncoveredSubjects;
  if (!Array.isArray(missing) || missing.length > 500 ||
      missing.some(item => typeof item !== 'string' || !item.trim() || item.length > 160))
    throw new Error('uncoveredSubjects must be an array of specific missing topics, or [] if none were identified.');
  return {
    overallCoverage: value.overallCoverage as number,
    examConfidence: value.examConfidence as number,
    subjectConfidence: value.subjectConfidence as number,
    studyConfidence: value.studyConfidence as number,
    coverageExplanation: (value.coverageExplanation as string).trim(),
    uncoveredSubjects: (missing as string[]).map(item => item.trim()),
    confidenceExplanation: (value.confidenceExplanation as string).trim(),
  };
}

/** Request confidence for accepted content only, without regenerating study material. */
export function aiConfidenceRequest(app: 'Review' | 'Guide', items: readonly string[]): string {
  const shown = items.slice(0, 100).map((item, index) =>
    (index + 1) + '. ' + item.replace(/\s+/g, ' ').slice(0, 200)).join('\n');
  const list = items.length > 100
    ? '\nThe list is abbreviated; refer to the previously generated full material for other accepted items.'
    : '';
  return 'Using the ORIGINAL source and the previously generated Dynamic Learner ' + app + ' content in this SAME AI conversation, ' +
    'calculate the MISSING CONFIDENCE STATISTICS only. Do not regenerate, change, or add study content. ' +
    'Estimate values for the ' + items.length + ' accepted ' + (app === 'Guide' ? 'Guide sections/map stops' : 'Review questions') +
    ' listed here, not for any items rejected during import.\n\n' +
    shown + list + '\n\n' +
    'Return ONLY a JSON object with EXACTLY seven fields: overallCoverage, examConfidence, subjectConfidence, studyConfidence, coverageExplanation, uncoveredSubjects, confidenceExplanation. ' +
    'The four percentages must be honest integers from 0 to 100. Both explanations must be nonempty and no longer than 500 characters each. ' +
    'uncoveredSubjects must be an array of specific missing topics (up to 160 characters each) or []. ' +
    (app === 'Guide'
      ? 'Overall coverage measures what is MEANINGFULLY TAUGHT, not just named. Study confidence reflects usefulness of instruction, examples, and practice. '
      : 'Overall coverage measures what is actually TESTED by the accepted questions, not merely named. Study confidence reflects usefulness for learning and practice. ') +
    'Exam confidence must reflect only evidence about likely exam objectives; do not pretend to know the exam. Subject confidence reflects accuracy to the original source. ' +
    'These are subjective AI estimates, not measured mastery or verified probabilities. Describe genuine gaps and uncertainty; do not fabricate facts or scores. ' +
    'If you cannot inspect the original source or accepted content, state that the estimates CANNOT BE DETERMINED rather than inventing percentages. ' +
    'Return the seven-field confidence JSON object (or a single "confidence" wrapper) and nothing else.';
}
