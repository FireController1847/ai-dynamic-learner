import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAiConfidenceReply, recoverAiConfidenceValues } from '../src/core/ai-confidence-repair.ts';
import { recoverAiCollection, type AiCollectionOptions } from '../src/core/ai-response-recovery.ts';
import { simpleAiPrompt } from '../src/core/ai-prompt-variants.ts';
import { checkReviewResponse } from '../src/features/knowledge-check/ai-import-recovery.ts';
import { parseReviewAiImport, type ReviewAiPreferences } from '../src/features/knowledge-check/ai-import-format.ts';
import { DEFAULT_AI_WEIGHTS } from '../src/features/knowledge-check/ai-question-mix.ts';
import { parseGuideAiImport, type SimpleGuideImport } from '../src/features/guide/ai-import.ts';

// Synthetic fixtures based on the two reported shape failures. No uploaded
// course questions or other private study material are committed to the repo.
const confidence = {
  overallCoverage: 88, examConfidence: 76, subjectConfidence: 91, studyConfidence: 89,
  coverageExplanation: 'The provided source was sampled across its named units.',
  uncoveredSubjects: [
    'Unit One: ' + 'Detailed source concepts not yet assessed; '.repeat(8),
    'Unit Two: ' + 'Several additional subtopics may need more practice; '.repeat(7),
  ],
  confidenceExplanation: 'These are AI-reported estimates rather than independently verified outcomes.',
};
const titles = ['Unit One', 'Unit Two', 'Unit Three', 'Unit Four'];
const questions = Array.from({ length: 40 }, (_, i) => ({
  type: 'true-false',
  prompt: 'Synthetic source-supported claim ' + (i + 1) + ' is true.',
  answer: 'True',
  explanation: 'Recall the relevant source concept.',
}));
const preferences: ReviewAiPreferences = {
  count: questions.length, coverage: 'balanced', mixMode: 'ai', weights: { ...DEFAULT_AI_WEIGHTS },
};
function review(units: unknown, values: unknown = confidence) {
  return JSON.stringify({
    format: 'dynamic-learner-review', targetApp: 'review', version: 1,
    title: 'Test source units', description: 'Synthetic data', questions,
    sourceUnits: units, confidence: values,
  });
}

