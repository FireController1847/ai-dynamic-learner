export { AiRecoveryHelp as ReviewAiRecoveryHelp } from '../../components/ai-recovery-help.ts';
import { parseReviewAiImport, parseReviewQuestionsImport, type ReviewAiImport, type ReviewAiPreferences } from './ai-import-format.ts';
import { recoverReviewResponse, repairReviewPrompt, type ReviewResponseRecovery } from './ai-response-recovery.ts';
import { questionDisplayPrompt, validateQuestions, type Question } from './question-model.ts';

function fingerprint(question: Question): string {
  const { id: _id, shownCount: _shownCount, ...content } = question;
  return JSON.stringify(content);
}

/** Strict parsing is still the normal path. Recover only when the original parser rejects a response. */
export function checkReviewResponse(text: string, preferences: ReviewAiPreferences,
  options: { direct?: boolean; append?: boolean; previous?: ReviewAiImport | null; add?: boolean; existing?: Question[] } = {},
): ReviewResponseRecovery {
  let report: ReviewResponseRecovery;
  try {
    const candidate = options.append
      ? parseReviewQuestionsImport(text, preferences.count)
      : parseReviewAiImport(text, preferences, { requireCoverage: !options.direct && !options.add });
    report = { candidate, issues: [], received: candidate.questions.length, recovered: 0, notices: [] };
  } catch {
    report = recoverReviewResponse(text, preferences);
  }
  const incoming = report.candidate;
  if (incoming && !incoming.confidence && !options.direct && !options.append && !options.add &&
      !report.notices.some(notice => notice.includes('confidence'))) {
    report.notices.push('The AI did not provide confidence estimates. Your valid questions can still be used.');
  }
  if (!incoming) return { ...report, candidate: options.previous ?? null };
  const previous = options.add ? options.previous : null;
  if (!previous && !options.existing?.length) return report;
  const seen = new Set([...(options.existing ?? []), ...(previous?.questions ?? [])].map(fingerprint));
  const fresh = incoming.questions.filter(question => {
    const key = fingerprint(question);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const duplicates = incoming.questions.length - fresh.length;
  if (duplicates) report.notices.push(duplicates + ' duplicate question(s) were skipped.');
  if (!fresh.length) {
    report.issues.push({ message: 'The reply did not contain any new questions.' });
    return { ...report, candidate: options.previous ?? null };
  }
  const questions = [...(previous?.questions ?? []), ...fresh];
  try { validateQuestions(questions); }
  catch {
    report.issues.push({ message: 'The new questions could not be combined with the draft.' });
    return { ...report, candidate: options.previous ?? null };
  }
  return {
    ...report,
    candidate: {
      ...incoming, title: previous?.title ?? incoming.title, description: previous?.description ?? incoming.description,
      questions,
      warnings: previous ? ['Requested ' + preferences.count + ' questions; ' + questions.length + ' are ready.'] : incoming.warnings,
      confidence: previous || duplicates ? null : incoming.confidence,
      coverage: previous || duplicates ? null : incoming.coverage,
      sourceUnits: previous || duplicates ? undefined : incoming.sourceUnits,
    },
    notices: [...report.notices, ...(previous ? ['AI confidence estimates cannot be combined across responses.'] : [])],
  };
}

export function reviewRetryPrompt(report: ReviewResponseRecovery, count: number, _accepted: number,
  appendToExisting = false): string {
  return repairReviewPrompt(report.issues, count, appendToExisting);
}

export function reviewBatchPrompt(prompt: string, questions: readonly Question[]): string {
  const prompts = questions.map(question => questionDisplayPrompt(question).replace(/\s+/g, ' ').slice(0, 200)).join('\n');
  return prompt + (prompts ? '\n\nBATCH MODE: Return a standalone, COMPLETE UTF-8 .json file with the full top-level Review schema, but include ONLY new questions in its questions array. Keep the required metadata and confidence. Do not send a bare array, fragments, or patches. Do not repeat or paraphrase these already accepted question prompts:\n' + prompts : '');
}

