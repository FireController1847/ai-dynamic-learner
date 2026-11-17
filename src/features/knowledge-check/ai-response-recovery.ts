import { MAX_AI_IMPORT_LENGTH } from '../../core/ai-json.ts';
import { isRecord } from '../../core/validation.ts';
import { parseAiSolvers } from './ai-parameterized-format.ts';
import { parseReviewAiImport, REVIEW_AI_FORMAT, type ReviewAiImport, type ReviewAiPreferences } from './ai-import-format.ts';
import { AI_QUESTION_TYPES, allocateQuestions, questionMixProblem, questionTypeLabel } from './ai-question-mix.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import { MAX_TEXT, validateQuestions, type Question } from './question-model.ts';

export interface ReviewResponseIssue { item?: number; message: string; source?: string }
export interface ReviewResponseRecovery {
  candidate: ReviewAiImport | null;
  issues: ReviewResponseIssue[];
  recovered: number;
  received: number;
  notices: string[];
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Remove only commas immediately before a closing delimiter, outside strings. */
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

function looksLikeReview(value: unknown): boolean {
  return Array.isArray(value) || (isRecord(value) && Array.isArray(value.questions));
}

interface RawEntry { number: number; value?: unknown; invalid?: string; source: string }
interface ResponseSource { envelope: Record<string, unknown>; entries: RawEntry[]; incomplete: boolean; changed: boolean }

function completeSource(value: unknown, changed: boolean): ResponseSource {
  const envelope = Array.isArray(value) ? { questions: value } : value;
  if (!isRecord(envelope) || !Array.isArray(envelope.questions)) throw new Error('No Review questions were found. Paste the AI’s full response or attach its file.');
  return { envelope, entries: envelope.questions.map((entry: unknown, index: number) => ({
    number: index + 1, value: entry, source: JSON.stringify(entry) ?? '',
  })), incomplete: false, changed };
}

/** Recover completed array elements from an interrupted or malformed envelope.
 * Never invent the missing tail, close a partial question, or infer an answer. */
function recoverArray(text: string, start: number, envelope: Record<string, unknown>): ResponseSource {
  const entries: RawEntry[] = [];
  let cursor = start + 1, closed = false;
  while (cursor < text.length) {
    while (cursor < text.length && /[\s,]/.test(text[cursor])) cursor++;
    if (text[cursor] === ']') { closed = true; break; }
    if (cursor >= text.length) break;
    const number = entries.length + 1;
    if (text[cursor] !== '{') {
      entries.push({ number, invalid: 'This question is not a complete JSON object.', source: text.slice(cursor, cursor + 2000) });
      break;
    }
    const end = endOfValue(text, cursor);
    if (end < 0) {
      entries.push({ number, invalid: 'The response ended or became malformed in this question.', source: text.slice(cursor, cursor + 2000) });
      break;
    }
    const source = text.slice(cursor, end);
    try { entries.push({ number, value: parseLoose(source), source }); }
    catch { entries.push({ number, invalid: 'This question could not be read.', source }); }
    cursor = end;
  }
  return { envelope, entries, incomplete: !closed || entries.some(entry => Boolean(entry.invalid)), changed: true };
}

function readSource(text: string): ResponseSource {
  const trimmed = text.trim().replace(/^\uFEFF/, '');
  if (!trimmed) throw new Error('Paste or upload the response from your AI first.');
  try {
    const value = JSON.parse(trimmed) as unknown;
    if (looksLikeReview(value)) return completeSource(value, false);
  } catch { /* Find a wrapped or incomplete response below. */ }

  const fences = [...trimmed.matchAll(/(?:^|\n)\s*```(?:json)?[ \t]*\r?\n([\s\S]*?)(?:\r?\n\s*```|$)/gi)].map(match => match[1].trim());
  const blocks = fences.length ? fences : [trimmed];
  const found: ResponseSource[] = [];
  for (const block of blocks) {
    const first = block.search(/[\[{]/);
    if (first < 0) continue;
    const end = endOfValue(block, first);
    if (end > first) {
      try {
        const value = parseLoose(block.slice(first, end));
        if (looksLikeReview(value)) { found.push(completeSource(value, true)); continue; }
      } catch { /* Recover independently complete questions below. */ }
    }
    if (block[first] === '[') {
      const result = recoverArray(block, first, {});
      if (result.entries.length) found.push(result);
      continue;
    }
    // Only recognize a questions property at the root, never text inside a question.
    let depth = 0, quoted = false, escaped = false, keyStart = -1;
    for (let i = first; i < block.length; i++) {
      const char = block[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') {
          quoted = false;
          if (depth === 1 && keyStart >= 0 && block.slice(keyStart, i + 1) === '"questions"') {
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
    ? 'More than one possible Review response was found. Paste the one you want to use, separately.'
    : 'No Review questions were found. If the AI stopped early or only gave an explanation, ask it to return the questions or try a smaller request.');
  return found[0];
}

function normalizeEntry(value: unknown): { value: unknown; changed: boolean } {
  if (!isRecord(value)) return { value, changed: false };
  const entry = { ...value };
  if (typeof entry.type === 'string') {
    const normalized = entry.type.trim().toLowerCase().replace(/[\s_]+/g, '-');
    if (AI_QUESTION_TYPES.some(type => type === normalized)) entry.type = normalized;
  }
  if (entry.type === 'true-false') {
    if (entry.answer === true || (typeof entry.answer === 'string' && /^true$/i.test(entry.answer.trim()))) entry.answer = 'True';
    if (entry.answer === false || (typeof entry.answer === 'string' && /^false$/i.test(entry.answer.trim()))) entry.answer = 'False';
  }
  // These bookkeeping fields are not part of the question's meaning.
  for (const field of ['id', 'number', 'index']) delete entry[field];
  return { value: entry, changed: JSON.stringify(entry) !== JSON.stringify(value) };
}

export function recoverReviewResponse(text: string, preferences: ReviewAiPreferences): ReviewResponseRecovery {
  const result: ReviewResponseRecovery = { candidate: null, issues: [], recovered: 0, received: 0, notices: [] };
  try {
    if (text.length > MAX_AI_IMPORT_LENGTH) throw new Error('This response is too large. Ask for a smaller batch.');
    const source = readSource(text), envelope = source.envelope;
    if (envelope.format !== undefined && envelope.format !== REVIEW_AI_FORMAT) throw new Error('This response belongs to a different format, not Review.');
    if (envelope.version !== undefined && envelope.version !== 1) throw new Error('This Review response uses an unsupported version.');
    result.received = source.entries.length;
    if (source.changed) result.notices.push('Read questions from a wrapped or incomplete response.');
    if (source.incomplete) result.notices.push('The response may be incomplete. Only complete, validated questions can be used.');
    const title = typeof envelope.title === 'string' && envelope.title.trim() && envelope.title.trim().length <= MAX_NAME_LENGTH
      ? envelope.title.trim() : 'AI Review';
    const description = typeof envelope.description === 'string' && envelope.description.length <= MAX_TEXT ? envelope.description : '';
    if (title !== envelope.title || description !== envelope.description) result.notices.push('Missing or invalid set details were replaced with safe defaults.');
    const packages: ReturnType<typeof parseAiSolvers> = [];
    const blocked = new Set<string>();
    if (Array.isArray(envelope.solvers)) {
      for (const raw of envelope.solvers as unknown[]) {
        try {
          const [pkg] = parseAiSolvers([raw]);
          const identity = pkg.id + ':' + pkg.solverVersion;
          if (blocked.has(identity) || packages.some(item => item.id + ':' + item.solverVersion === identity)) {
            blocked.add(identity);
            const index = packages.findIndex(item => item.id + ':' + item.solverVersion === identity);
            if (index >= 0) packages.splice(index, 1);
            throw new Error('Duplicate solver identity.');
          }
          packages.push(pkg);
        } catch { result.notices.push('An invalid or duplicate solver package was skipped; dependent questions may need repair.'); }
      }
    } else if (envelope.solvers !== undefined) result.notices.push('The solver list was unreadable.');
    const base = { format: REVIEW_AI_FORMAT, version: 1, title, description };
    const questions: Question[] = [], accepted: unknown[] = [];
    const validationPreferences: ReviewAiPreferences = { ...preferences, count: 1, mixMode: 'ai' };
    for (const item of source.entries) {
      try {
        if (item.invalid) throw new Error(item.invalid);
        const normalized = normalizeEntry(item.value);
        // The existing strict parser remains the only way to construct questions.
        const question = normalized.value;
        // Ordinary questions do not need solver payloads. A broken or enormous
        // solver cannot multiply validation cost across the rest of the set.
        let relevantPackages: typeof packages = [];
        if (isRecord(question) && question.type === 'parameterized' && isRecord(question.parameters) &&
            isRecord(question.parameters.rules) && isRecord(question.parameters.rules.solver)) {
          const reference = question.parameters.rules.solver;
          const identity = String(reference.id) + ':' + String(reference.version);
          if (blocked.has(identity)) throw new Error('This question references conflicting solver packages.');
          relevantPackages = packages.filter(pkg => pkg.id + ':' + pkg.solverVersion === identity);
        }
        const parsed = parseReviewAiImport(JSON.stringify({ ...base, questions: [normalized.value], solvers: relevantPackages }), validationPreferences);
        questions.push(parsed.questions[0]); accepted.push(normalized.value);
        if (normalized.changed || source.changed) result.recovered++;
      } catch (error) {
        result.issues.push({ item: item.number, message: errorText(error).replace(/^Item 1(?=[: ]|$)/, 'Question'), source: item.source.slice(0, 3000) });
      }
    }
    if (!questions.length) {
      if (!result.issues.length) result.issues.push({ message: 'No complete questions were returned.' });
      return result;
    }
    validateQuestions(questions);
    const warnings: string[] = [];
    if (questions.length !== preferences.count) warnings.push('Requested ' + preferences.count + ' questions; ' + questions.length + ' are ready.');
    if (preferences.mixMode === 'custom' && !questionMixProblem(preferences.weights, preferences.count)) {
      const expected = allocateQuestions(preferences.weights, preferences.count);
      for (const type of AI_QUESTION_TYPES) {
        const actual = questions.filter(question => question.type === type).length;
        if (actual !== expected[type]) warnings.push(questionTypeLabel(type) + ': requested ' + expected[type] + ', received ' + actual + '.');
      }
    }
    let confidence: ReviewAiImport['confidence'] = null, coverage: ReviewAiImport['coverage'] = null;
    if (!source.incomplete && !result.issues.length) {
      for (const field of ['confidence', 'coverage'] as const) {
        if (envelope[field] === undefined) continue;
        try {
          const parsed = parseReviewAiImport(JSON.stringify({ ...base, questions: accepted, solvers: packages, [field]: envelope[field] }), { ...preferences, count: accepted.length, mixMode: 'ai' });
          if (field === 'confidence') confidence = parsed.confidence;
          else coverage = parsed.coverage;
        } catch { result.notices.push('The AI’s ' + field + ' summary could not be read and was left out.'); }
      }
    } else if (envelope.confidence !== undefined || envelope.coverage !== undefined) {
      result.notices.push('Coverage and confidence were not retained because some questions were missing.');
    }
    result.candidate = { title, description, questions, warnings, confidence, coverage };
  } catch (error) { result.issues.push({ message: errorText(error) }); }
  return result;
}

export function repairReviewPrompt(issues: readonly ReviewResponseIssue[], count: number): string {
  const details = issues.slice(0, 12).map(issue => (issue.item ? 'Question ' + issue.item + ': ' : '') +
    issue.message + (issue.source ? '\nOriginal item: ' + issue.source : '')).join('\n\n').slice(0, 22000);
  return 'Correct the following problems in your previous Dynamic Learner Review response using the original study material and original instructions. ' +
    'Return only the corrected or missing questions, NOT the already accepted questions. Return a valid Review version-1 JSON object or a bare JSON array of question objects. ' +
    'Include any required solver packages in the top-level solvers array. Do not invent answers, add filler, or change the original study scope. ' +
    'Return at most ' + Math.max(1, Number.isSafeInteger(count) ? count : 1) + ' questions; fewer is fine if the source does not support them.\n\n' + details;
}
