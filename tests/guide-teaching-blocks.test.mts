import assert from 'node:assert/strict';
import test from 'node:test';
import { createTeachingBlocksDemo } from '../src/features/guide/teaching-debug.ts';
import { lessonForTopic, validateTeachingLesson } from '../src/features/guide/teaching-blocks.ts';
import { copyTeachingBlock, newTeachingBlock, TEACHING_BLOCK_KINDS } from '../src/features/guide/teaching-block-factory.ts';
import { reactive, ref } from 'vue';
import { validateGuide } from '../src/features/guide/library-model.ts';
import { tokenizeTeachingMath, renderTeachingMath } from '../src/features/guide/teaching-text.ts';
import { parseGuideAiImport, guideAiPrompt } from '../src/features/guide/ai-import.ts';
import { layoutSpacedAiMap, stopsAreSpaced, GUIDE_AI_STOP_GAP } from '../src/features/guide/ai-map-layout.ts';
import { allocateTeachingBlocks, rebalanceTeachingWeights, DEFAULT_TEACHING_WEIGHTS, TEACHING_TYPES } from '../src/features/guide/ai-teaching-mix.ts';

function demoModel() {
  const data = createTeachingBlocksDemo();
  return { items: [{ id: 'test-guide', kind: 'guide', name: 'Teaching demo', mode: 'map', data }] };
}

test('the demo creates a connected, valid map and demonstrates all nine teaching blocks', () => {
  const model = demoModel();
  assert.doesNotThrow(() => validateGuide(model));
  const guide = model.items[0];
  assert.equal(guide.data.topics.length, 4);
  assert.equal(guide.data.connections.length, 3);
  assert.equal(guide.data.topics[3].title, 'Markdown & LaTeX Showcase');
  assert.ok(guide.data.topics[3].lesson?.blocks.some(block => block.kind === 'table'));
  assert.ok(guide.data.topics[3].lesson?.blocks.some(block => block.kind === 'explanation' && block.body.includes('| :---')));
  assert.deepEqual(
    guide.data.topics[0].lesson?.blocks.map(block => block.kind),
    ['explanation', 'example', 'comparison', 'table', 'sequence', 'diagram', 'exploration', 'check', 'connection'],
  );
});

test('legacy map bullet sections render together as explanatory teaching blocks', () => {
  const demo = createTeachingBlocksDemo();
  const topic = demo.topics[0];
  delete topic.lesson;
  topic.guide.sections = [{
    id: 'legacy-section', title: 'Existing notes',
    bullets: ['First fact', 'Second fact'],
  }];
  const lesson = lessonForTopic(topic);
  assert.equal(lesson.version, 1);
  assert.equal(lesson.blocks.length, 1);
  const first = lesson.blocks[0];
  assert.equal(first.kind, 'explanation');
  if (first.kind === 'explanation') assert.equal(first.body, 'First fact\n\nSecond fact');
});

test('unknown teaching block kinds cannot enter persisted Guide storage', () => {
  const model = demoModel();
  const first = model.items[0].data.topics[0].lesson?.blocks[0];
  assert.ok(first);
  (first as { kind: string }).kind = 'arbitrary-script';
  assert.throws(() => validateGuide(model), /unsupported teaching block/);
});

test('a check must reference an actual answer option', () => {
  const model = demoModel();
  const check = model.items[0].data.topics[0].lesson?.blocks.find(block => block.kind === 'check');
  assert.ok(check && check.kind === 'check');
  check.correctId = 'not-a-valid-choice';
  assert.throws(() => validateGuide(model), /matching answer/);
});

test('validated interaction responses survive reload without clearing visited stops', () => {
  const model = demoModel();
  const guide = model.items[0].data;
  const first = guide.topics[0];
  const blockId = first.lesson?.blocks[0].id;
  assert.ok(blockId);
  guide.session = {
    paused: true, currentId: first.id, openedIds: [first.id],
    visitedIds: [first.id], skippedIds: [], revealed: {},
    responses: { [first.id]: { [blockId]: 'choice-1', 'old-deleted-block': 'discard-me' } },
  };
  validateGuide(model);
  assert.deepEqual(guide.session?.visitedIds, [first.id]);
  assert.deepEqual(guide.session?.responses?.[first.id], { [blockId]: 'choice-1' });
});

test('duplicate nested ids are rejected by the lesson validator', () => {
  const model = demoModel();
  const blocks = model.items[0].data.topics[0].lesson?.blocks;
  assert.ok(blocks && blocks.length > 1);
  blocks[1].id = blocks[0].id;
  assert.throws(() => validateGuide(model), /duplicated/);
});

test('all Teaching Block authoring templates start valid and use unique IDs', () => {
  const blocks = TEACHING_BLOCK_KINDS.map(item => newTeachingBlock(item.kind));
  assert.doesNotThrow(() => validateTeachingLesson({ version: 1, blocks }, new Set<string>()));
  assert.equal(blocks.length, 9);
  assert.equal(new Set(blocks.map(block => block.id)).size, blocks.length);
});

