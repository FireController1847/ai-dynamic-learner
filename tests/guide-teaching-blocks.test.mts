import assert from 'node:assert/strict';
import test from 'node:test';
import { createTeachingBlocksDemo } from '../src/features/guide/teaching-debug.ts';
import { lessonForTopic, validateTeachingLesson } from '../src/features/guide/teaching-blocks.ts';
import { copyTeachingBlock, newTeachingBlock, TEACHING_BLOCK_KINDS } from '../src/features/guide/teaching-block-factory.ts';
import { reactive, ref } from 'vue';
import { validateGuide } from '../src/features/guide/library-model.ts';
import { tokenizeTeachingMath, renderTeachingMath } from '../src/features/guide/teaching-text.ts';
import { parseGuideAiImport, guideAiPrompt } from '../src/features/guide/ai-import.ts';
import { GUIDE_AI_FOCUSES, guideAiFocusPrompt } from '../src/features/guide/ai-focus.ts';
import { featureDefinitions } from '../src/features/feature-definitions.ts';
import { defaultTeachingContent, validTeachingContent, teachingTemplate, readTeachingState, writeTeachingState, controlledTeachingTemplate } from '../src/features/guide/parameterized-teaching.ts';
import { generateVariant } from '../src/core/parameterized/generator.ts';
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
  assert.equal(blocks.length, 10);
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


test('dense AI maps follow an organic serpentine trail without crowding stops', () => {
  for (const count of [1, 2, 8, 12, 18, 34, 42]) {
    const ids = Array.from({ length: count }, (_, index) => 'stop-' + index);
    const edges = ids.slice(1).map((id, index) => ({ from: ids[index], to: id }));
    const placed = layoutSpacedAiMap(ids, edges, ids[0]);
    const positions = ids.map(id => placed.get(id)!);
    assert.equal(positions.length, count);
    assert.ok(stopsAreSpaced(positions), count + ' stops must have 64px clearance');
    for (const { x, y } of positions) {
      assert.equal(x % 32, 0);
      assert.equal(y % 32, 0);
      assert.ok(x >= 0 && x <= 1280 && y >= 0 && y <= 832);
    }
    if (count === 34) {
      // The old row-major layout teleported between opposite ends every row.
      const longest = Math.max(...positions.slice(1).map((point, index) =>
        Math.hypot(point.x - positions[index].x, point.y - positions[index].y)));
      assert.ok(longest < 390, 'main trail should not make a full-canvas jump');
      assert.ok(new Set(positions.slice(0, 6).map(point => point.y)).size >= 3,
        'the first six stops should wander vertically, not align in a straight row');
    }
  }
});

test('a spaced but rigid 34-stop AI grid is recomposed as a winding route', () => {
  const ids = Array.from({ length: 34 }, (_, index) => 'n' + index);
  const edges = ids.slice(1).map((id, index) => ({ from: ids[index], to: id }));
  const grid = ids.map((_, index) => ({
    x: (index % 6) * 224, y: Math.floor(index / 6) * 128,
  }));
  assert.ok(stopsAreSpaced(grid));
  const placed = layoutSpacedAiMap(ids, edges, ids[0], grid);
  const actual = ids.map(id => placed.get(id)!);
  assert.ok(stopsAreSpaced(actual));
  assert.notDeepEqual(actual, grid);
  assert.ok(actual.some((position, index) => position.y !== grid[index].y));
});

