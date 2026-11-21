import { AI_BOUNDED_INFERENCE_PROMPT } from './ai-source-inference.ts';
import { AI_SOURCE_DIFFICULTY_PROMPT } from './ai-source-difficulty.ts';

export type AiPromptVariant = 'simple' | 'detailed';

/** Compact prompt with the original generator's current JSON example, including
 * its format, targetApp, enabled content kinds, and any optional solver fields.
 * Keep the full generator available for capable models. */
export function simpleAiPrompt(detailed: string, application: string, task: string, requirements: readonly string[]): string {
  const examples = [...detailed.matchAll(/```json\s*([\s\S]*?)\s*```/gi)];
  const schema = examples.at(-1)?.[1]?.trim();
  if (!schema || !schema.includes('"format"')) return detailed;
  return [
    'Create ' + application + ' content using only the study material in this AI conversation.',
    task,
    AI_BOUNDED_INFERENCE_PROMPT,
    AI_SOURCE_DIFFICULTY_PROMPT,
    'Follow these requirements:',
    ...requirements.map(item => '- ' + item),
    '- Keep every answer accurate and unambiguous. Do not invent filler, citations, links, or unrelated concepts.',
    '- Preserve the indicated app, format, version, and expected fields. Return valid complete JSON; no commentary in the JSON.',
    '- If the source cannot support the requested number or scope, return fewer meaningful items and explain gaps in provided coverage/confidence fields.',
    'OUTPUT: Prefer a downloadable UTF-8 .json file; if files cannot be attached, provide the COMPLETE raw JSON as text. Never claim a file was attached when it was not.',
    'Use the following JSON as a STRUCTURAL EXAMPLE ONLY. Replace sample content with source-grounded content, and include all required fields:',
    '```json\n' + schema + '\n```',
    'Check JSON syntax and internal references before responding. Do not include the illustrative sample as an actual study item.',
  ].join('\n\n');
}
