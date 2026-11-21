import { AI_COMPLETE_COVERAGE_PROMPT } from './ai-subject-coverage.ts';

export type AiCoverageLevel = 'exam-prep' | 'essentials' | 'balanced';

export const AI_COVERAGE_CHOICES: readonly { value: AiCoverageLevel; label: string; description: string }[] = [
  { value: 'exam-prep', label: 'Exam prep only', description: 'Prioritize topics clearly identified as likely exam content.' },
  { value: 'essentials', label: 'Essentials only', description: 'Focus on the core ideas and indispensable skills.' },
  { value: 'balanced', label: 'Balanced', description: 'Cover major topics and useful supporting details.' },
];

export function aiCoverageInstructions(level: AiCoverageLevel): string {
  if (level === 'exam-prep') return 'EXAM PREP ONLY: prioritize content strongly supported by explicit exam guidance in the source (instructor instructions, exam outline, practice exams). Ignore unrelated or merely plausible topics. Do not invent exam expectations or expand the syllabus. If no exam evidence exists, state this uncertainty and return fewer useful items rather than pretending everything is examinable. Report strongly evidenced omissions.';
  if (level === 'essentials') return 'ESSENTIALS ONLY: focus on core source concepts and necessary skills; omit trivia, low-priority examples and redundant details. Explain important omissions and do not use quotas to force filler.';
  return 'BALANCED: cover every major source topic and relevant supporting details without trivia or repetition. ' +
    AI_COMPLETE_COVERAGE_PROMPT + ' When an item limit prevents full coverage, identify missing topics instead of inventing content.';
}
