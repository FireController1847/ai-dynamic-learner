import { isRecord } from './validation.ts';

export interface AiSubjectCoverage { subject: string; itemNumbers: number[] }

/** Validates the model's claimed links, not the truth of its claims against the source. */
export function parseAiSubjectCoverage(value: unknown, count: number): AiSubjectCoverage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 500) {
    throw new Error('Include a subject coverage inventory for every source topic.');
  }
  const names = new Set<string>();
  return value.map((entry: unknown, index): AiSubjectCoverage => {
    if (!isRecord(entry) || Object.keys(entry).some(key => !['subject', 'itemNumbers'].includes(key)) ||
      typeof entry.subject !== 'string' || !entry.subject.trim() || entry.subject.length > 160 ||
      !Array.isArray(entry.itemNumbers) || !entry.itemNumbers.length) {
      throw new Error('Coverage subject ' + (index + 1) + ' needs a subject and itemNumbers.');
    }
    const subject = entry.subject.trim();
    const normalized = subject.toLocaleLowerCase();
    if (names.has(normalized)) throw new Error('Duplicate coverage subject: ' + subject);
    names.add(normalized);
    const numbers: number[] = entry.itemNumbers;
    if (numbers.some(n => !Number.isInteger(n) || n < 1 || n > count) ||
      new Set(numbers).size !== numbers.length) {
      throw new Error('Coverage subject ' + (index + 1) + ' has invalid item references.');
    }
    return { subject, itemNumbers: numbers };
  });
}

export const AI_COMPLETE_COVERAGE_PROMPT = `CRITICAL EXAM COVERAGE CONTRACT:
- Inventory EVERY distinct subject, subtopic, learning objective, question, named process, and specific fact that the supplied source expects the learner to know. Preserve the source hierarchy. Study guides and exam review sheets are explicit coverage checklists: no heading, subheading, bullet, question, or objective may be silently skipped.
- If generating for a category, inventory and cover EVERY subject WITHIN THAT CATEGORY; do not replace specific topics with broad umbrella names.
- Generate at least one meaningful assessable item for each inventoried subject, even if it seems minor. A subject may link to multiple items; an item may test multiple subjects only when it genuinely does so. Do not claim a subject is covered by an unrelated item.
- Coverage is mandatory, not a sampling preference. Never sacrifice a source subject to satisfy a requested count, style preference, or category size. If a hard application limit prevents completeness, explicitly request dividing the source into batches; never claim exhaustive coverage.
- Before returning JSON, independently re-read the source, compare every source heading and study-guide line to your inventory and generated items, correct all omissions and inaccurate links.
- Return a top-level "coverage" array with one object per distinct subject: {"subject":"Exact, specific source topic","itemNumbers":[1,3]}. Numbers are 1-based positions in the generated cards/words/entries array. This inventory is for human confirmation; do not falsely claim it proves completeness.`;
