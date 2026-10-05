export type CheckModeId = 'study' | 'quiz' | 'test';
export const CHECK_MODES: readonly { id: CheckModeId; label: string; description: string; icon: string }[] = [
  { id: 'study', label: 'Study', description: 'Explore questions, reveal answers, and learn from explanations.', icon: 'cards' },
  { id: 'quiz', label: 'Quiz', description: 'Recall answers and get feedback as you go.', icon: 'checklist' },
  { id: 'test', label: 'Test', description: 'Answer independently, then see your results after submitting.', icon: 'document' },
];
export function isCheckMode(value: unknown): value is CheckModeId {
  return typeof value === 'string' && CHECK_MODES.some((mode) => mode.id === value);
}
