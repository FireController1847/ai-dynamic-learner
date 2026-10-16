import { isRecord } from './validation.ts';
import { parseAiImportJson } from './ai-json.ts';
const MAX_NAME_LENGTH = 120;

const FORMAT = 'dynamic-learner-index-card-categories';
const MAX_CATEGORIES = 40;
export interface AiCardCategory { key: string; title: string; description: string }
export interface AiCardCategories { title: string; categories: AiCardCategory[] }
export interface AiCardScope { subject: string; category: AiCardCategory }

export function studyCategoriesPrompt(product = 'Index Cards'): string {
  return `Using the source material I supplied immediately before this instruction, organize categories for Dynamic Learner ${product}. This step ONLY proposes categories; I will select one before generating study content.

- Follow the source's existing sections, chapters, units, or instructor-defined headings. Preserve their names, order, and scope. Do not invent subsections unless the source itself divides a section.
- When the source is unsectioned, group its actual topics as a teacher or course instructor naturally would for lessons or assessments. Use your knowledge of the subject to name sensible categories, NOT to add lessons or facts missing from the source.
- Keep categories distinct and meaningful, not tiny trivia fragments. Match the source's natural number of sections; do not force a count or add filler.
- Descriptions: one short plain-text phrase (3–8 words, at most 80 characters). No overlap, citations, markdown, math markup, or application settings.

Return ONLY one JSON code block:
\`\`\`json
{
  "format": "${FORMAT}",
  "version": 1,
  "title": "Subject title",
  "categories": [
    { "key": "section-1", "title": "Source section title", "description": "Topics covered in this source section" }
  ]
}
\`\`\`

Use 1–${MAX_CATEGORIES} categories with unique keys (1–64 characters) and titles (1–${MAX_NAME_LENGTH} characters). Subject title maximum ${MAX_NAME_LENGTH} characters. Example is structural only.`;
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
