import { isRecord } from './validation.ts';

export type AiTargetApp = 'review' | 'guide' | 'index-cards' | 'word-search' | 'crossword';
export const AI_APP_LABELS: Record<AiTargetApp, string> = {
  review: 'Review', guide: 'Guide', 'index-cards': 'Index Cards',
  'word-search': 'Word Search', crossword: 'Crossword',
};
const FORMATS: Record<string, AiTargetApp> = {
  'dynamic-learner-review': 'review',
  'dynamic-learner-guide': 'guide', 'dynamic-learner-guide-map': 'guide',
  'dynamic-learner-study-guide': 'guide', 'dynamic-learner-study-guide-map': 'guide',
  'dynamic-learner-flash-cards': 'index-cards',
  'dynamic-learner-fill-in-the-blanks': 'index-cards',
  'dynamic-learner-word-search': 'word-search', 'dynamic-learner-crossword': 'crossword',
};
/** Verify explicit target and known formats; legacy responses without targetApp remain compatible. */
export function assertAiTarget(value: unknown, expected: AiTargetApp): void {
  if (!isRecord(value)) return;
  const target = value.targetApp;
  if (target !== undefined && (typeof target !== 'string' || !(target in AI_APP_LABELS)))
    throw new Error('Unknown AI target app. Generate a new response for ' + AI_APP_LABELS[expected] + '.');
  const declared = target as AiTargetApp | undefined;
  const inferred = typeof value.format === 'string' ? FORMATS[value.format] : undefined;
  const actual = declared ?? inferred;
  if (actual && actual !== expected)
    throw new Error('This response was generated for ' + AI_APP_LABELS[actual] +
      ', but you are importing it into ' + AI_APP_LABELS[expected] +
      '. Please generate a new response for ' + AI_APP_LABELS[expected] + '.');
  if (declared && inferred && declared !== inferred)
    throw new Error('The response identifies conflicting apps. Ask for a corrected ' +
      AI_APP_LABELS[expected] + ' response.');
}
