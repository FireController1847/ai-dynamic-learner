export const MAX_AI_IMPORT_LENGTH = 4 * 1024 * 1024;

export function parseAiImportJson(text: string): unknown {
  if (text.length > MAX_AI_IMPORT_LENGTH) throw new Error('The pasted response is too large (maximum 4 MiB of text).');
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  try { return JSON.parse(fence?.[1] ?? trimmed) as unknown; }
  catch { throw new Error('Paste one valid JSON object or JSON code block, without surrounding commentary.'); }
}
