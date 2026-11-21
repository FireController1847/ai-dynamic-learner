import { parseAiImportJson } from '../../core/ai-json.ts';
import { aiFileOutputInstructions } from '../../core/ai-file-output.ts';
export { parseAiImportJson, MAX_AI_IMPORT_LENGTH } from '../../core/ai-json.ts';
import { isRecord } from '../../core/validation.ts';
import { assertAiTarget } from '../../core/ai-app-identity.ts';
import { parseAiSubjectCoverage, type AiSubjectCoverage } from '../../core/ai-subject-coverage.ts';
import { aiCoverageInstructions, type AiCoverageLevel } from '../../core/ai-coverage.ts';
import { AI_PLAIN_TEXT_ONLY_GUIDANCE } from '../../core/ai-formatting-guidance.ts';
import { MAX_CARDS, MAX_CARD_TEXT_LENGTH } from './card-model.ts';
import { MAX_NAME_LENGTH } from './tree-model.ts';

export const FLASH_CARDS_IMPORT_FORMAT = 'dynamic-learner-flash-cards';

export type AiCardCoverage = AiCoverageLevel;
export interface FlashCardsImport {
  title: string;
  cards: { question: string; answer: string }[];
  coverage?: AiSubjectCoverage[];
}

export function flashCardsAiPrompt(coverage: AiCardCoverage, limit: number): string {
  return `Using the source material I supplied immediately before this instruction, create a Dynamic Learner Flash Cards set.

These are FLASH CARDS for quick recall, not a study guide, essay, or explanation exercise.

Answer brevity is the highest writing priority:
- Aim for 1–5 words per answer: a single term, name, date, number, or very short phrase.
- Use up to 10 words only when essential for factual accuracy. Never pad an answer to reach a word count.
- Ask one clear, specific question about one fact per card.
- If an answer needs a list, multiple clauses, a paragraph, or an explanation, split it into several focused question/answer cards instead.
- Avoid "explain", "discuss", "describe in detail", multi-part questions, and yes/no questions.
- Keep questions brief and self-contained; do not rely on another card or on "the passage above".
- Preserve exact terminology and accuracy. Never shorten an answer so far that it becomes misleading.
- Use only supported source information. Do not invent facts or add citations, references, URLs, or source markers.

${AI_PLAIN_TEXT_ONLY_GUIDANCE}

Coverage depth: ${aiCoverageInstructions(coverage)} This controls DETAIL, never subject inclusion.
Create at most ${limit} useful cards. Fewer is better if the source does not support that many; do not invent filler.
Do not create Fill in the Blanks, cloze syntax, card headings, explanations, IDs, groups, or application settings.

${aiFileOutputInstructions("dynamic-learner-flash-cards.json")}

The JSON file must match this structure:
\`\`\`json
{
  "format": "${FLASH_CARDS_IMPORT_FORMAT}",
  "targetApp": "index-cards",
  "version": 1,
  "title": "Short set title",
  "coverage": [{ "subject": "Chemical symbols", "itemNumbers": [1] }],
  "cards": [
    { "question": "What is the chemical symbol for gold?", "answer": "Au" }
  ]
}
\`\`\`

The example demonstrates format and brevity only; generate cards from my source.
Use only the fields shown. The title must be 1–${MAX_NAME_LENGTH} characters. Include 1–${Math.min(limit, MAX_CARDS)} cards. Questions and answers must be non-empty plain text, each at most ${MAX_CARD_TEXT_LENGTH} characters; the answer brevity rules above still apply.`;
}

export function parseFlashCardsAiImport(text: string): FlashCardsImport {
  const value = parseAiImportJson(text);
  assertAiTarget(value, 'index-cards');
  if (!isRecord(value) ||
      Object.keys(value).some(key => !['format', 'targetApp', 'version', 'title', 'cards', 'coverage'].includes(key)) ||
      value.format !== FLASH_CARDS_IMPORT_FORMAT || value.version !== 1 ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH) {
    throw new Error('This is not a supported Flash Cards import. Use the generated Flash Cards prompt.');
  }
  if (!Array.isArray(value.cards) || !value.cards.length || value.cards.length > MAX_CARDS) {
    throw new Error(`Include 1–${MAX_CARDS} flash cards.`);
  }
  const entries: unknown[] = value.cards;
  const cards = entries.map((card, index) => {
    if (!isRecord(card) || Object.keys(card).some(key => !['question', 'answer'].includes(key)) ||
        typeof card.question !== 'string' || !card.question.trim() || card.question.length > MAX_CARD_TEXT_LENGTH ||
        typeof card.answer !== 'string' || !card.answer.trim() || card.answer.length > MAX_CARD_TEXT_LENGTH) {
      throw new Error(`Card ${index + 1} needs a non-empty question and answer of at most ${MAX_CARD_TEXT_LENGTH} characters each, with no extra fields.`);
    }
    return { question: card.question.trim(), answer: card.answer.trim() };
  });
  const subjectCoverage = value.coverage === undefined ? undefined : parseAiSubjectCoverage(value.coverage, cards.length);
  return { title: value.title.trim(), cards, coverage: subjectCoverage };
}

export function answerIsLong(answer: string): boolean {
  return answer.split(/\s+/u).length > 10;
}
