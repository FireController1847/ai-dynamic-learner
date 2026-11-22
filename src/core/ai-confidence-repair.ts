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

/** Ask the same external AI for a COMPLETE corrected JSON file, not field fragments. */
export function aiConfidenceRequest(app: 'Review' | 'Guide', items: readonly string[]): string {
  const shown = items.slice(0, 80).map((item, index) =>
    (index + 1) + '. ' + item.replace(/\s+/g, ' ').slice(0, 200)).join('\n');
  const list = items.length > 80 ? '\nThis list is abbreviated: refer to the ORIGINAL FULL generated file for the remaining content.' : '';
  return 'Correct the PREVIOUS Dynamic Learner ' + app + ' JSON file from this SAME AI conversation using the original study source and the prior generated response. ' +
    'The confidence statistics are missing or invalid. Add or correct the top-level "confidence" object and return the ENTIRE updated, standalone JSON file. ' +
    'Keep every valid question, answer, lesson, section, title, format, targetApp, version and other metadata unchanged; fix only errors that prevent a valid import. ' +
    'Do not return just confidence fields, a seven-field object, a bare array, a JSON patch, or a list of edits. ' +
    'The corrected confidence object MUST contain EXACTLY: overallCoverage, examConfidence, subjectConfidence, studyConfidence, coverageExplanation, uncoveredSubjects, confidenceExplanation. ' +
    'Four scores are subjective whole-number percentages 0–100; each explanation is nonempty and at most 500 characters; uncoveredSubjects is an array of specific omitted topics (at most ' +
    MAX_AI_CONFIDENCE_TOPIC_LENGTH + ' characters each) or []. ' +
    'Assess actual source coverage and uncertainty honestly: these are AI estimates, not measured mastery or confirmed exam probabilities. Never invent evidence or scores. ' +
    (app === 'Guide' ? 'Coverage concerns meaningfully taught source content rather than headings alone. ' :
      'Coverage concerns the material actually tested by accepted questions, not merely mentioned. ') +
    'Keep ALL previously valid generated content, including the following ' + items.length + ' accepted ' +
    (app === 'Guide' ? 'Guide sections or map stops' : 'Review questions') + ':\n\n' + shown + list + '\n\n' +
    'MANDATORY OUTPUT: Create and attach ONE COMPLETE UTF-8 .json file containing the corrected full original schema and every retained item. ' +
    'ONLY if file attachment is technically unavailable, briefly state the limitation and return the ENTIRE valid JSON object as raw text. ' +
    'Verify all required fields, all four confidence scores, JSON syntax, and all item references before replying. ' +
    'If you cannot access the original file or study source, request it instead of inventing content or returning partial JSON.';
}
