import { h, type VNode } from 'vue';
import { Calculator } from './calculator/calculator.ts';
import { Notebook } from './notebook/notebook.ts';
import { TodoList } from './todo-list/todo-list.ts';
import { IndexCards } from './index-cards/index-cards.ts';
import { WordSearch } from './word-search/word-search.ts';
import { Crossword } from './crossword/crossword.ts';
import { featureDefinitions, type FeatureDefinition, type FeatureId } from './feature-definitions.ts';
import type { Notebook as NotebookModel } from './notebook/library-model.ts';
import type { IndexCards as IndexCardsModel } from './index-cards/tree-model.ts';
import type { WordSearch as WordSearchModel } from './word-search/library-model.ts';
import type { Crossword as CrosswordModel } from './crossword/library-model.ts';
import type { TodoLists } from './todo-list/library-model.ts';

export interface FeatureModels {
  notebook: NotebookModel;
  'todo-list': TodoLists;
  'index-cards': IndexCardsModel;
  'word-search': WordSearchModel;
  crossword: CrosswordModel;
}

// Each renderer keeps the component and its model paired at the typed boundary.
const renderers: Record<FeatureId, (definition: FeatureDefinition, models: FeatureModels) => VNode> = {
  calculator: (definition) => h(Calculator, { key: definition.id, title: definition.label }),
  notebook: (definition, models) => h(Notebook, { key: definition.id, title: definition.label, model: models.notebook }),
  'todo-list': (definition, models) => h(TodoList, { key: definition.id, title: definition.label, model: models['todo-list'] }),
  'index-cards': (definition, models) => h(IndexCards, { key: definition.id, title: definition.label, model: models['index-cards'] }),
  'word-search': (definition, models) => h(WordSearch, { key: definition.id, title: definition.label, model: models['word-search'] }),
  crossword: (definition, models) => h(Crossword, { key: definition.id, title: definition.label, model: models.crossword }),
};

export const features = featureDefinitions.map((definition) => ({
  ...definition,
  render: (models: FeatureModels) => renderers[definition.id](definition, models),
}));
