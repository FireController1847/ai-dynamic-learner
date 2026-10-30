import assert from 'node:assert/strict';
import test from 'node:test';
import { createTeachingBlocksDemo } from '../src/features/guide/teaching-debug.ts';
import { lessonForTopic, validateTeachingLesson } from '../src/features/guide/teaching-blocks.ts';
import { copyTeachingBlock, newTeachingBlock, TEACHING_BLOCK_KINDS } from '../src/features/guide/teaching-block-factory.ts';
import { reactive, ref } from 'vue';
import { validateGuide } from '../src/features/guide/library-model.ts';
import { tokenizeTeachingMath, renderTeachingMath } from '../src/features/guide/teaching-text.ts';

function demoModel() {
  const data = createTeachingBlocksDemo();
  return { items: [{ id: 'test-guide', kind: 'guide', name: 'Teaching demo', mode: 'map', data }] };
}

test('the demo creates a connected, valid map and demonstrates all eight teaching blocks', () => {
  const model = demoModel();
  assert.doesNotThrow(() => validateGuide(model));
  const guide = model.items[0];
  assert.equal(guide.data.topics.length, 3);
  assert.equal(guide.data.connections.length, 2);
  assert.deepEqual(
    guide.data.topics[0].lesson?.blocks.map(block => block.kind),
    ['explanation', 'example', 'comparison', 'sequence', 'diagram', 'exploration', 'check', 'connection'],
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
  assert.equal(blocks.length, 8);
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
  const sample = String.raw\`Compute \\(a+b\\), then $x^2$, then \\[x=y\\], then $$\\frac{a}{b}$$\`;
  const pieces = tokenizeTeachingMath(sample);
  assert.deepEqual(pieces.filter(part => part.kind !== 'text').map(part => [part.kind, part.value]), [
    ['inline', 'a+b'], ['inline', 'x^2'], ['display', 'x=y'], ['display', String.raw\`\\frac{a}{b}\`],
  ]);
  // The KaTeX renderer handles the math without requiring a browser DOM.
  assert.ok(renderTeachingMath(sample).length > 4);
});

test('malformed or oversized math keeps the original text', () => {
  assert.deepEqual(tokenizeTeachingMath(String.raw\`Unclosed \\(x+y\`), [
    { kind: 'text', value: String.raw\`Unclosed \\(x+y\` },
  ]);
  const enormous = '$' + 'a'.repeat(4001) + '$';
  assert.deepEqual(tokenizeTeachingMath(enormous), [{ kind: 'text', value: enormous }]);
});