test('Review preserves complete confidence when AI invents sourceUnits id/source/questionCount', () => {
  const units = titles.map((title, index) => ({
    id: 'unit-' + (index + 1), title, source: 'Notes (' + (index + 1) + ').pdf', questionCount: 10,
  }));
  const result = checkReviewResponse(review(units), preferences);
  assert.equal(result.issues.length, 0);
  assert.equal(result.candidate?.questions.length, 40);
  assert.equal(result.candidate?.confidence?.overallCoverage, 88);
  assert.equal(result.candidate?.confidence?.examConfidence, 76);
  assert.equal(result.candidate?.sourceUnits?.length, 4);
  assert.deepEqual(result.candidate?.sourceUnits?.[0]?.itemNumbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(result.candidate?.questions[39]?.sourceUnit, 'Unit Four');
  assert.match(result.notices.join(' '), /Recovered chapter mapping from AI-reported sequential item counts/);
});

test('Review preserves the same graphs when sourceUnits contains chapter coverage descriptions', () => {
  const units = titles.map((title, index) => ({
    id: 'unit-' + (index + 1), title, source: 'Notes (' + (index + 1) + ').pdf',
    coverage: 'This chapter discusses its named concepts.',
  }));
  const result = checkReviewResponse(review(units), preferences);
  assert.equal(result.issues.length, 0);
  assert.equal(result.candidate?.confidence?.studyConfidence, 89);
  assert.equal(result.candidate?.questions.length, 40);
  assert.equal(result.candidate?.sourceUnits, undefined);
});

test('Review does not guess chapter placement when AI unit counts do not match', () => {
  const units = titles.map((title, index) => ({
    id: 'unit-' + (index + 1), title, questionCount: 8,
  }));
  const result = checkReviewResponse(review(units), preferences);
  assert.equal(result.candidate?.confidence?.overallCoverage, 88);
  assert.equal(result.candidate?.sourceUnits, undefined);
  assert.match(result.notices.join(' '), /unit counts do not total 40/);
});

test('Long but reasonable chapter-level uncoveredSubjects are valid everywhere', () => {
  assert.ok(confidence.uncoveredSubjects.every(topic => topic.length > 160));
  assert.equal(parseAiConfidenceReply(JSON.stringify(confidence)).overallCoverage, 88);
  const correct = titles.map((title, index) => ({
    kind: 'unit', title, itemNumbers: Array.from({ length: 10 }, (_, j) => index * 10 + j + 1),
    missingTopics: [],
  }));
  const imported = parseReviewAiImport(review(correct), preferences, { requireCoverage: true });
  assert.equal(imported.confidence?.studyConfidence, 89);
  assert.equal(imported.sourceUnits?.length, 4);
  assert.equal(imported.questions[39]?.sourceUnit, 'Unit Four');
});

test('One oversized missing-topic description cannot erase valid percentages', () => {
  const wrong = { ...confidence, uncoveredSubjects: ['Too long: ' + 'x'.repeat(1100), 'A valid gap'] };
  const result = checkReviewResponse(review([], wrong), preferences);
  assert.equal(result.candidate?.confidence?.overallCoverage, 88);
  assert.deepEqual(result.candidate?.confidence?.uncoveredSubjects, ['A valid gap']);
  assert.match(result.notices.join(' '), /invalid or overlong missing-topic descriptions/);
  assert.equal(result.issues.length, 0);
});

test('Invalid percentage is never invented or silently normalized', () => {
  const wrong = { ...confidence, examConfidence: '89%' };
  const result = checkReviewResponse(review([], wrong), preferences);
  assert.equal(result.candidate?.confidence, null);
  assert.match(result.notices.join(' '), /confidence.examConfidence/);
});

function guide(units: unknown, values: unknown = confidence): string {
  return JSON.stringify({
    format: 'dynamic-learner-guide', targetApp: 'guide', version: 1,
    title: 'Example list', sections: [
      { title: 'Unit One', bullets: [{ text: 'A valid synthetic fact.' }] },
      { title: 'Unit Two', bullets: [{ text: 'Another valid synthetic fact.' }] },
    ],
    sourceUnits: units, confidence: values,
  });
}
const guideOptions: AiCollectionOptions<SimpleGuideImport> = {
  field: 'sections', formats: ['dynamic-learner-guide'], targetApp: 'guide',
  versions: [1], title: 'Example list', requiredMetadata: ['confidence'],
  parse: text => parseGuideAiImport(text, 'list'),
  validateItem: item => JSON.stringify(item),
};

test('Guide skips only malformed sourceUnits and keeps complete graphs and lessons', () => {
  const units = titles.slice(0, 2).map((title, index) => ({
    id: 'unit-' + index, title, source: 'Notes.pdf', questionCount: 1,
  }));
  const result = recoverAiCollection(guide(units), guideOptions);
  assert.equal(result.issues.length, 0);
  assert.equal(result.candidate?.mode, 'list');
  assert.equal(result.candidate?.confidence?.subjectConfidence, 91);
  assert.equal(result.candidate?.sourceUnits, undefined);
  assert.match(result.notices.join(' '), /sourceUnits metadata could not be validated/);
});

test('Guide can independently salvage valid scores when missing topics are malformed', () => {
  const wrong = { ...confidence, uncoveredSubjects: ['x'.repeat(1100), 'A usable gap'] };
  const result = recoverAiCollection(guide([], wrong), guideOptions);
  assert.equal(result.issues.length, 0);
  assert.equal(result.candidate?.confidence?.overallCoverage, 88);
  assert.deepEqual(result.candidate?.confidence?.uncoveredSubjects, ['A usable gap']);
  assert.match(result.notices.join(' '), /invalid or overlong/);
});

test('Simple prompts show the exact sourceUnits contract and preserve confidence requirements', () => {
  const schema = JSON.stringify({
    format: 'dynamic-learner-review', version: 1,
    questions: [questions[0]], sourceUnits: [], confidence,
  });
  const prompt = simpleAiPrompt('Example:\n\u0060\u0060\u0060json\n' + schema + '\n\u0060\u0060\u0060',
    'Review', 'Create questions', []);
  assert.match(prompt, /"itemNumbers":\[1,2\]/);
  assert.match(prompt, /Do NOT substitute id, source, questionCount, or coverage/);
  assert.match(prompt, /up to 1000 characters each/);
  assert.match(prompt, /overallCoverage.*examConfidence.*subjectConfidence.*studyConfidence/);
});
