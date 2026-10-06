export type AnswerStrictness = 1 | 2 | 3 | 4;
export type AnswerMatchReason = 'exact' | 'fuzzy' | 'linguistic' | 'semantic' | 'incorrect';

export interface AnswerMatchOptions {
  strictness?: AnswerStrictness;
}

export interface AnswerMatchResult {
  correct: boolean;
  reason: AnswerMatchReason;
  similarity: number;
  confidence: number;
}

export const DEFAULT_ANSWER_STRICTNESS: AnswerStrictness = 4;

const SEMANTIC_CONFIDENCE_THRESHOLD = 0.92;
const SEMANTIC_WORD_CONFIDENCE = 0.94;
const SEMANTIC_PHRASE_CONFIDENCE = 0.96;

const IRREGULAR_FAMILIES: readonly (readonly string[])[] = [
  ['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being'],
  ['have', 'has', 'had', 'having'],
  ['do', 'does', 'did', 'done', 'doing'],
  ['go', 'goes', 'went', 'gone', 'going'],
  ['run', 'runs', 'ran', 'running'],
  ['eat', 'eats', 'ate', 'eaten', 'eating'],
  ['write', 'writes', 'wrote', 'written', 'writing'],
  ['see', 'sees', 'saw', 'seen', 'seeing'],
  ['come', 'comes', 'came', 'coming'],
  ['take', 'takes', 'took', 'taken', 'taking'],
  ['make', 'makes', 'made', 'making'],
  ['get', 'gets', 'got', 'gotten', 'getting'],
  ['give', 'gives', 'gave', 'given', 'giving'],
  ['know', 'knows', 'knew', 'known', 'knowing'],
  ['think', 'thinks', 'thought', 'thinking'],
  ['bring', 'brings', 'brought', 'bringing'],
  ['teach', 'teaches', 'taught', 'teaching'],
  ['buy', 'buys', 'bought', 'buying'],
  ['catch', 'catches', 'caught', 'catching'],
  ['find', 'finds', 'found', 'finding'],
  ['feel', 'feels', 'felt', 'feeling'],
  ['leave', 'leaves', 'left', 'leaving'],
  ['child', 'children'],
  ['person', 'people'],
  ['man', 'men'],
  ['woman', 'women'],
  ['mouse', 'mice'],
  ['goose', 'geese'],
  ['tooth', 'teeth'],
  ['foot', 'feet'],
];

const SEMANTIC_WORD_FAMILIES: readonly (readonly string[])[] = [
  ['union', 'join', 'combine', 'merge', 'unite'],
  ['begin', 'start'],
  ['finish', 'end'],
  ['buy', 'purchase'],
  ['remove', 'delete'],
  ['large', 'big'],
  ['small', 'little'],
];

const SEMANTIC_PHRASE_FAMILIES: readonly (readonly string[])[] = [
  ['for example', 'for instance'],
  ['because of', 'due to'],
];

const irregularLemma = new Map<string, string>();
for (const family of IRREGULAR_FAMILIES) {
  const lemma = family[0]!;
  for (const form of family) irregularLemma.set(form, lemma);
}

export function isAnswerStrictness(value: unknown): value is AnswerStrictness {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export function normalizeAnswer(value: string): string {
  return value.normalize('NFKC')
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
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
        previous[rightIndex]! + 1,
        current[rightIndex - 1]! + 1,
        previous[rightIndex - 1]! + substitutionCost,
      );
    }
    [previous, current] = [current, previous];
  }

  return previous[right.length] ?? 0;
}

function similarityThreshold(answerLength: number): number {
  if (answerLength < 4) return 1;
  if (answerLength === 4) return 0.8;
  if (answerLength < 10) return 0.75;
  return 0.6;
}

export function answerSimilarity(answer: string, response: string): number {
  const expected = normalizeAnswer(answer);
  const submitted = normalizeAnswer(response);
  const longest = Math.max(expected.length, submitted.length);
  if (!longest) return 1;
  return 1 - (levenshteinDistance(expected, submitted) / longest);
}

function consonant(value: string): boolean {
  return /^[a-z]$/.test(value) && !'aeiou'.includes(value);
}

function shortCvc(word: string): boolean {
  if (word.length < 3 || word.length > 4) return false;
  const [first, middle, last] = word.slice(-3);
  return consonant(first!) && 'aeiou'.includes(middle!) &&
    consonant(last!) && !'wxy'.includes(last!);
}

