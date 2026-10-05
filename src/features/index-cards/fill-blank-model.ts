export interface FillBlankTextSegment {
  type: 'text';
  text: string;
}

export interface FillBlankAnswerSegment {
  type: 'blank';
  index: number;
  answer: string;
}

export type FillBlankSegment = FillBlankTextSegment | FillBlankAnswerSegment;

export interface FillBlankTemplate {
  segments: FillBlankSegment[];
  answers: string[];
}

const BLANK_PATTERN = /\{\{([^{}\n]+)\}\}/g;

export function parseFillBlankTemplate(source: string): FillBlankTemplate {
  const segments: FillBlankSegment[] = [];
  const answers: string[] = [];
  let cursor = 0;

  for (const match of source.matchAll(BLANK_PATTERN)) {
    const start = match.index ?? 0;
    const answer = match[1]?.trim() ?? '';
    if (!answer) continue;
    if (start > cursor) segments.push({ type: 'text', text: source.slice(cursor, start) });
    const index = answers.length;
    answers.push(answer);
    segments.push({ type: 'blank', index, answer });
    cursor = start + match[0].length;
  }

  if (cursor < source.length) segments.push({ type: 'text', text: source.slice(cursor) });
  if (!segments.length && source) segments.push({ type: 'text', text: source });

  return { segments, answers };
}

export function normalizeFillBlankAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function isFillBlankAnswerCorrect(answer: string, response: string): boolean {
  return normalizeFillBlankAnswer(answer) === normalizeFillBlankAnswer(response);
}

export function maskFillBlankAnswers(source: string): string {
  return source.replace(BLANK_PATTERN, (_match, answer: string) => {
    const length = Math.max(4, Math.min(16, answer.trim().length));
    return '_'.repeat(length);
  });
}
