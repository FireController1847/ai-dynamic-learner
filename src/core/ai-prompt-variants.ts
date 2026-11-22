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
  const filename = detailed.match(/\bnamed\s+([a-z0-9-]+\.json)\b/i)?.[1];
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
    ...(schema.includes('"sourceUnits"') ? [
      '- SOURCE UNITS: If the original material explicitly labels modules, chapters, sections, or units, add sourceUnits with EXACTLY this structure per unit: {"kind":"unit","title":"Exact original unit title","itemNumbers":[1,2],"missingTopics":[]}. Replace the example with source-defined names and the correct kind. Assign EVERY item index (1-based) to one unit in original order, without overlap. If there are no explicit named units, set sourceUnits to [] or omit it. Do NOT substitute id, source, questionCount, or coverage for the required fields.',
    ] : []),
    '- Preserve the indicated app, format, version, and expected fields. Return valid complete JSON; no commentary in the JSON.',
    ...(application === 'Review' ? [
      '- QUESTION COUNT: Generate EXACTLY the requested number of distinct, valid, source-grounded questions whenever the source supports them. Count the completed questions array. If fewer than requested, add distinct useful questions when possible. Return fewer ONLY when the source genuinely cannot support that count without fabrication or repetition, and explain that limitation in confidence.coverageExplanation. Do not shorten the response merely for convenience.',
    ] : []),
    '- If the source genuinely cannot support the requested quantity, return fewer meaningful items without inventing filler; explain real omissions in the available coverage/confidence fields.',
    'MANDATORY OUTPUT: Create and attach ONE downloadable UTF-8 .json file' +
      (filename ? ' named ' + filename : '') +
      ' containing the ENTIRE complete JSON object in the schema below. It must be valid, parseable JSON. Do not truncate, split, or return a sample, summary, fragment, corrected fields only, or JSON patch.',
    'ONLY IF this AI environment cannot technically attach an actual file: briefly explain the limitation and return the ENTIRE complete JSON object as raw text, ready to save as a .json file. Never claim a file was attached if it was not.',
    'Use the following JSON as a STRUCTURAL EXAMPLE ONLY. Replace sample content with source-grounded content, and include all required fields:',
    '```json\n' + schema + '\n```',
    'FINAL FORMAT CHECK: Verify format, targetApp, version, and all mandatory fields and item references. ' +
    'Verify the finished items array matches the requested quantity whenever the source supports it. ' +
    (needsConfidence ? 'Verify confidence is present with all FOUR integer percentages (0–100), both nonempty explanations, and an uncoveredSubjects array (use [] when no specific omission is known). ' : '') +
    'Validate the full JSON before attaching the file. Do not include example data as study material.',
  ].join('\n\n');
}
