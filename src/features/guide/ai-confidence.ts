import { isRecord } from '../../core/validation.ts';
export interface GuideAiConfidence {
  overallCoverage: number; examConfidence: number; subjectConfidence: number; studyConfidence: number;
  coverageExplanation: string; uncoveredSubjects: string[]; confidenceExplanation: string;
}
/** Estimates are authored by the external AI, not calculated from the uploaded source. */
export const GUIDE_CONFIDENCE_PROMPT = `COVERAGE AND CONFIDENCE (required in new Guide JSON, following Review's estimates):
Include a top-level confidence object containing EXACTLY overallCoverage, examConfidence, subjectConfidence, studyConfidence, coverageExplanation, uncoveredSubjects, confidenceExplanation.
All four percentages are whole JSON numbers 0-100 (85, not "85%" or 0.85). Both explanations must be nonempty and <=500 characters. uncoveredSubjects is [] or specific inadequately taught source subjects (<=160 characters each).
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
  if (input === undefined) return null; // Allow older direct imports.
  const scores = ['overallCoverage','examConfidence','subjectConfidence','studyConfidence'] as const;
  const allowed = [...scores,'coverageExplanation','uncoveredSubjects','confidenceExplanation'];
  if (!isRecord(input) || Object.keys(input).some(key=>!allowed.includes(key)))
    throw new Error('Guide confidence needs four percentages, explanations, and uncoveredSubjects.');
  for (const key of scores) {
    const n=input[key];
    if (typeof n!=='number' || !Number.isInteger(n) || n<0 || n>100)
      throw new Error('confidence.'+key+' must be a whole number 0–100.');
  }
  for (const key of ['coverageExplanation','confidenceExplanation'] as const) {
    const value=input[key];
    if (typeof value!=='string' || !value.trim() || value.length>500)
      throw new Error('confidence.'+key+' must contain a brief explanation.');
  }
  if (!Array.isArray(input.uncoveredSubjects) || input.uncoveredSubjects.length>500 ||
    input.uncoveredSubjects.some(x=>typeof x!=='string'||!x.trim()||x.length>160))
    throw new Error('confidence.uncoveredSubjects must be a list of specific topics or [].');
  return { overallCoverage:input.overallCoverage as number, examConfidence:input.examConfidence as number,
    subjectConfidence:input.subjectConfidence as number, studyConfidence:input.studyConfidence as number,
    coverageExplanation:(input.coverageExplanation as string).trim(),
    uncoveredSubjects:(input.uncoveredSubjects as string[]).map(x=>x.trim()),
    confidenceExplanation:(input.confidenceExplanation as string).trim() };
}
