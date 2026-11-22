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

/** Missing-topic explanations may reasonably be grouped by source chapter. */
export const MAX_AI_CONFIDENCE_TOPIC_LENGTH = 1000;
export const MAX_AI_CONFIDENCE_TOPICS = 500;

/** The single confidence contract used by Review, Guide, and the repair dialog. */
export function parseAiConfidenceValues(value: unknown): AiConfidenceValues {
  if (!isRecord(value)) throw new Error('confidence must contain four percentages, two explanations and uncoveredSubjects.');
  const scores = ['overallCoverage', 'examConfidence', 'subjectConfidence', 'studyConfidence'] as const;
  const allowed = [...scores, 'coverageExplanation', 'uncoveredSubjects', 'confidenceExplanation'];
  if (Object.keys(value).some(key => !allowed.includes(key)))
    throw new Error('confidence contains an unsupported field.');
  for (const key of scores) {
    const n = value[key];
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 100)
      throw new Error('confidence.' + key + ' must be an integer from 0 to 100.');
  }
  for (const key of ['coverageExplanation', 'confidenceExplanation'] as const) {
    const explanation = value[key];
    if (typeof explanation !== 'string' || !explanation.trim() || explanation.length > 500)
      throw new Error('confidence.' + key + ' must be a nonempty explanation of 500 characters or fewer.');
  }
  const gaps = value.uncoveredSubjects;
  if (!Array.isArray(gaps) || gaps.length > MAX_AI_CONFIDENCE_TOPICS ||
      gaps.some(topic => typeof topic !== 'string' || !topic.trim() || topic.length > MAX_AI_CONFIDENCE_TOPIC_LENGTH))
    throw new Error('confidence.uncoveredSubjects needs up to ' + MAX_AI_CONFIDENCE_TOPICS +
      ' nonempty topic descriptions, at most ' + MAX_AI_CONFIDENCE_TOPIC_LENGTH + ' characters each.');
  return {
    overallCoverage: value.overallCoverage as number,
    examConfidence: value.examConfidence as number,
    subjectConfidence: value.subjectConfidence as number,
    studyConfidence: value.studyConfidence as number,
    coverageExplanation: (value.coverageExplanation as string).trim(),
    uncoveredSubjects: (gaps as string[]).map(item => item.trim()),
    confidenceExplanation: (value.confidenceExplanation as string).trim(),
  };
}

/** Salvage valid scores when ONLY the missing-topic list is malformed, with disclosure. */
export function recoverAiConfidenceValues(input: unknown): {
  confidence: AiConfidenceValues | null; notice?: string; problem?: string;
} {
  try { return { confidence: parseAiConfidenceValues(input) }; }
  catch (error) {
    const problem = error instanceof Error ? error.message : String(error);
    if (!isRecord(input)) return { confidence: null, problem };
    const list = input.uncoveredSubjects;
    const valid = Array.isArray(list) ? list.filter((item): item is string =>
      typeof item === 'string' && Boolean(item.trim()) && item.length <= MAX_AI_CONFIDENCE_TOPIC_LENGTH)
      .slice(0, MAX_AI_CONFIDENCE_TOPICS) : [];
    // Never turn missing scores or invalid explanations into fabricated statistics.
    try {
      const confidence = parseAiConfidenceValues({ ...input, uncoveredSubjects: valid });
      if (Array.isArray(list) && valid.length === list.length) return { confidence: null, problem };
      return {
        confidence,
        notice: 'AI confidence scores were retained, but ' +
          (Array.isArray(list) ? 'invalid or overlong missing-topic descriptions were omitted.' :
            'the missing-topic list was absent or invalid and could not be retained.'),
      };
    } catch { return { confidence: null, problem }; }
  }
}

/** Accept the confidence object directly, or inside a minimal confidence wrapper. */
export function parseAiConfidenceReply(text: string): AiConfidenceValues {
  const raw = parseAiImportJson(text);
  const input = isRecord(raw) && Object.keys(raw).length === 1 && 'confidence' in raw
    ? raw.confidence : raw;
  return parseAiConfidenceValues(input);
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
    'uncoveredSubjects must be an array of specific missing topics (up to ' + MAX_AI_CONFIDENCE_TOPIC_LENGTH + ' characters each) or []. ' +
    (app === 'Guide'
      ? 'Overall coverage measures what is MEANINGFULLY TAUGHT, not just named. Study confidence reflects usefulness of instruction, examples, and practice. '
      : 'Overall coverage measures what is actually TESTED by the accepted questions, not merely named. Study confidence reflects usefulness for learning and practice. ') +
    'Exam confidence must reflect only evidence about likely exam objectives; do not pretend to know the exam. Subject confidence reflects accuracy to the original source. ' +
    'These are subjective AI estimates, not measured mastery or verified probabilities. Describe genuine gaps and uncertainty; do not fabricate facts or scores. ' +
    'If you cannot inspect the original source or accepted content, state that the estimates CANNOT BE DETERMINED rather than inventing percentages. ' +
    'Return the seven-field confidence JSON object (or a single "confidence" wrapper) and nothing else.';
}
