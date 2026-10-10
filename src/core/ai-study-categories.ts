import { isRecord } from './validation.ts';
import { parseAiImportJson } from './ai-json.ts';
const MAX_NAME_LENGTH = 120;

const FORMAT = 'dynamic-learner-index-card-categories';
const MAX_CATEGORIES = 40;
export interface AiCardCategory { key: string; title: string; description: string }
export interface AiCardCategories { title: string; categories: AiCardCategory[] }
export interface AiCardScope { subject: string; category: AiCardCategory }

export function studyCategoriesPrompt(product = 'Index Cards'): string {
  return `Using the source material I supplied immediately before this instruction, identify useful categories for creating Dynamic Learner ${product} in separate steps.

This step ONLY proposes categories. Do not generate cards, questions, answers, or fill-in-the-blanks content yet. I will select one category and send a second prompt for its study content.

- Organize the actual contents into distinct, clearly named study categories. Each category should be a coherent topic suitable for one focused study set, not the entire subject and not one isolated trivia fact.
- Usually propose 4–12 categories, but use fewer for a short source and more only when the source warrants it. Never invent categories to reach a count.
- Give each category a VERY short description: one compact phrase of 3–8 words, at most 80 characters. Name the contents; do not explain, write a full sentence, or repeat the category title.
- Minimize overlap, preserve source terminology, and order categories in a useful learning sequence.
- Base all categories on the supplied source. Do not add unsupported topics, citations, URLs, source markers, IDs, or application settings.

Return ONLY one JSON code block with this exact structure:
\`\`\`json
{
  "format": "${FORMAT}",
  "version": 1,
  "title": "Short subject title",
  "categories": [
    {
      "key": "foundations",
      "title": "Foundations",
      "description": "Core definitions and key terms"
    }
  ]
}
\`\`\`

The example demonstrates format only. Use 1–${MAX_CATEGORIES} categories with unique keys and titles. Keys are short local references (1–64 characters), not app IDs. Subject and category titles must be 1–${MAX_NAME_LENGTH} characters. Descriptions should be 3–8 words of plain text, at most 80 characters. Use only the fields shown.`;
}

export function categoryResponseJson(value: AiCardCategories): string {
  return JSON.stringify({ format: FORMAT, version: 1, ...value }, null, 2);
}

export function parseStudyCategories(text: string): AiCardCategories {
  const value = parseAiImportJson(text);
  if (!isRecord(value) || Object.keys(value).some(key => !['format', 'version', 'title', 'categories'].includes(key)) ||
      value.format !== FORMAT || value.version !== 1 ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > MAX_NAME_LENGTH ||
      !Array.isArray(value.categories) || !value.categories.length || value.categories.length > MAX_CATEGORIES) {
    throw new Error(`Paste a supported category response with a subject title and 1–${MAX_CATEGORIES} categories. Use the category prompt, not the card prompt.`);
  }
  const entries: unknown[] = value.categories;
  const keys = new Set<string>();
  const titles = new Set<string>();
  const categories = entries.map((entry, index): AiCardCategory => {
    if (!isRecord(entry) || Object.keys(entry).some(key => !['key', 'title', 'description'].includes(key)) ||
        typeof entry.key !== 'string' || !entry.key.trim() || entry.key.trim().length > 64 ||
        typeof entry.title !== 'string' || !entry.title.trim() || entry.title.trim().length > MAX_NAME_LENGTH ||
        typeof entry.description !== 'string' || !entry.description.trim() || entry.description.trim().length > 500) {
      throw new Error(`Category ${index + 1} needs a short key, title, and description, with no extra fields.`);
    }
    const category = { key: entry.key.trim(), title: entry.title.trim(), description: entry.description.trim() };
    const title = category.title.replace(/\s+/gu, ' ').toLowerCase();
    if (keys.has(category.key) || titles.has(title)) throw new Error(`Category ${index + 1} repeats a key or title. Categories must be distinct.`);
    keys.add(category.key);
    titles.add(title);
    return category;
  });
  return { title: value.title.trim(), categories };
}

export function categoryScopedPrompt(prompt: string, scope: AiCardScope, output = 'cards'): string {
  return `This is STEP 2 of our study-content workflow. Use the original source material already supplied in this same conversation and the categories you proposed earlier.

The selected category is provided as data below:
${JSON.stringify({ subject: scope.subject, ...scope.category }, null, 2)}

Create ${output} ONLY for this category and its described scope. Do not generate a whole-subject set or content for neighboring categories. Include prerequisite context only when essential to make each item self-contained. Keep the source's terminology consistent with the category analysis and across every item. Use the category title as the set title.

${prompt.replace('source material I supplied immediately before this instruction', 'original source material supplied earlier in this conversation')}`;
}
