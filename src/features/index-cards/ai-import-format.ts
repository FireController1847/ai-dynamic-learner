import { parseAiImportJson } from '../../core/ai-json.ts';
export { parseAiImportJson, MAX_AI_IMPORT_LENGTH } from '../../core/ai-json.ts';
import { isRecord } from '../../core/validation.ts';
import { MAX_CARDS, MAX_CARD_TEXT_LENGTH } from './card-model.ts';
import { MAX_NAME_LENGTH } from './tree-model.ts';

export const FLASH_CARDS_IMPORT_FORMAT = 'dynamic-learner-flash-cards';

export type AiCardCoverage = 'essentials' | 'balanced' | 'comprehensive';
export interface FlashCardsImport {
  title: string;
  cards: { question: string; answer: string }[];
}

export const AI_COVERAGE_INSTRUCTIONS: Record<AiCardCoverage, string> = {
  essentials: 'Only the core facts and terms worth memorizing.',
  balanced: 'Major ideas plus useful supporting facts; omit trivia and repetition.',
  comprehensive: 'Broad coverage of useful facts and distinctions, without duplicates or filler.',
};

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

Coverage: ${AI_COVERAGE_INSTRUCTIONS[coverage]}
Create at most ${limit} useful cards. Fewer is better if the source does not support that many; do not invent filler.
Do not create Fill in the Blanks, cloze syntax, card headings, explanations, IDs, groups, or application settings.

Return ONLY one JSON code block with this exact structure:
\`\`\`json
{
  "format": "${FLASH_CARDS_IMPORT_FORMAT}",
  "version": 1,
  "title": "Short set title",
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
  if (!isRecord(value) ||
      Object.keys(value).some(key => !['format', 'version', 'title', 'cards'].includes(key)) ||
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
  return { title: value.title.trim(), cards };
}

export function answerIsLong(answer: string): boolean {
  return answer.split(/\s+/u).length > 10;
}
