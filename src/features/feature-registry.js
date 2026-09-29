import { Notebook } from './notebook/notebook.js';
import { IndexCards } from './index-cards/index-cards.js';
import { WordSearch } from './word-search/word-search.js';
import { featureDefinitions } from './feature-definitions.ts';

const components = {
  notebook: Notebook,
  'index-cards': IndexCards,
  'word-search': WordSearch,
};

export const features = featureDefinitions.map((definition) => ({
  ...definition,
  component: components[definition.id],
}));
