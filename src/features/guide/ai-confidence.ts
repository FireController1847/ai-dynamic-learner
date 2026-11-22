import { parseAiConfidenceValues, MAX_AI_CONFIDENCE_TOPIC_LENGTH, type AiConfidenceValues } from '../../core/ai-confidence-repair.ts';
export type GuideAiConfidence = AiConfidenceValues;
/** Estimates are authored by the external AI, not calculated from the uploaded source. */
export const GUIDE_CONFIDENCE_PROMPT = `COVERAGE AND CONFIDENCE (required in new Guide JSON, following Review's estimates):
Include a top-level confidence object containing EXACTLY overallCoverage, examConfidence, subjectConfidence, studyConfidence, coverageExplanation, uncoveredSubjects, confidenceExplanation.
All four percentages are whole JSON numbers 0-100 (85, not "85%" or 0.85). Both explanations must be nonempty and <=500 characters. uncoveredSubjects is [] or specific inadequately taught source subjects (up to ${MAX_AI_CONFIDENCE_TOPIC_LENGTH} characters each).
overallCoverage measures how much of the supplied source/category is MEANINGFULLY TAUGHT by lessons, not just named in a heading. examConfidence estimates relevance to likely exam objectives (never claim to know the actual exam). subjectConfidence estimates accuracy and source alignment of facts, formulas, algorithms and examples. studyConfidence estimates how well instruction, worked examples, guided practice and later revisits build understanding.
Before rating, compare EVERY source heading, objective and subtopic with generated lessons. Explain real omissions and inadequate depth in coverageExplanation; list identifiable omissions in uncoveredSubjects; explain subject accuracy, exam relevance and teaching usefulness in confidenceExplanation. For any score below 80, explain realistically how to improve it. Never make up missing source facts or exam questions, never inflate 100% coverage when material is omitted, and avoid unjustified pessimism when content genuinely is complete.
These are subjective AI-generated predictions, NOT verified completeness, student mastery, or measured probabilities. Both the coverage inventory and confidence object belong inside the COMPLETE DOWNLOADABLE JSON FILE.`;
export const GUIDE_CONFIDENCE_EXAMPLE: GuideAiConfidence = {
  overallCoverage: 88, examConfidence: 85, subjectConfidence: 90, studyConfidence: 87,
  coverageExplanation: 'Explain actual coverage and any remaining gaps.',
  uncoveredSubjects: [],
  confidenceExplanation: 'Explain why the lessons align with the source and help learning.',
};
export function parseGuideConfidence(input: unknown): GuideAiConfidence | null {
  return input === undefined ? null : parseAiConfidenceValues(input);
}