test('organic placement keeps connected branch descendants adjacent', () => {
  const ids = ['start', 'branch-a', 'branch-a-next', 'branch-b', 'branch-b-next'];
  const edges = [
    { from: 'start', to: 'branch-a' },
    { from: 'branch-a', to: 'branch-a-next' },
    { from: 'start', to: 'branch-b' },
    { from: 'branch-b', to: 'branch-b-next' },
  ];
  const placed = layoutSpacedAiMap(ids, edges, 'start');
  assert.ok(stopsAreSpaced([...placed.values()]));
  assert.ok(placed.has('branch-b-next'));
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

test('Guide category scoping reuses Review category contract and constrains its teaching prompt', () => {
  const scope = {
    subject: 'Operating Systems',
    category: { key: 'deadlock', title: 'Deadlock and prevention', description: 'Circular wait, resource allocation and recovery' },
  };
  const prompt = guideAiPrompt({
    detail: 'balanced', coverage: 'balanced', bulletStyle: 'thoughts',
    mixMode: 'ai', targetBlocks: 16, weights: DEFAULT_TEACHING_WEIGHTS,
  }, 'map', scope);
  assert.match(prompt, /STEP 2 of our study-content workflow/);
  assert.match(prompt, /Deadlock and prevention/);
  assert.match(prompt, /ONLY for this category/);
  assert.match(prompt, /Teaching Blocks/);
  assert.match(prompt, /Let AI choose/);
});

test('Guide 2.0.0 marks the Teaching Blocks major release', () => {
  const guide = featureDefinitions.find(feature => feature.id === 'guide');
  assert.equal(guide?.version, '2.0.0');
});

test('AI Guide focus options prioritize teaching rather than graded responses', () => {
  assert.deepEqual(GUIDE_AI_FOCUSES.map(option => option.id),
    ['default', 'numerics', 'recall', 'memorization', 'relationships', 'application']);
  assert.equal(guideAiFocusPrompt('default'), '');
  for (const focus of GUIDE_AI_FOCUSES.filter(option => option.id !== 'default')) {
    const prompt = guideAiPrompt({
      detail: 'balanced', coverage: 'comprehensive', bulletStyle: 'thoughts',
      mixMode: 'ai', aiFocus: focus.id, targetBlocks: 30, weights: DEFAULT_TEACHING_WEIGHTS,
    }, 'map');
    assert.ok(prompt.includes(focus.prompt), focus.label + ' must be included in AI instructions');
    assert.match(prompt, /Keep full subject coverage/);
    assert.match(prompt, /OPTIONAL TEACHING FOCUS/);
  }
});

test('Guide focus is ignored for custom mix and default leaves the teaching prompt alone', () => {
  const options = {
    detail: 'balanced' as const, coverage: 'balanced' as const, bulletStyle: 'thoughts' as const,
    mixMode: 'ai' as const, targetBlocks: 25, weights: DEFAULT_TEACHING_WEIGHTS,
  };
  assert.equal(guideAiPrompt({ ...options, aiFocus: 'default' }, 'map'),
    guideAiPrompt(options, 'map'));
  const custom = guideAiPrompt({ ...options, mixMode: 'custom', aiFocus: 'numerics' }, 'map');
  assert.doesNotMatch(custom, /OPTIONAL TEACHING FOCUS/);
  assert.ok(!custom.includes(guideAiFocusPrompt('numerics')));
});

test('parameterized Teaching Block reuses the numeric generator with seeded worked steps', () => {
  const block = newTeachingBlock('parameterized');
  assert.equal(block.kind, 'parameterized');
  if (block.kind !== 'parameterized') return;
  assert.doesNotThrow(() => validTeachingContent(block));
  const template = teachingTemplate(block);
  const first = generateVariant(template, 'guide-test:one');
  const again = generateVariant(template, 'guide-test:one');
  assert.deepEqual(first, again);
  assert.equal(first.answers[0].value, Number(first.values.a) + Number(first.values.b));
  assert.match(first.texts.prompt, /What is \d+ \+ \d+\?/);
  assert.ok(first.texts.step1.includes(first.answers[0].text));
});

test('generated teaching examples can adjust values without modifying source rules', () => {
  const block = defaultTeachingContent();
  const original = JSON.stringify(block.rules);
  const controlled = controlledTeachingTemplate(block, { a: 8, b: 3 });
  const generated = generateVariant(controlled, 'adjusted');
  assert.equal(generated.values.a, 8);
  assert.equal(generated.values.b, 3);
  assert.equal(generated.answers[0].value, 11);
  assert.equal(JSON.stringify(block.rules), original);
});

test('generated teaching example state persists and rejects invalid responses', () => {
  const state = { n: 4, revealed: true, overrides: { a: 7, b: 2 } };
  assert.deepEqual(readTeachingState(writeTeachingState(state)), state);
  assert.deepEqual(readTeachingState('broken'), { n: 0, revealed: false, overrides: {} });
  assert.deepEqual(readTeachingState('{"n":-2,"revealed":true,"overrides":{}}'),
    { n: 0, revealed: false, overrides: {} });
});

test('AI accepts expression-based parameterized lessons, but not solver scripts', () => {
  const content = defaultTeachingContent();
  const map = {
    format: 'dynamic-learner-guide-map', version: 2, title: 'Math lessons', startTopic: 'start',
    topics: [{ key: 'start', title: 'Practice the calculation',
      lesson: { version: 1, blocks: [{ kind: 'parameterized', title: 'Try new values', ...content }] } }],
    connections: [],
  };
  const parsed = parseGuideAiImport(JSON.stringify(map), 'map');
  if (parsed.mode !== 'map') throw new Error('Expected map');
  assert.equal(parsed.topics[0].lesson?.blocks[0].kind, 'parameterized');
  const unsafe = structuredClone(map);
  const rules = unsafe.topics[0].lesson.blocks[0].rules;
  (rules as unknown as { solver: unknown }).solver = { id: 'x', version: '1', parameters: {}, package: { source: 'evil' } };
  assert.throws(() => parseGuideAiImport(JSON.stringify(unsafe), 'map'));
});
