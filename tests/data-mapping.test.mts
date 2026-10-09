import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, validateWorkspaceValue } from '../src/app/workspace-format.ts';
import { workspaceRows, hydrateWorkspace } from '../src/app/data/workspace-mapping.ts';

const TIME = '2026-10-09T12:00:00.000Z';

function fixture() {
  const workspace = emptyWorkspace();
  workspace.features.notebook.items = [
    { id: 'group-1', kind: 'group', name: 'Courses', children: [
      { id: 'doc-a', kind: 'document', name: 'Large Markdown', type: 'markdown', data: { markdown: '# Lecture\n'.repeat(1000) } },
      { id: 'doc-b', kind: 'document', name: 'Paper', type: 'lined',
        data: { text: 'A lined document', title: 'Paper', marginText: '', additionalTitles: ['Second page'] } },
    ] },
  ];
  workspace.features.notebook.lastSelectedDocumentId = 'doc-a';
  workspace.features['todo-list'].items = [
    { id: 'todo-empty', name: 'Empty list', createdAt: TIME, sections: [] },
    { id: 'todo-omitted', name: 'Legacy list', createdAt: TIME },
    { id: 'todo-full', name: 'Tasks', createdAt: TIME,
      sections: [{ id: 'section-1', title: 'Work', tasks: [
        { id: 'task-1', text: 'Read the guide', done: false, priority: '1' },
        { id: 'task-2', text: 'Finish practice', done: true },
      ] }] },
  ];
  workspace.features['index-cards'].items = [
    { id: 'set-1', kind: 'set', name: 'Flash Cards', mode: 'flash-cards',
      cards: [{ id: 'card-a', front: 'Front', back: 'Back', title: '', backTitle: '' }] },
  ];
  workspace.features['index-cards'].lastSelectedSetId = 'set-1';
  workspace.features['word-search'].items = [
    { id: 'search-1', kind: 'word-search', name: 'Fruits', boardRotation: 90,
      puzzle: { words: ['APPLE', 'PEAR', 'GRAPE'], size: 10, difficulty: 'easy', instructions: '' } },
  ];
  workspace.features.crossword.items = [
    { id: 'cross-1', kind: 'crossword', name: 'Animals',
      puzzle: { entries: [{ answer: 'CAT', clue: 'Feline' }, { answer: 'TAR', clue: 'Black resin' }],
        instructions: '' } },
  ];
  workspace.features.guide.items = [
    { id: 'guide-1', kind: 'guide', name: 'Study Guide', mode: 'list',
      data: { sections: [{ id: 'guide-section-1', title: 'Concepts', bullets: ['A fact.', 'Another fact.'] }] } },
  ];
  workspace.features['knowledge-check'].items = [
    { id: 'review-1', kind: 'set', name: 'Practice', mode: 'study', questions: [
      { id: 'question-1', type: 'statement', prompt: 'Read the following.', answer: '', explanation: '', choices: [] },
    ] },
  ];
  workspace.statistics!.apps.notebook = {
    counts: { views: 2 },
    entries: { 'doc-a': { counts: { views: 2 }, lastActivityAt: TIME } },
  };
  return validateWorkspaceValue(workspace);
}

function fakeReader(workspaceId, rows) {
  return {
    async all(store) {
      return rows.filter(row => row.store === store)
        .map(row => ({ ...row.value, revision: 1, workspaceId }));
    },
  };
}

test('complete v1 workspace content and ordering survives the row mapping', async () => {
  const source = fixture();
  const rows = workspaceRows('workspace-test', source);
  const restored = await hydrateWorkspace(fakeReader('workspace-test', rows), 'workspace-test');
  assert.deepEqual(restored, source);
  assert.equal(rows.filter(row => row.store === 'notebookDocuments').length, 2);
  assert.equal(rows.filter(row => row.store === 'indexCards').length, 1);
  assert.equal(rows.filter(row => row.store === 'reviewQuestions').length, 1);
});

test('empty and omitted optional todo sections retain their meanings', async () => {
  const source = fixture();
  const rows = workspaceRows('workspace-test', source);
  const restored = await hydrateWorkspace(fakeReader('workspace-test', rows), 'workspace-test');
  assert.deepEqual(restored.features['todo-list'].items[0]?.sections, []);
  assert.equal(Object.hasOwn(restored.features['todo-list'].items[1]!, 'sections'), false);
});

test('unreachable library nodes fail validation instead of being dropped', async () => {
  const source = fixture();
  const rows = workspaceRows('workspace-test', source);
  const damaged = rows.map(row => row.store === 'libraryNodes' && row.value.id === 'doc-a'
    ? { ...row, value: { ...row.value, parentKey: 'missing-parent' } }
    : row);
  await assert.rejects(() => hydrateWorkspace(fakeReader('workspace-test', damaged), 'workspace-test'));
});
