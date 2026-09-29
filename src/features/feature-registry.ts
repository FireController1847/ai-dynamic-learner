import { h, type VNode } from 'vue';
import { Notebook } from './notebook/notebook.ts';
import { IndexCards } from './index-cards/index-cards.ts';
import { WordSearch } from './word-search/word-search.ts';
import { featureDefinitions, type FeatureDefinition, type FeatureId } from './feature-definitions.ts';
import type { Notebook as NotebookModel } from './notebook/library-model.ts';
import type { IndexCards as IndexCardsModel } from './index-cards/tree-model.ts';
import type { WordSearch as WordSearchModel } from './word-search/library-model.ts';

export interface FeatureModels {
  notebook: NotebookModel;
  'index-cards': IndexCardsModel;
  'word-search': WordSearchModel;
}

// Each renderer keeps the component and its model paired at the typed boundary.
const renderers: Record<FeatureId, (definition: FeatureDefinition, models: FeatureModels) => VNode> = {
  notebook: (definition, models) => h(Notebook, { key: definition.id, title: definition.label, model: models.notebook }),
  'index-cards': (definition, models) => h(IndexCards, { key: definition.id, title: definition.label, model: models['index-cards'] }),
  'word-search': (definition, models) => h(WordSearch, { key: definition.id, title: definition.label, model: models['word-search'] }),
};

export const features = featureDefinitions.map((definition) => ({
  ...definition,
  render: (models: FeatureModels) => renderers[definition.id](definition, models),
}));
