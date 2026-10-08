import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { isRecord } from '../../core/validation.ts';
import { AI_COVERAGE_INSTRUCTIONS, parseAiImportJson, type AiCardCoverage } from './ai-import-format.ts';
import { MAX_CARDS, MAX_CARD_TEXT_LENGTH } from './card-model.ts';
import { MAX_NAME_LENGTH } from './tree-model.ts';

export const FILL_BLANK_IMPORT_FORMAT = 'dynamic-learner-fill-in-the-blanks';
export type AiBlankStyle = 'focused' | 'connected';
export interface FillBlankCardsImport {
  title: string;
  cards: { text: string }[];
}

export function fillBlankAiPrompt(coverage: AiCardCoverage, limit: number, style: AiBlankStyle): string {
  return `Using the source material I supplied immediately before this instruction, create a Dynamic Learner Fill in the Blanks set.

Write short, self-contained factual statements with important recall targets hidden as {{answer}}. The correct answer goes INSIDE the double braces; do not use underscores or a separate answer field.

Make each card a useful recall challenge:
- Almost ALWAYS use exactly ONE word per blank: a meaningful term, name, date, or quantity. Use 2–3 words only when absolutely necessary to preserve an indivisible term or an unambiguous, factually correct answer. Do not expand a blank merely because a longer phrase sounds natural; keep the surrounding words visible instead.
- When recalling multiple separate items, give each item its own one-word blank and leave the connector visible: {{letters}} and {{numbers}}, or {{letters}} or {{numbers}}, as the source meaning requires. Prefer this standard "___ and ___" / "___ or ___" structure over hiding an entire list or putting several items inside one blank. Never use "and" and "or" interchangeably when that changes the meaning.
- ${style === 'focused' ? 'Use exactly ONE focused blank in a concise statement per card.' : 'Build each card around a small group of related statements about one concept, usually 2–3 short statements with about 3–6 meaningful blanks total. Multiple blanks may belong to one statement. Separate the statements with a blank line for easy scanning. Use fewer blanks when the material is simple; do not force extra blanks or make the context ambiguous.'}
- Keep enough visible context to identify each answer clearly, without repeating or giving away the hidden answer elsewhere on the card.
- Keep each statement concise and readable on an index card; do not turn the card into a dense paragraph or an entire lesson.
- Hide the concept worth remembering, not arbitrary filler, articles, or connecting words.
- Split unrelated facts into separate cards. Avoid hiding a whole sentence or leaving a card made entirely of blanks.
- Keep grammar natural after the answers are restored, and preserve factual accuracy and exact terminology.
- Silently choose a consistent answer vocabulary for the entire set before writing the cards. For each repeated concept, use the source's preferred full term consistently, with the same spelling and abbreviation choice; do not switch between synonyms, shortened names, or different wording for the same answer.
- Keep the blank boundaries consistent too: hide the same meaningful term each time, not the full term on one card and only part of it on another. For example, if the source calls a concept "nullword", use {{nullword}} throughout rather than alternating with {{null}}. Adjust the visible sentence to fit the chosen answer naturally.
- Preserve distinctions between genuinely different concepts. Change singular/plural or grammatical form only when the sentence requires it; consistency must not introduce factual or grammatical errors.
- Do not invent facts, add citations, URLs, source markers, explanations, headings, IDs, or app settings.
- Do not use nested braces, empty blanks, newlines inside a blank, or any brace characters outside {{answer}} markers.

Coverage: ${AI_COVERAGE_INSTRUCTIONS[coverage]}
Create at most ${limit} cards. Use fewer if the source does not support that many useful recall targets; never pad with filler.

Return ONLY one JSON code block with this exact structure:
\`\`\`json
{
  "format": "${FILL_BLANK_IMPORT_FORMAT}",
  "version": 1,
  "title": "Short set title",
  "cards": [
    { "text": "The chemical symbol for gold is {{Au}}." }
  ]
}
\`\`\`

The example demonstrates syntax only; generate cards from my source using the selected blank style. Encode paragraph breaks inside the JSON text string as \\n\\n.
Use only the fields shown. The title must be 1–${MAX_NAME_LENGTH} characters. Include 1–${Math.min(limit, MAX_CARDS)} cards. Each text must be non-empty plain text of at most ${MAX_CARD_TEXT_LENGTH} characters, including the blank markers.`;
}

export function parseFillBlankAiImport(text: string): FillBlankCardsImport {
  const value = parseAiImportJson(text);
  if (!isRecord(value) ||
      Object.keys(value).some(key => !['format', 'version', 'title', 'cards'].includes(key)) ||
      value.format !== FILL_BLANK_IMPORT_FORMAT || value.version !== 1 ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH) {
    throw new Error('This is not a supported Fill in the Blanks import. Use the generated Fill in the Blanks prompt.');
  }
  if (!Array.isArray(value.cards) || !value.cards.length || value.cards.length > MAX_CARDS) {
    throw new Error(`Include 1–${MAX_CARDS} Fill in the Blanks cards.`);
  }
  const entries: unknown[] = value.cards;
  const cards = entries.map((card, index) => {
    if (!isRecord(card) || Object.keys(card).some(key => key !== 'text') ||
        typeof card.text !== 'string' || !card.text.trim() || card.text.length > MAX_CARD_TEXT_LENGTH) {
      throw new Error(`Card ${index + 1} needs plain text of at most ${MAX_CARD_TEXT_LENGTH} characters, with no extra fields.`);
    }
    const source = card.text.trim();
    const template = parseFillBlankTemplate(source);
    if (!template.answers.length || /\{\{[^{}]*[\r\n][^{}]*\}\}/u.test(source) ||
        template.segments.some(segment => segment.type === 'text' && /[{}]/u.test(segment.text))) {
      throw new Error(`Card ${index + 1} needs at least one valid {{answer}} blank. Blanks cannot be empty, nested, or span multiple lines.`);
    }
    if (!template.segments.some(segment => segment.type === 'text' && /[\p{L}\p{N}]/u.test(segment.text))) {
      throw new Error(`Card ${index + 1} needs visible context outside its blanks.`);
    }
    return { text: source };
  });
  return { title: value.title.trim(), cards };
}
