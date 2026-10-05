export type CheckTypeId = 'multiple-choice' | 'true-false' | 'short-answer';

export const CHECK_TYPES: readonly { id: CheckTypeId; label: string; description: string; icon: string }[] = [
  { id: 'multiple-choice', label: 'Multiple Choice', description: 'Choose an answer from a set of options.', icon: 'checklist' },
  { id: 'true-false', label: 'True or False', description: 'Decide whether each statement is true or false.', icon: 'check' },
  { id: 'short-answer', label: 'Short Answer', description: 'Recall an answer and write it in your own words.', icon: 'pencil' },
];

export function isCheckType(value: unknown): value is CheckTypeId {
  return typeof value === 'string' && CHECK_TYPES.some((type) => type.id === value);
}

export function getCheckType(id: CheckTypeId) {
  return CHECK_TYPES.find((type) => type.id === id)!;
}
