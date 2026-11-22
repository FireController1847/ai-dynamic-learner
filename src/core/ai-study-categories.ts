import { isRecord } from './validation.ts';
import { AI_BOUNDED_INFERENCE_PROMPT } from './ai-source-inference.ts';
import { AI_SOURCE_DIFFICULTY_PROMPT } from './ai-source-difficulty.ts';
import { assertAiTarget, type AiTargetApp } from './ai-app-identity.ts';
import { aiFileOutputInstructions } from './ai-file-output.ts';
import { AI_SOURCE_UNITS_PROMPT } from './ai-source-units.ts';
import { parseAiImportJson } from './ai-json.ts';
const MAX_NAME_LENGTH = 120;

export const STUDY_CATEGORIES_FORMAT = 'dynamic-learner-index-card-categories';
export const MAX_CATEGORIES = 40;
export interface AiCardCategory { key: string; title: string; description: string }
export interface AiCardCategories { title: string; categories: AiCardCategory[] }
export interface AiCardScope { subject: string; category: AiCardCategory }

export function studyCategoriesPrompt(product = 'Index Cards', targetApp: AiTargetApp = 'index-cards'): string {
  return `Using the source material I supplied immediately before this instruction, organize categories for Dynamic Learner ${product}. This step ONLY proposes categories; I will select one before generating study content.

- Prefer the FEWEST useful categories that cover the source. Combine related short sections and overlapping topics; don't create a category for every heading. Keep genuinely different major topics separate.
- Preserve explicitly named chapters, modules and sections in their original order. Do not merge distinct source units or invent missing unit headings; you may group closely related topics *within* each unit. Resolve shorthand or uncertain labels from the actual content (e.g. "Carbohydrate (Issues?)" becomes "Carbohydrate Disorders" ONLY if disorders are covered).
- Keep categories minimal, but ACCOUNT FOR EVERY subject, subtopic, study-guide objective, question, and bullet in the source. Merging related material must NEVER drop a concept. Think like an instructor when grouping, without inventing unsupported content or filler.
- Descriptions: one short plain-text phrase (3–8 words, at most 80 characters). No overlap, citations, Markdown, math markup, or application settings.
- ${AI_BOUNDED_INFERENCE_PROMPT}
- ${AI_SOURCE_DIFFICULTY_PROMPT}
- ${AI_SOURCE_UNITS_PROMPT}

${aiFileOutputInstructions("dynamic-learner-categories.json")}

The JSON file must match this structure:
\`\`\`json
{
  "format": "${STUDY_CATEGORIES_FORMAT}",
  "targetApp": "${targetApp}",
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
  return JSON.stringify({ format: STUDY_CATEGORIES_FORMAT, version: 1, ...value }, null, 2);
}

export function parseStudyCategories(text: string, targetApp?: AiTargetApp): AiCardCategories {
  const value = parseAiImportJson(text);
  if (targetApp) assertAiTarget(value, targetApp);
  if (!isRecord(value) || Object.keys(value).some(key => !['format', 'targetApp', 'version', 'title', 'categories'].includes(key)) ||
      value.format !== STUDY_CATEGORIES_FORMAT || value.version !== 1 ||
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