test('invalid intermediate draft changes can be rejected before replacing saved blocks', () => {
  const original = newTeachingBlock('explanation');
  const edited = structuredClone(original);
  if (edited.kind === 'explanation') edited.body = '';
  assert.throws(() =>
    validateTeachingLesson({ version: 1, blocks: [edited] }, new Set<string>()),
    /must contain valid text/);
  assert.doesNotThrow(() =>
    validateTeachingLesson({ version: 1, blocks: [original] }, new Set<string>()));
});

test('authoring can edit and save Vue-proxied Teaching Blocks', () => {
  const source = reactive(newTeachingBlock('diagram'));
  const draft = ref(copyTeachingBlock(source));
  assert.equal(draft.value.kind, 'diagram');
  if (draft.value.kind !== 'diagram') throw new Error('Expected diagram block');
  draft.value.nodes[0].label = 'Updated concept';
  const saved = copyTeachingBlock(draft.value);
  assert.equal(saved.kind, 'diagram');
  if (saved.kind !== 'diagram' || source.kind !== 'diagram') throw new Error('Expected diagram block');
  assert.equal(saved.nodes[0].label, 'Updated concept');
  assert.notEqual(source.nodes[0].label, saved.nodes[0].label);
  assert.doesNotThrow(() => validateTeachingLesson({ version: 1, blocks: [saved] }, new Set()));
});

test('short teaching labels preserve plain punctuation and currency', () => {
  const source = 'Costs $5 and $10; C++_variable_ remains literal';
  assert.deepEqual(tokenizeTeachingMath(source), [{ kind: 'text', value: source }]);
});

test('short teaching labels support LaTeX delimiters without requiring Markdown', () => {
  const sample = String.raw`Compute \(a+b\), then $x^2$, then \[x=y\], then $$\frac{a}{b}$$`;
  const pieces = tokenizeTeachingMath(sample);
  assert.deepEqual(pieces.filter(part => part.kind !== 'text').map(part => [part.kind, part.value]), [
    ['inline', 'a+b'], ['inline', 'x^2'], ['display', 'x=y'], ['display', String.raw`\frac{a}{b}`],
  ]);
  // The KaTeX renderer handles the math without requiring a browser DOM.
  assert.ok(renderTeachingMath(sample).length > 4);
});

test('malformed or oversized math keeps the original text', () => {
  assert.deepEqual(tokenizeTeachingMath(String.raw`Unclosed \(x+y`), [
    { kind: 'text', value: String.raw`Unclosed \(x+y` },
  ]);
  const enormous = '$' + 'a'.repeat(4001) + '$';
  assert.deepEqual(tokenizeTeachingMath(enormous), [{ kind: 'text', value: enormous }]);
});

test('table blocks preserve Markdown and math, and validate aligned rectangular cells', () => {
  const model = demoModel();
  const map = model.items[0].data;
  const table = map.topics[3].lesson?.blocks.find(block => block.kind === 'table');
  assert.ok(table && table.kind === 'table');
  assert.equal(table.headers.length, 3);
  assert.ok(table.rows.some(row => row.some(cell => cell.includes('**'))));
  assert.ok(table.rows.some(row => row.some(cell => cell.includes('$O('))));
  assert.doesNotThrow(() => validateGuide(model));

  table.rows[0].pop();
  assert.throws(() => validateGuide(model), /Table row 1/);
});

test('table authoring enforces dimensions without rejecting intentionally blank cells', () => {
  const table = newTeachingBlock('table');
  assert.equal(table.kind, 'table');
  if (table.kind !== 'table') return;
  table.rows[0][1] = '';
  assert.doesNotThrow(() => validateTeachingLesson({ version: 1, blocks: [table] }, new Set()));
  table.headers.push('Third heading');
  assert.throws(() => validateTeachingLesson({ version: 1, blocks: [table] }, new Set()), /Table row/);
  table.rows.forEach(row => row.push(''));
  assert.doesNotThrow(() => validateTeachingLesson({ version: 1, blocks: [table] }, new Set()));
  table.rows = Array.from({ length: 21 }, () => ['', '', '']);
  assert.throws(() => validateTeachingLesson({ version: 1, blocks: [table] }, new Set()), /Table must contain/);
});

