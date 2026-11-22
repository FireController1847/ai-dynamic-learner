import { MAX_AI_IMPORT_LENGTH, parseAiImportJson } from '../../core/ai-json.ts';
import { assertAiTarget } from '../../core/ai-app-identity.ts';
import { recoverAiSourceUnits } from '../../core/ai-source-units.ts';
import { recoverAiConfidenceValues } from '../../core/ai-confidence-repair.ts';
import { readAiResponse, type AiResponseIssue } from '../../core/ai-response-recovery.ts';
import { isRecord } from '../../core/validation.ts';
import { parseAiSolvers } from './ai-parameterized-format.ts';
import { parseReviewAiImport, REVIEW_AI_FORMAT, type ReviewAiImport, type ReviewAiPreferences } from './ai-import-format.ts';
import { AI_QUESTION_TYPES, allocateQuestions, questionMixProblem, questionTypeLabel } from './ai-question-mix.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import { MAX_TEXT, validateQuestions, type Question } from './question-model.ts';

export type ReviewResponseIssue = AiResponseIssue;
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
    // Detect a different app even when its JSON does not have a questions array.
    try { assertAiTarget(parseAiImportJson(text), 'review'); }
    catch (error) {
      if (error instanceof Error && /generated for .*importing it into|identifies conflicting apps|Unknown AI target app/i.test(error.message)) throw error;
    }
    const source = readAiResponse(text, 'questions'), envelope = source.envelope;
    assertAiTarget(envelope, 'review');
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
    const base = { format: REVIEW_AI_FORMAT, targetApp: 'review', version: 1, title, description };
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
    if (source.incomplete && !result.issues.length) {
      result.issues.push({ message: 'The response ended before the question list was complete.' });
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
    let sourceUnits: ReviewAiImport['sourceUnits'] = undefined;
    if (!source.incomplete && !result.issues.length) {
      if (envelope.sourceUnits !== undefined) {
        const mapping = recoverAiSourceUnits(envelope.sourceUnits, questions.length);
        sourceUnits = mapping.units;
        for (const unit of sourceUnits ?? []) for (const n of unit.itemNumbers)
          questions[n - 1].sourceUnit = unit.title;
        if (mapping.notice) result.notices.push(mapping.notice);
        if (mapping.problem) result.notices.push('Source-unit mapping was skipped: ' +
          mapping.problem + ' The questions and confidence statistics were retained.');
      }
      // Source-unit problems must never erase valid, independent confidence scores.
      if (envelope.confidence !== undefined) {
        const parsed = recoverAiConfidenceValues(envelope.confidence);
        confidence = parsed.confidence;
        if (parsed.notice) result.notices.push(parsed.notice);
        if (parsed.problem) result.notices.push('The AI confidence could not be read: ' + parsed.problem);
      }
      if (envelope.coverage !== undefined) {
        try {
          coverage = parseReviewAiImport(JSON.stringify({ ...base, questions: accepted, solvers: packages,
            coverage: envelope.coverage }), { ...preferences, count: accepted.length, mixMode: 'ai' }).coverage;
        } catch (error) {
          result.notices.push('The AI subject-coverage list was skipped: ' + errorText(error));
        }
      }
    } else if (envelope.sourceUnits !== undefined || envelope.confidence !== undefined || envelope.coverage !== undefined) {
      result.notices.push('Coverage and confidence were not retained because some questions were missing.');
    }
    result.candidate = { title, description, questions, warnings, confidence, coverage,
      ...(sourceUnits ? { sourceUnits } : {}) };
  } catch (error) { result.issues.push({ message: errorText(error) }); }
  return result;
}

/** Fix a complete Review file; additional batches are a separate workflow. */
export function repairReviewPrompt(issues: readonly ReviewResponseIssue[], count: number,
  appendToExisting = false): string {
  const details = issues.slice(0, 12).map(issue => (issue.item ? 'Question ' + issue.item + ': ' : '') +
    issue.message + (issue.source ? '\nOriginal item: ' + issue.source : '')).join('\n\n').slice(0, 22000);
  return 'Fix the PREVIOUS Dynamic Learner Review JSON file using the original source and previous generation instructions. ' +
    'Return the COMPLETE corrected standalone version-1 Review JSON file with format "dynamic-learner-review", targetApp "review", title, description, ALL questions (including already-valid questions), and applicable solver packages, sourceUnits, coverage, and confidence metadata. ' +
    'Do NOT return only corrected fields, newly added questions, a bare array, an incremental reply, or a JSON patch. ' +
    'Preserve correct original questions and settings; change only what is necessary. ' +
    (appendToExisting ? 'This is an ADDITIONAL-question file for an existing saved set. Keep all valid questions from this previous generated file, but do NOT repeat questions already in the saved set. ' :
      'This is the complete replacement for the previously generated knowledge set. ') +
    'Generate exactly ' + Math.max(1, Number.isSafeInteger(count) ? count : 1) +
    ' distinct useful questions when the source supports them. Do not exceed that count or invent filler; explain genuine source limitations in confidence when fewer are possible. ' +
    'Include all four integer confidence scores, both explanations and uncoveredSubjects. Verify source-unit references against the final questions array. ' +
    'MANDATORY OUTPUT: Create and attach ONE complete UTF-8 .json file. ONLY if attachment is technically unavailable, briefly state the limitation and return the ENTIRE valid JSON object as raw text. ' +
    'Validate JSON syntax, all fields and question count before replying.\n\n' +
    'Problems detected:\n' + (details || 'Correct the previous file while retaining valid content.');
}