function regularInflections(word: string): Set<string> {
  const forms = new Set<string>([word]);
  if (!/^[a-z]+$/.test(word) || word.length < 2) return forms;

  if (/[^aeiou]y$/.test(word)) {
    forms.add(`${word.slice(0, -1)}ies`);
    forms.add(`${word.slice(0, -1)}ied`);
  } else if (/(s|x|z|ch|sh)$/.test(word)) {
    forms.add(`${word}es`);
  } else {
    forms.add(`${word}s`);
  }

  if (word.endsWith('f')) forms.add(`${word.slice(0, -1)}ves`);
  if (word.endsWith('fe')) forms.add(`${word.slice(0, -2)}ves`);

  if (word.endsWith('e')) forms.add(`${word}d`);
  else if (!/[^aeiou]y$/.test(word)) forms.add(shortCvc(word)
    ? `${word}${word.at(-1)}ed`
    : `${word}ed`);

  if (word.endsWith('ie')) forms.add(`${word.slice(0, -2)}ying`);
  else if (word.endsWith('e') && !word.endsWith('ee')) forms.add(`${word.slice(0, -1)}ing`);
  else forms.add(shortCvc(word)
    ? `${word}${word.at(-1)}ing`
    : `${word}ing`);

  return forms;
}

function morphologyEquivalentWord(left: string, right: string): boolean {
  if (left === right) return true;
  const leftLemma = irregularLemma.get(left);
  const rightLemma = irregularLemma.get(right);
  if (leftLemma && rightLemma && leftLemma === rightLemma) return true;
  if (leftLemma === right || rightLemma === left) return true;
  return regularInflections(left).has(right) || regularInflections(right).has(left);
}

function answerWords(value: string): string[] {
  return normalizeAnswer(value).match(/[a-z]+(?:'[a-z]+)?|\d+(?:\.\d+)?/g) ?? [];
}

function answersMatchMorphology(answer: string, response: string): boolean {
  const expected = answerWords(answer);
  const submitted = answerWords(response);
  return expected.length > 0 &&
    expected.length === submitted.length &&
    expected.every((word, index) => morphologyEquivalentWord(word, submitted[index]!));
}

function inSemanticFamily(word: string, family: readonly string[]): boolean {
  return family.some((member) => morphologyEquivalentWord(word, member));
}

function semanticWordConfidence(left: string, right: string): number {
  if (morphologyEquivalentWord(left, right)) return 1;
  return SEMANTIC_WORD_FAMILIES.some((family) =>
    inSemanticFamily(left, family) && inSemanticFamily(right, family))
    ? SEMANTIC_WORD_CONFIDENCE
    : 0;
}

function semanticConfidence(answer: string, response: string): number {
  const expectedPhrase = normalizeAnswer(answer);
  const submittedPhrase = normalizeAnswer(response);
  for (const family of SEMANTIC_PHRASE_FAMILIES) {
    if (family.includes(expectedPhrase) && family.includes(submittedPhrase)) {
      return SEMANTIC_PHRASE_CONFIDENCE;
    }
  }

  const expected = answerWords(answer);
  const submitted = answerWords(response);
  if (!expected.length || expected.length !== submitted.length) return 0;

  let confidence = 1;
  let semanticSubstitution = false;
  for (let index = 0; index < expected.length; index += 1) {
    const wordConfidence = semanticWordConfidence(expected[index]!, submitted[index]!);
    if (!wordConfidence) return 0;
    if (wordConfidence < 1) semanticSubstitution = true;
    confidence = Math.min(confidence, wordConfidence);
  }
  return semanticSubstitution ? confidence : 0;
}

export function evaluateAnswer(
  answer: string,
  response: string,
  options: AnswerMatchOptions = {},
): AnswerMatchResult {
  const strictness = options.strictness ?? DEFAULT_ANSWER_STRICTNESS;
  if (!isAnswerStrictness(strictness)) throw new RangeError('Answer strictness must be an integer from 1 through 4.');

  const expected = normalizeAnswer(answer);
  const submitted = normalizeAnswer(response);
  if (expected === submitted) {
    return { correct: true, reason: 'exact', similarity: 1, confidence: 1 };
  }

  const similarity = answerSimilarity(expected, submitted);

  if (strictness >= 3 && answersMatchMorphology(expected, submitted)) {
    return { correct: true, reason: 'linguistic', similarity, confidence: 0.98 };
  }

  if (strictness >= 2 && similarity >= similarityThreshold(expected.length)) {
    return { correct: true, reason: 'fuzzy', similarity, confidence: similarity };
  }

  if (strictness >= 4) {
    const confidence = semanticConfidence(expected, submitted);
    if (confidence >= SEMANTIC_CONFIDENCE_THRESHOLD) {
      return { correct: true, reason: 'semantic', similarity, confidence };
    }
  }

  return { correct: false, reason: 'incorrect', similarity, confidence: 0 };
}

export function isAnswerCorrect(
  answer: string,
  response: string,
  options: AnswerMatchOptions = {},
): boolean {
  return evaluateAnswer(answer, response, options).correct;
}
