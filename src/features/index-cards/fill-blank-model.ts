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

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_value, index) => index);
  let current = new Array<number>(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    [previous, current] = [current, previous];
  }

  return previous[right.length] ?? 0;
}

function fillBlankSimilarityThreshold(answerLength: number): number {
  if (answerLength < 4) return 1;
  if (answerLength === 4) return 0.8;
  if (answerLength < 10) return 0.75;
  return 0.6;
}

export function fillBlankAnswerSimilarity(answer: string, response: string): number {
  const expected = normalizeFillBlankAnswer(answer);
  const submitted = normalizeFillBlankAnswer(response);
  const longest = Math.max(expected.length, submitted.length);
  if (!longest) return 1;
  return 1 - (levenshteinDistance(expected, submitted) / longest);
}

export function isFillBlankAnswerCorrect(answer: string, response: string): boolean {
  const expected = normalizeFillBlankAnswer(answer);
  const submitted = normalizeFillBlankAnswer(response);
  if (expected === submitted) return true;
  if (!expected || !submitted) return false;

  return fillBlankAnswerSimilarity(expected, submitted) >= fillBlankSimilarityThreshold(expected.length);
}

export function maskFillBlankAnswers(source: string): string {
  return source.replace(BLANK_PATTERN, '______');
}
