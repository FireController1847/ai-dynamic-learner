export type CheckModeId = 'study' | 'quiz' | 'test';
export const CHECK_MODES: readonly { id: CheckModeId; label: string; description: string; icon: string }[] = [
  { id: 'study', label: 'Study', description: 'Practice with hints, retries, and no score.', icon: 'cards' },
  { id: 'quiz', label: 'Quiz', description: 'Friendly practice with feedback after each answer.', icon: 'checklist' },
  { id: 'test', label: 'Test', description: 'Answer independently. Feedback waits until submission.', icon: 'document' },
];
export function isCheckMode(value: unknown): value is CheckModeId {
  return typeof value === 'string' && CHECK_MODES.some((mode) => mode.id === value);
}
