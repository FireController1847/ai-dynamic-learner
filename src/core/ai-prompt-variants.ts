import { AI_BOUNDED_INFERENCE_PROMPT } from './ai-source-inference.ts';
import { AI_SOURCE_DIFFICULTY_PROMPT } from './ai-source-difficulty.ts';

export type AiPromptVariant = 'simple' | 'detailed';

/** Most learners use free AI chats; keep the default consistent in every app. */
export const DEFAULT_AI_PROMPT_VARIANT: AiPromptVariant = 'simple';

/** Compact prompt with the original generator's current JSON example, including
 * its format, targetApp, enabled content kinds, and any optional solver fields.
 * Keep the full generator available for capable models. */
export function simpleAiPrompt(detailed: string, application: string, task: string, requirements: readonly string[]): string {
  const examples = [...detailed.matchAll(/```json\s*([\s\S]*?)\s*```/gi)];
  const schema = examples.at(-1)?.[1]?.trim();
  if (!schema || !schema.includes('"format"')) return detailed;
  const needsConfidence = application === 'Review' || application === 'Guide';
  // Never make Simple mode silently drop the most important review metadata.
  if (needsConfidence && !schema.includes('"confidence"')) return detailed;
  return [
    'Create ' + application + ' content using only the study material in this AI conversation.',
    task,
    AI_BOUNDED_INFERENCE_PROMPT,
    AI_SOURCE_DIFFICULTY_PROMPT,
    'Follow these requirements:',
    ...requirements.map(item => '- ' + item),
    '- Keep every answer accurate and unambiguous. Do not invent filler, citations, links, or unrelated concepts.',
    ...(needsConfidence ? [
      '- REQUIRED even for Simple mode: Include a top-level confidence object with EXACTLY overallCoverage, examConfidence, subjectConfidence, studyConfidence (JSON integer percentages from 0 to 100), coverageExplanation, uncoveredSubjects, and confidenceExplanation.',
      '- Both explanations must be nonempty and at most 500 characters. uncoveredSubjects is [] or a list of specific missing topics (up to 1000 characters each). Audit the original source against generated content before estimating these values; never invent scores, omissions, or exam knowledge.',
    ] : []),
    '- SOURCE UNITS: If the original material explicitly labels modules, chapters, sections, or units, add sourceUnits with EXACTLY this structure per unit: {"kind":"unit","title":"Exact original unit title","itemNumbers":[1,2],"missingTopics":[]}. Replace the example with source-defined names and the correct kind. Assign EVERY item index (1-based) to one unit in original order, without overlap. If there are no explicit named units, set sourceUnits to [] or omit it. Do NOT substitute id, source, questionCount, or coverage for the required fields.',
    '- Preserve the indicated app, format, version, and expected fields. Return valid complete JSON; no commentary in the JSON.',
    '- If the source cannot support the requested number or scope, return fewer meaningful items and explain gaps in provided coverage/confidence fields.',
    'OUTPUT: Prefer a downloadable UTF-8 .json file; if files cannot be attached, provide the COMPLETE raw JSON as text. Never claim a file was attached when it was not.',
    'Use the following JSON as a STRUCTURAL EXAMPLE ONLY. Replace sample content with source-grounded content, and include all required fields:',
    '```json\n' + schema + '\n```',
    'Check JSON syntax and internal references before responding. Do not include the illustrative sample as an actual study item.',
  ].join('\n\n');
}
