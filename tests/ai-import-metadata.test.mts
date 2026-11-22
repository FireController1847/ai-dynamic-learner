import assert from 'node:assert/strict';
import test from 'node:test';
import { aiConfidenceRequest, parseAiConfidenceReply, recoverAiConfidenceValues } from '../src/core/ai-confidence-repair.ts';
import { aiFullFileCorrectionInstructions } from '../src/core/ai-file-output.ts';
import { aiRepairPrompt } from '../src/core/ai-response-recovery.ts';
import { reviewRetryPrompt } from '../src/features/knowledge-check/ai-import-recovery.ts';
import { recoverAiCollection, type AiCollectionOptions } from '../src/core/ai-response-recovery.ts';
import { simpleAiPrompt } from '../src/core/ai-prompt-variants.ts';
import { checkReviewResponse } from '../src/features/knowledge-check/ai-import-recovery.ts';
import { reviewAiPrompt, parseReviewAiImport, type ReviewAiPreferences } from '../src/features/knowledge-check/ai-import-format.ts';
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

test('Long source-unit gap descriptions remain valid when the AI supplies correct indexes', () => {
  const correct = titles.map((title, index) => ({
    kind: 'unit', title, itemNumbers: Array.from({ length: 10 }, (_, j) => index * 10 + j + 1),
    missingTopics: index === 0 ? ['Important detail: ' + 'not directly tested; '.repeat(12)] : [],
  }));
  const imported = parseReviewAiImport(review(correct), preferences, { requireCoverage: true });
  assert.equal(imported.sourceUnits?.length, 4);
  assert.ok((imported.sourceUnits?.[0]?.missingTopics[0]?.length ?? 0) > 160);
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

test('Simple Review prompts require the full JSON file and a supported exact count', () => {
  const schema = JSON.stringify({
    format: 'dynamic-learner-review', targetApp: 'review', version: 1,
    title: 'Fixture', questions: [questions[0]], confidence,
  });
  const prompt = simpleAiPrompt('Example:\n' + '```json\n' + schema + '\n```',
    'Review', 'Create 40 review questions', []);
  assert.match(prompt, /Generate EXACTLY the requested number/);
  assert.match(prompt, /Count the completed questions array/);
  assert.match(prompt, /MANDATORY OUTPUT/);
  assert.match(prompt, /ENTIRE complete JSON object/);
  assert.match(prompt, /confidence is present with all FOUR integer percentages/);
  assert.doesNotMatch(prompt, /OUTPUT: Prefer/);
  assert.match(prompt, /ONLY IF this AI environment cannot technically attach/);
});

test('Review repair requests return a complete standalone file even after partial recovery', () => {
  const request = reviewRetryPrompt({
    candidate: null, recovered: 3, received: 4, notices: [],
    issues: [{ item: 4, message: 'Invalid option.' }],
  }, 40, 3);
  assert.match(request, /COMPLETE corrected standalone version-1 Review JSON file/);
  assert.match(request, /ALL questions \(including already-valid questions\)/);
  assert.match(request, /four integer confidence scores/);
  assert.match(request, /MANDATORY OUTPUT/);
  assert.doesNotMatch(request, /Return only the corrected or missing questions/);
});

test('Existing Review set repair returns an entire replacement of additional questions', () => {
  const request = reviewRetryPrompt({
    candidate: null, recovered: 1, received: 2, notices: [],
    issues: [{ item: 2, message: 'Incomplete new question.' }],
  }, 20, 1, true);
  assert.match(request, /ADDITIONAL-question file/);
  assert.match(request, /Keep all valid questions from this previous generated file/);
  assert.match(request, /ENTIRE valid JSON object/);
  assert.doesNotMatch(request, /Return only the corrected or missing questions/);
});

test('Generic correction prompts always require the entire saved content array', () => {
  const request = aiRepairPrompt({
    issues: [{ item: 2, message: 'Missing answer field.' }],
    notices: ['One question was recovered.'],
  }, 'Index Cards', 'cards', 'dynamic-learner-cards', 'index-cards');
  assert.match(request, /COMPLETE corrected REPLACEMENT file/);
  assert.match(request, /ENTIRE "cards" array/);
  assert.match(request, /even entries that were already correct/);
  assert.match(request, /MANDATORY OUTPUT/);
  assert.doesNotMatch(request, /Return ONLY corrected or missing items/);
});

test('Confidence repair asks for the complete corrected file rather than seven fields only', () => {
  for (const app of ['Review', 'Guide'] as const) {
    const request = aiConfidenceRequest(app, ['Unit One', 'Unit Two']);
    assert.match(request, /ENTIRE updated, standalone JSON file/);
    assert.match(request, /Do not return just confidence fields/);
    assert.match(request, /ONE COMPLETE UTF-8 \.json file/);
    assert.match(request, /all four confidence scores/);
    assert.doesNotMatch(request, /Return ONLY a JSON object with EXACTLY seven fields/);
  }
});

test('Full-file correction instructions require complete JSON even when only confidence changed', () => {
  const request = aiFullFileCorrectionInstructions('dynamic-learner-review.json');
  assert.match(request, /MANDATORY CORRECTED OUTPUT/);
  assert.match(request, /ONE complete UTF-8 \.json file named dynamic-learner-review\.json/);
  assert.match(request, /ENTIRE corrected top-level JSON object/);
  assert.match(request, /required confidence fields/);
  assert.match(request, /ONLY if actual file attachment is technically unavailable/);
});

test('Review Simple and Detailed share the exact same strict JSON contract', () => {
  const simple = reviewAiPrompt(preferences, null, 'simple');
  const detailed = reviewAiPrompt(preferences, null, 'detailed');
  const separator = 'JSON AND METADATA CONTRACT — IDENTICAL FOR SIMPLE AND DETAILED:';
  assert.ok(simple.includes(separator) && detailed.includes(separator));
  assert.equal(simple.slice(simple.indexOf(separator)), detailed.slice(detailed.indexOf(separator)));
  assert.ok(simple.length < detailed.length);
  for (const prompt of [simple, detailed]) {
    assert.match(prompt, /SOURCE-UNIT STRUCTURE:/);
    assert.match(prompt, /itemNumbers/);
    assert.match(prompt, /confidence.*overallCoverage|overallCoverage.*examConfidence/);
    assert.match(prompt, /four percentages MUST|four percentages MUST|The four percentages MUST/);
    assert.match(prompt, /function solve\(parameters\)/);
    assert.match(prompt, /OUTPUT AS A DOWNLOADABLE JSON FILE/);
    assert.match(prompt, /FINAL FILE VALIDATION/);
    const match = prompt.match(/```json\s*([\s\S]*?)\s*```/);
    assert.ok(match, 'the complete shared schema example must be included');
    const schema = JSON.parse(match[1]);
    assert.equal(schema.format, 'dynamic-learner-review');
    assert.equal(schema.targetApp, 'review');
    assert.equal(schema.version, 1);
    assert.ok(schema.questions.some((item: { type: string }) => item.type === 'parameterized'));
    assert.equal(schema.solvers, undefined);
    assert.equal(schema.questions.find((item: { type: string }) => item.type === 'parameterized')
      .parameters.rules.answers[0].expression, 'a + b');
  }
  assert.match(simple, /Do not default to one type/);
  assert.match(detailed, /avoid excessive workload/);
  assert.doesNotMatch(simple, /Inventory the testable subjects/);
  assert.doesNotMatch(detailed, /Ensure each inventoried subject is tested/);
});

test('Review custom mixes share the contract but exclude unsupported types', () => {
  const selected: ReviewAiPreferences = { ...preferences, count: 12, mixMode: 'custom',
    weights: { 'multiple-choice': 50, 'true-false': 0, 'fill-in-the-blanks': 50,
      dropdown: 0, 'short-answer': 0, statement: 0, parameterized: 0 },
  };
  const simple = reviewAiPrompt(selected, null, 'simple');
  const detailed = reviewAiPrompt(selected, null, 'detailed');
  assert.equal(simple.slice(simple.indexOf('JSON AND METADATA CONTRACT')),
    detailed.slice(detailed.indexOf('JSON AND METADATA CONTRACT')));
  for (const prompt of [simple, detailed]) {
    const match = prompt.match(/```json\s*([\s\S]*?)\s*```/);
    assert.ok(match);
    const schema = JSON.parse(match[1]);
    assert.deepEqual(schema.questions.map((item: { type: string }) => item.type),
      ['multiple-choice', 'fill-in-the-blanks']);
    assert.equal(schema.solvers, undefined);
    assert.doesNotMatch(prompt, /function solve\(parameters\)/);
    assert.match(prompt, /6 items|: 6/);
  }
});

test('Review exam and essentials scopes retain their teaching objectives in both styles', () => {
  for (const style of ['simple','detailed'] as const) {
    const exam = reviewAiPrompt({ ...preferences, coverage: 'exam-prep' }, null, style);
    const essentials = reviewAiPrompt({ ...preferences, coverage: 'essentials' }, null, style);
    assert.match(exam, /EXAM PREP ONLY/);
    assert.match(essentials, /ESSENTIALS ONLY/);
    assert.match(exam, /50/);
    assert.match(essentials, /50/);
  }
});

test('Explicitly selected parameterized questions retain the full solver package contract', () => {
  const selected: ReviewAiPreferences = { ...preferences, count: 4, mixMode: 'custom',
    weights: { 'multiple-choice': 0, 'true-false': 0, 'fill-in-the-blanks': 0,
      dropdown: 0, 'short-answer': 0, statement: 0, parameterized: 100 },
  };
  for (const style of ['simple', 'detailed'] as const) {
    const prompt = reviewAiPrompt(selected, null, style);
    const match = prompt.match(/```json\s*([\s\S]*?)\s*```/);
    assert.ok(match);
    const schema = JSON.parse(match[1]);
    assert.equal(schema.questions[0].type, 'parameterized');
    assert.equal(schema.solvers[0].format, 'dynamic-learner-solver');
    assert.equal(schema.questions[0].parameters.rules.solver.id, schema.solvers[0].id);
    assert.match(prompt, /Reference a package with rules.solver/);
    assert.match(prompt, /Algorithms must be deterministic/);
  }
});

test('Both Review prompt styles require useful explanations and standalone questions', () => {
  const simple = reviewAiPrompt(preferences, null, 'simple');
  const detailed = reviewAiPrompt(preferences, null, 'detailed');
  const contract = 'SCORED QUESTION QUALITY — REQUIRED IN BOTH STYLES:';
  for (const prompt of [simple, detailed]) {
    assert.match(prompt, /Each scored question MUST include a nonempty, concise explanation/);
    assert.match(prompt, /Question stems and explanations MUST stand alone/);
    assert.match(prompt, /do not place every correct answer first/);
    assert.match(prompt, /use both true and false answers when the source supports/);
    assert.match(prompt, /verify a non-spoiling explanation for every scored item/);
    assert.doesNotMatch(prompt.slice(prompt.indexOf(contract)), /optional explanation/);
    const example = prompt.match(/```json\s*([\s\S]*?)\s*```/);
    assert.ok(example);
    const parsed = JSON.parse(example[1]);
    for (const question of parsed.questions) {
      if (question.type === 'statement') continue;
      assert.equal(typeof question.explanation, 'string', question.type);
      assert.ok(question.explanation.trim(), 'missing sample explanation for ' + question.type);
    }
    const choiceExample = parsed.questions.find((question: { type: string }) => question.type === 'multiple-choice');
    assert.ok(choiceExample);
    assert.notEqual(choiceExample.choices.indexOf(choiceExample.answer), 0);
    const tfExample = parsed.questions.find((question: { type: string }) => question.type === 'true-false');
    assert.equal(tfExample?.answer, 'False');
  }
  assert.equal(simple.slice(simple.indexOf(contract)), detailed.slice(detailed.indexOf(contract)));
});

test('Simple Review favors concise gradable answers while Detailed audits matching workload', () => {
  const simple = reviewAiPrompt(preferences, null, 'simple');
  const detailed = reviewAiPrompt(preferences, null, 'detailed');
  assert.match(simple, /Short-answer questions must ask for one brief, objectively checkable answer/);
  assert.match(simple, /use matching or blanks for several related facts/);
  assert.match(detailed, /Use a matching table only when assessing related pairs together is better/);
  assert.match(detailed, /if matching is a substantial share, reconsider/);
  assert.match(detailed, /there is no fixed quota/);
  assert.doesNotMatch(simple, /if matching is a substantial share, reconsider/);
});

test('Custom Review mixes retain the quality contract but do not force unused types', () => {
  const chosen: ReviewAiPreferences = { ...preferences, count: 5, mixMode: 'custom',
    weights: { 'multiple-choice': 100, 'true-false': 0, 'fill-in-the-blanks': 0,
      dropdown: 0, 'short-answer': 0, statement: 0, parameterized: 0 } };
  for (const variant of ['simple', 'detailed'] as const) {
    const prompt = reviewAiPrompt(chosen, null, variant);
    assert.match(prompt, /SCORED QUESTION QUALITY — REQUIRED IN BOTH STYLES/);
    assert.match(prompt, /Use EXACTLY this mix|Use exactly this requested question mix/);
    const example = prompt.match(/```json\s*([\s\S]*?)\s*```/);
    assert.ok(example);
    const schema = JSON.parse(example[1]);
    assert.deepEqual(schema.questions.map((question: { type: string }) => question.type), ['multiple-choice']);
    assert.equal(schema.solvers, undefined);
  }
});