test('v2 AI map import produces validated teaching lessons and local IDs', () => {
  const payload = {
    format: 'dynamic-learner-guide-map', version: 2, title: 'Generated Guide', startTopic: 'intro',
    coverage: [{ subject: 'Scheduling', itemNumbers: [1, 2] }],
    topics: [
      { key: 'intro', title: 'Foundations', position: [0, 0],
        lesson: { version: 1, blocks: [
          { kind: 'explanation', title: 'Processes', body: '**Processes** run programs. $x^2$' },
          { kind: 'check', title: 'Check understanding', question: 'A process has?',
            options: [{ label: 'An address space', explanation: 'Correct.' },
              { label: 'No memory', explanation: 'Not correct.' }], correctIndex: 0 },
        ] } },
      { key: 'next', title: 'Scheduling', position: [224, 128],
        lesson: { version: 1, blocks: [
          { kind: 'table', title: 'Compare policies', headers: ['Policy', 'Behavior'],
            rows: [['First come first served', 'FIFO'], ['Round robin', 'Time slices']] },
        ] } },
    ],
    connections: [['intro', 'next']],
  };
  const parsed = parseGuideAiImport(JSON.stringify(payload), 'map');
  assert.equal(parsed.mode, 'map');
  if (parsed.mode !== 'map') return;
  assert.equal(parsed.topics[0].sections.length, 0);
  assert.equal(parsed.topics[0].lesson?.blocks.length, 2);
  const check = parsed.topics[0].lesson?.blocks[1];
  assert.ok(check?.kind === 'check');
  assert.equal(check.options.length, 2);
  assert.equal(check.correctId, check.options[0].id);
  assert.equal(parsed.topics[1].lesson?.blocks[0].kind, 'table');
  assert.equal(parsed.topics[1].position?.[0], 224);
});

test('AI map parser repairs touching coordinates without rejecting content', () => {
  const v2 = {
    format: 'dynamic-learner-guide-map', version: 2, title: 'T', startTopic: 'a',
    topics: [
      { key: 'a', title: 'A', position: [0, 0],
        lesson: { version: 1, blocks: [{ kind: 'explanation', title: 'First', body: 'A lesson.' }] } },
      { key: 'b', title: 'B', position: [160, 0],
        lesson: { version: 1, blocks: [{ kind: 'explanation', title: 'Second', body: 'Another lesson.' }] } },
    ],
    connections: [['a', 'b']],
  };
  const parsed = parseGuideAiImport(JSON.stringify(v2), 'map');
  if (parsed.mode !== 'map') throw new Error('Expected map');
  assert.ok(parsed.topics.every(topic => topic.position === undefined));
  const layout = layoutSpacedAiMap(['a', 'b'], parsed.connections, 'a');
  assert.ok(stopsAreSpaced([...layout.values()], GUIDE_AI_STOP_GAP));
});

test('AI map rejects malformed teaching blocks and invalid zero-based answers', () => {
  const map = {
    format: 'dynamic-learner-guide-map', version: 2, title: 'T', startTopic: 'a',
    topics: [{ key: 'a', title: 'A',
      lesson: { version: 1, blocks: [{ kind: 'check', title: 'Q', question: 'Why?',
        options: [{ label: 'Yes', explanation: 'Because.' },
          { label: 'No', explanation: 'Incorrect.' }], correctIndex: 3 }] } }],
    connections: [],
  };
  assert.throws(() => parseGuideAiImport(JSON.stringify(map), 'map'), /correctIndex/);
  (map.topics[0].lesson.blocks[0] as { correctIndex: number }).correctIndex = 1;
  assert.doesNotThrow(() => parseGuideAiImport(JSON.stringify(map), 'map'));
});

test('Review-style teaching mix stays at 100% and allocates meaningful targets', () => {
  const weights = rebalanceTeachingWeights(DEFAULT_TEACHING_WEIGHTS, 'table', 22);
  assert.equal(weights.table, 22);
  assert.equal(TEACHING_TYPES.reduce((sum, type) => sum + weights[type], 0), 100);
  const counts = allocateTeachingBlocks(weights, 30);
  assert.equal(TEACHING_TYPES.reduce((sum, type) => sum + counts[type], 0), 30);
});

test('AI Guide prompt teaches with v2 blocks and creative, spacious coordinates', () => {
  const prompt = guideAiPrompt({
    detail: 'balanced', coverage: 'comprehensive', bulletStyle: 'thoughts',
    mixMode: 'custom', targetBlocks: 20, weights: DEFAULT_TEACHING_WEIGHTS,
  }, 'map');
  assert.match(prompt, /version": 2/);
  assert.match(prompt, /64 px CLEAR SPACE/);
  assert.match(prompt, /Custom teaching mix/);
  assert.match(prompt, /correctIndex/);
  assert.match(prompt, /Markdown/);
  assert.doesNotMatch(prompt, /This is a guide, not a rewritten textbook/);
});

test('v1 AI Map imports still accept legacy sections without Teaching Blocks', () => {
  const legacy = {
    format: 'dynamic-learner-guide-map', version: 1, title: 'Original', startTopic: 'a',
    topics: [{ key: 'a', title: 'Legacy notes',
      sections: [{ title: 'Notes', bullets: [{ text: 'A note.' }] }] }],
    connections: [],
  };
  const result = parseGuideAiImport(JSON.stringify(legacy), 'map');
  assert.equal(result.mode, 'map');
  if (result.mode === 'map') {
    assert.equal(result.topics[0].lesson, undefined);
    assert.deepEqual(result.topics[0].sections[0].bullets, ['A note.']);
  }
});
