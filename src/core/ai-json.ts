export const MAX_AI_IMPORT_LENGTH = 4 * 1024 * 1024;

export function parseAiImportJson(text: string): unknown {
  if (text.length > MAX_AI_IMPORT_LENGTH) throw new Error('The pasted response is too large (maximum 4 MiB of text).');
  const trimmed = text.trim();
  if (!trimmed) throw new Error('No AI response was provided. Upload the generated file or paste the complete JSON.');
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  try { return JSON.parse(fence?.[1] ?? trimmed) as unknown; }
  catch (error) {
    const reason = error instanceof Error ? error.message : '';
    if (/Unexpected end|unterminated|end of JSON/i.test(reason))
      throw new Error('The response appears cut off. Ask your AI to finish the JSON or send a smaller complete batch.');
    throw new Error('The response contains invalid JSON syntax. Ask your AI to fix the quotes, commas, and brackets and send one complete JSON object.');
  }
}
