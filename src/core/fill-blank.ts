import { isAnswerCorrect } from './answer-matching.ts';

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

export function isFillBlankAnswerCorrect(answer: string, response: string): boolean {
  return isAnswerCorrect(answer, response);
}

export function maskFillBlankAnswers(source: string): string {
  return source.replace(BLANK_PATTERN, '______');
}

export function restoreFillBlankAnswers(source: string): string {
  return source.replace(BLANK_PATTERN, (_match, answer: string) => answer.trim());
}
