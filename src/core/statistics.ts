import { isValidId } from './ids.ts';
import { isRecord } from './validation.ts';

export const STATISTICS_APPS = ['notebook', 'todo-list', 'index-cards', 'word-search', 'crossword', 'guide', 'knowledge-check', 'calculator'] as const;
export type StatisticsApp = typeof STATISTICS_APPS[number];
export const STATISTICS_LABELS = {
  views: 'Times opened', cardViews: 'Cards viewed', reviewStarts: 'Reviews started', reviews: 'Reviews completed',
  studyStarts: 'Study sessions started', studyPasses: 'Study passes completed', quizzes: 'Quizzes taken', tests: 'Tests taken',
  answerChecks: 'Answers checked', correctChecks: 'Correct checks', assessmentQuestions: 'Assessment questions', assessmentCorrect: 'Assessment correct',
  gamesStarted: 'Puzzles started', gamesCompleted: 'Puzzles completed', adventuresStarted: 'Adventures started', adventuresCompleted: 'Adventures completed',
  tasksCompleted: 'Tasks completed', calculations: 'Calculations',
} as const;
export type StatisticsMetric = keyof typeof STATISTICS_LABELS;
export type StatisticsCounts = Partial<Record<StatisticsMetric, number>>;
export interface EntryStatistics { counts: StatisticsCounts; lastActivityAt: string }
export interface AppStatistics { counts: StatisticsCounts; entries: Record<string, EntryStatistics> }
export interface StatisticsData { version: 1; startedAt: string; apps: Partial<Record<StatisticsApp, AppStatistics>> }
export interface StatisticsInventoryEntry { id: string; name: string; children?: readonly StatisticsInventoryEntry[] }
export type StatisticsInventory = Partial<Record<StatisticsApp, readonly StatisticsInventoryEntry[]>>;

export const APP_STATISTICS_METRICS: Record<StatisticsApp, readonly StatisticsMetric[]> = {
  notebook: ['views'], 'todo-list': ['views', 'tasksCompleted'],
  'index-cards': ['views', 'cardViews', 'reviewStarts', 'reviews'],
  'knowledge-check': ['views', 'studyStarts', 'studyPasses', 'quizzes', 'tests', 'answerChecks', 'correctChecks', 'assessmentQuestions', 'assessmentCorrect'],
  'word-search': ['views', 'gamesStarted', 'gamesCompleted'], crossword: ['views', 'gamesStarted', 'gamesCompleted'],
  guide: ['views', 'adventuresStarted', 'adventuresCompleted'], calculator: ['views', 'calculations'],
};

export function emptyStatistics(): StatisticsData {
  return { version: 1, startedAt: new Date().toISOString(), apps: {} };
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 32 && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
function validateCounts(value: unknown): asserts value is StatisticsCounts {
  if (!isRecord(value) || Object.entries(value).some(([key, count]) =>
    !Object.hasOwn(STATISTICS_LABELS, key) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0)) {
    throw new Error('Statistics counters must be supported non-negative whole numbers.');
  }
}
export function validateStatistics(value: unknown): asserts value is StatisticsData {
  if (!isRecord(value) || Object.keys(value).some(key => !['version', 'startedAt', 'apps'].includes(key)) ||
      value.version !== 1 || !validDate(value.startedAt) || !isRecord(value.apps)) throw new Error('Workspace statistics are invalid.');
  for (const [app, record] of Object.entries(value.apps)) {
    if (!STATISTICS_APPS.some(id => id === app) || !isRecord(record) ||
        Object.keys(record).some(key => !['counts', 'entries'].includes(key)) || !isRecord(record.entries) ||
        Object.keys(record.entries).length > 5000) throw new Error('App statistics are invalid.');
    validateCounts(record.counts);
    for (const [id, entry] of Object.entries(record.entries)) {
      if (!isValidId(id) || !isRecord(entry) || Object.keys(entry).some(key => !['counts', 'lastActivityAt'].includes(key)) ||
          !validDate(entry.lastActivityAt)) throw new Error('Library entry statistics are invalid.');
      validateCounts(entry.counts);
    }
  }
}

export function sumStatistics(values: readonly StatisticsCounts[]): StatisticsCounts {
  const result: StatisticsCounts = {};
  for (const counts of values) for (const metric of Object.keys(STATISTICS_LABELS) as StatisticsMetric[]) {
    result[metric] = Math.min(Number.MAX_SAFE_INTEGER, (result[metric] ?? 0) + (counts[metric] ?? 0));
  }
  return result;
}
