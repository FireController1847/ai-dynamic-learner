export type CheckTypeId = 'study' | 'quiz' | 'test';

export const CHECK_TYPES: readonly { id: CheckTypeId; label: string; description: string; icon: string }[] = [
  { id: 'study', label: 'Study', description: 'Review material at your own pace.', icon: 'cards' },
  { id: 'quiz', label: 'Quiz', description: 'Practice checking what you know.', icon: 'checklist' },
  { id: 'test', label: 'Test', description: 'Assess your knowledge.', icon: 'document' },
];

export function normalizeCheckType(value: unknown): unknown {
  switch (value) {
    case 'multiple-choice': return 'study';
    case 'true-false': return 'quiz';
    case 'short-answer': return 'test';
    default: return value;
  }
}

export function isCheckType(value: unknown): value is CheckTypeId {
  return typeof value === 'string' && CHECK_TYPES.some((type) => type.id === value);
}

export function getCheckType(id: CheckTypeId) {
  return CHECK_TYPES.find((type) => type.id === id)!;
}
