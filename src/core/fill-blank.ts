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

export type FillBlankAnswerMatcher = (answer: string, response: string) => boolean;

export function isFillBlankAnswerCorrect(answer: string, response: string): boolean {
  return isAnswerCorrect(answer, response);
}

export function fillBlankCorrectness(
  template: FillBlankTemplate,
  responses: readonly string[],
  matches: FillBlankAnswerMatcher = isFillBlankAnswerCorrect,
): boolean[] {
  const result = template.answers.map((answer, index) =>
    matches(answer, responses[index] ?? ''));

  for (let index = 0; index <= template.segments.length - 3; index += 1) {
    const left = template.segments[index];
    const connector = template.segments[index + 1];
    const right = template.segments[index + 2];
    if (left?.type !== 'blank' || connector?.type !== 'text' || right?.type !== 'blank' ||
        !/^\s*(?:and|or)\s*$/i.test(connector.text)) {
      continue;
    }

    if (matches(left.answer, responses[right.index] ?? '') &&
        matches(right.answer, responses[left.index] ?? '')) {
      result[left.index] = true;
      result[right.index] = true;
    }
  }

  return result;
}

export function maskFillBlankAnswers(source: string): string {
  return source.replace(BLANK_PATTERN, '______');
}

export function restoreFillBlankAnswers(source: string): string {
  return source.replace(BLANK_PATTERN, (_match, answer: string) => answer.trim());
}
