export type CheckModeId = 'study' | 'quiz' | 'test';
export const CHECK_MODES: readonly { id: CheckModeId; label: string; description: string; icon: string }[] = [
  { id: 'study', label: 'Study', description: 'See questions, reveal answers, and learn.', icon: 'cards' },
  { id: 'quiz', label: 'Quiz', description: 'Answer each question and check as you go.', icon: 'checklist' },
  { id: 'test', label: 'Test', description: 'Answer on your own, then see your score.', icon: 'document' },
];
export function isCheckMode(value: unknown): value is CheckModeId {
  return typeof value === 'string' && CHECK_MODES.some((mode) => mode.id === value);
}
