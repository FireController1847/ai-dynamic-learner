import { parseAiImportJson, MAX_AI_IMPORT_LENGTH } from './ai-json.ts';
import { isRecord } from './validation.ts';
import { assertAiTarget, type AiTargetApp } from './ai-app-identity.ts';

export interface AiResponseIssue { item?: number; message: string; source?: string }
export interface AiRecoveryReport { issues: AiResponseIssue[]; notices: string[] }

function removeTrailingCommas(text: string): string {
  let result = '', quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      result += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') {
      quoted = true; result += char;
    } else if (char === ',') {
      let next = i + 1;
      while (next < text.length && /\s/.test(text[next])) next++;
      if (text[next] !== '}' && text[next] !== ']') result += char;
    } else result += char;
  }
  return result;
}

function parseLoose(text: string): unknown {
  try { return JSON.parse(text) as unknown; }
  catch { return JSON.parse(removeTrailingCommas(text)) as unknown; }
}

/** Find a complete object/array, respecting JSON strings and nested delimiters. */
function endOfValue(text: string, start: number): number {
  const stack: string[] = [];
  let quoted = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{' || char === '[') stack.push(char);
    else if (char === '}' || char === ']') {
      if (stack.pop() !== (char === '}' ? '{' : '[')) return -1;
      if (!stack.length) return i + 1;
    }
  }
  return -1;
}

function looksLikeResponse(value: unknown, field: string): boolean {
  return Array.isArray(value) || (isRecord(value) && Array.isArray(value[field]));
}

export interface RawAiEntry { number: number; value?: unknown; invalid?: string; source: string }
export interface AiResponseSource { envelope: Record<string, unknown>; entries: RawAiEntry[]; incomplete: boolean; changed: boolean }

function completeSource(value: unknown, changed: boolean, field: string): AiResponseSource {
  const envelope = Array.isArray(value) ? { [field]: value } : value;
  if (!isRecord(envelope) || !Array.isArray(envelope[field])) throw new Error('No content was found in the AI response. Paste the full response or attach its file.');
  return { envelope, entries: envelope[field].map((entry: unknown, index: number) => ({
    number: index + 1, value: entry, source: JSON.stringify(entry) ?? '',
  })), incomplete: false, changed };
}

/** Recover completed array elements from an interrupted or malformed envelope.
 * Never invent the missing tail, close a partial question, or infer an answer. */
function recoverArray(text: string, start: number, envelope: Record<string, unknown>): AiResponseSource {
  const entries: RawAiEntry[] = [];
  let cursor = start + 1, closed = false;
  while (cursor < text.length) {
    while (cursor < text.length && /[\s,]/.test(text[cursor])) cursor++;
    if (text[cursor] === ']') { closed = true; break; }
    if (cursor >= text.length) break;
    const number = entries.length + 1;
    if (text[cursor] !== '{') {
      entries.push({ number, invalid: 'This item is not a complete JSON object.', source: text.slice(cursor, cursor + 2000) });
      break;
    }
    const end = endOfValue(text, cursor);
    if (end < 0) {
      entries.push({ number, invalid: 'The response ended or became malformed in this item.', source: text.slice(cursor, cursor + 2000) });
      break;
    }
    const source = text.slice(cursor, end);
    try { entries.push({ number, value: parseLoose(source), source }); }
    catch { entries.push({ number, invalid: 'This item could not be read.', source }); }
    cursor = end;
  }
  return { envelope, entries, incomplete: !closed || entries.some(entry => Boolean(entry.invalid)), changed: true };
}

export function readAiResponse(text: string, field: string): AiResponseSource {
  if (text.length > MAX_AI_IMPORT_LENGTH) throw new Error('This response is too large. Ask for a smaller batch.');
  const trimmed = text.trim().replace(/^\uFEFF/, '');
  if (!trimmed) throw new Error('Paste or upload the response from your AI first.');
  let parsed: unknown;
  let complete = false;
  try { parsed = JSON.parse(trimmed) as unknown; complete = true; } catch { /* Recover below. */ }
  if (complete) {
    if (looksLikeResponse(parsed, field)) return completeSource(parsed, false, field);
    throw new Error('The response does not contain the requested content.');
  }

  const fences = [...trimmed.matchAll(/(?:^|\n)\s*```(?:json)?[ \t]*\r?\n([\s\S]*?)(?:\r?\n\s*```|$)/gi)].map(match => match[1].trim());
  const blocks = fences.length ? fences : [trimmed];
  const found: AiResponseSource[] = [];
  for (const block of blocks) {
    const first = block.search(/[\[{]/);
    if (first < 0) continue;
    const end = endOfValue(block, first);
    if (end > first) {
      try {
        const value = parseLoose(block.slice(first, end));
        if (looksLikeResponse(value, field)) { found.push(completeSource(value, true, field)); continue; }
      } catch { /* Recover independently complete questions below. */ }
    }
    if (block[first] === '[') {
      const result = recoverArray(block, first, {});
      if (result.entries.length) found.push(result);
      continue;
    }
    // Only recognize the content property at the root, never text inside a question.
    let depth = 0, quoted = false, escaped = false, keyStart = -1;
    for (let i = first; i < block.length; i++) {
      const char = block[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') {
          quoted = false;
          if (depth === 1 && keyStart >= 0 && block.slice(keyStart, i + 1) === JSON.stringify(field)) {
            const match = /^\s*:\s*\[/.exec(block.slice(i + 1));
            if (match) {
              const arrayStart = i + match[0].length;
              const prefix = block.slice(first, keyStart).trimEnd().replace(/,\s*$/, '');
              let envelope: Record<string, unknown> = {};
              try {
                const header = parseLoose(prefix + '}');
                if (isRecord(header)) envelope = header;
              } catch { /* Header is optional for recovery. */ }
              found.push(recoverArray(block, arrayStart, envelope));
              break;
            }
          }
        }
      } else if (char === '"') { quoted = true; keyStart = i; }
      else if (char === '{' || char === '[') depth++;
      else if (char === '}' || char === ']') depth--;
    }
  }
  if (found.length !== 1) throw new Error(found.length > 1
    ? 'More than one possible AI response was found. Paste the one you want to use, separately.'
    : 'No usable content was found. If the AI stopped early or only gave an explanation, ask it to return the requested response.');
  return found[0];
}


export interface AiCollectionOptions<T> {
  field: string;
  targetApp?: AiTargetApp;
  formats: readonly string[];
  versions?: readonly number[];
  title: string;
  parse: (text: string) => T;
  validateItem: (entry: unknown, envelope: Record<string, unknown>) => string;
  checkEnvelope?: (envelope: Record<string, unknown>) => void;
  conflicts?: (entry: unknown, kept: readonly unknown[]) => boolean;
  /** Rebuild a candidate from retained items; graph formats can preserve and validate their own relationships. */
  build?: (envelope: Record<string, unknown>, items: unknown[]) => Record<string, unknown>;
  requiredMetadata?: readonly string[];
  previous?: AiCollectionRecovery<T> | null;
  maxItems?: number;
}
export interface AiCollectionRecovery<T> extends AiRecoveryReport {
  candidate: T | null;
  envelope: Record<string, unknown> | null;
  items: unknown[];
  accepted: number;
}

function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }

export function recoverAiCollection<T>(text: string, options: AiCollectionOptions<T>): AiCollectionRecovery<T> {
  const previous = options.previous;
  const result: AiCollectionRecovery<T> = { candidate: previous?.candidate ?? null, envelope: previous?.envelope ?? null,
    items: previous?.items ?? [], accepted: previous?.accepted ?? 0, issues: [], notices: [] };
  try {
    // Full validation comes first. A valid response keeps its metadata and exact semantics.
    const source = readAiResponse(text, options.field);
    const raw = source.envelope;
    if (options.targetApp) assertAiTarget(raw, options.targetApp);
    if (raw.format !== undefined && !options.formats.includes(String(raw.format)))
      throw new Error('This response is for a different Dynamic Learner format.');
    if (raw.version !== undefined && (typeof raw.version !== 'number' || !(options.versions ?? [1]).includes(raw.version)))
      throw new Error('This response uses an unsupported format version.');
    options.checkEnvelope?.(raw);
    if (!previous && !source.incomplete) {
      try {
        const candidate = options.parse(text);
        const items = source.entries.map(entry => entry.value);
        result.candidate = candidate; result.envelope = raw; result.items = items; result.accepted = items.length;
        const missing = (options.requiredMetadata ?? []).filter(field => raw[field] === undefined);
        if (missing.length) result.notices.push('The AI omitted ' + missing.join(' and ') + '. Completeness is unverified.');
        return result;
      } catch { /* Recover below. */ }
    }
    if (source.changed) result.notices.push('Read content from a wrapped or malformed response.');
    if (source.incomplete) result.issues.push({ message: 'The response may have ended before all items were returned.' });
    const envelope: Record<string, unknown> = { ...raw, format: raw.format ?? options.formats[0], version: raw.version ?? options.versions?.[0] ?? 1,
      title: typeof raw.title === 'string' && raw.title.trim() && raw.title.trim().length <= 120 ? raw.title.trim() : options.title };
    if (envelope.title !== raw.title) result.notices.push('Missing or invalid title replaced with a safe default.');
    if (!previous && !source.incomplete && !source.entries.some(entry => entry.invalid)) {
      try {
        const candidate = options.parse(JSON.stringify({ ...envelope, [options.field]: source.entries.map(entry => entry.value) }));
        const missing = (options.requiredMetadata ?? []).filter(field => raw[field] === undefined);
        result.candidate = candidate; result.envelope = envelope;
        result.items = source.entries.map(entry => entry.value); result.accepted = result.items.length;
        if (missing.length) result.notices.push('The AI omitted ' + missing.join(' and ') + '. Completeness is unverified.');
        return result;
      } catch { /* Isolate invalid items and metadata below. */ }
    }
    const kept: unknown[] = [...(previous?.items ?? [])];
    const seen = new Set<string>();
    const base = previous?.envelope ?? envelope;
    for (const entry of kept) seen.add(options.validateItem(entry, base));
    for (const item of source.entries) {
      try {
        if (item.invalid) throw new Error(item.invalid);
        const key = options.validateItem(item.value, envelope);
        if (seen.has(key) || options.conflicts?.(item.value, kept)) {
          result.issues.push({ item: item.number, message: 'This item duplicates retained content.', source: item.source.slice(0, 3000) });
          continue;
        }
        if (kept.length >= (options.maxItems ?? Number.MAX_SAFE_INTEGER)) throw new Error('The configured item limit has been reached.');
        seen.add(key); kept.push(item.value);
      } catch (error) {
        result.issues.push({ item: item.number, message: errorText(error), source: item.source.slice(0, 3000) });
      }
    }
    if (!kept.length) {
      if (!result.issues.length) result.issues.push({ message: 'No valid items were found.' });
      return result;
    }
    const repaired = { ...base, [options.field]: kept } as Record<string, unknown>;
    if (repaired.coverage !== undefined || repaired.confidence !== undefined) {
      delete repaired.coverage; delete repaired.confidence;
      result.notices.push('Coverage and confidence estimates were omitted because the content was recovered or combined.');
    }
    for (const field of options.requiredMetadata ?? []) {
      if (repaired[field] === undefined && !result.notices.some(note => note.includes(field))) result.notices.push('The AI’s ' + field + ' is unavailable.');
    }
    result.items = kept; result.envelope = repaired; result.accepted = kept.length;
    const rebuilt = options.build ? options.build(repaired, kept) : repaired;
    result.envelope = rebuilt;
    try { result.candidate = options.parse(JSON.stringify(rebuilt)); }
    catch (error) {
      result.issues.push({ message: errorText(error) });
      result.candidate = null;
    }
    if (!result.issues.length && !result.notices.length) result.notices.push('Recovered a usable response.');
    return result;
  } catch (error) {
    result.issues.push({ message: errorText(error) });
    return result;
  }
}

export function aiRepairPrompt(report: AiRecoveryReport, label: string, field: string, accepted: number, append: boolean,
  format?: string, targetApp?: string): string {
  const details = report.issues.slice(0, 15).map(issue => (issue.item ? 'Item ' + issue.item + ': ' : '') + issue.message +
    (issue.source ? '\nOriginal item: ' + issue.source : '')).join('\n\n').slice(0, 22000);
  return 'Fix your previous Dynamic Learner ' + label + ' response using the original study material and original instructions. ' +
    (format ? 'Use format "' + format + '", the same schema version, and ' : 'Preserve the original schema and ') +
    (targetApp ? 'targetApp "' + targetApp + '". ' : 'the correct app identifier. ') +
    (append && accepted ? 'Return ONLY corrected or missing items in the "' + field + '" array, with the same format, version and scope. Do not repeat the ' + accepted + ' accepted items. '
      : 'Return the COMPLETE corrected response in the same format, version and scope. Preserve all valid existing content. ') +
    'Return a COMPLETE valid UTF-8 .json file, or raw JSON if file attachment is unavailable. Do not include surrounding commentary. Do not invent facts, answers, or filler. ' +
    'Check all structural requirements and references before replying.\n\n' + details;
}


/** Standalone structured objects (e.g. solver packages) must be complete. */
export function recoverAiObject(text: string): unknown {
  if (text.length > MAX_AI_IMPORT_LENGTH) throw new Error('This response is too large.');
  try { return parseAiImportJson(text); } catch { /* Try a complete wrapped object. */ }
  const trimmed = text.trim().replace(/^\uFEFF/, '');
  const fence = [...trimmed.matchAll(/(?:^|\n)\s*```(?:json)?[ \t]*\r?\n([\s\S]*?)(?:\r?\n\s*```|$)/gi)];
  const blocks = fence.length ? fence.map(match => match[1]) : [trimmed];
  const values: unknown[] = [];
  for (const block of blocks) {
    const start = block.indexOf('{');
    if (start < 0) continue;
    const end = endOfValue(block, start);
    if (end < 0) continue;
    try { values.push(parseLoose(block.slice(start, end))); } catch { /* Never complete missing object fields. */ }
  }
  if (values.length !== 1) throw new Error('The response must contain one complete structured object.');
  return values[0];
}
