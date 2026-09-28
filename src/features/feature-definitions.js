// Shared by the browser registry and Node server; keep this data browser-neutral.
export const featureDefinitions = [
  {
    id: 'notebook', label: 'Notebook', path: '/notebook/', icon: 'document',
    description: 'Organize notes into groups and keep your documents together in one notebook.',
  },
  {
    id: 'index-cards', label: 'Index Cards', path: '/index-cards/', icon: 'cards',
    image: 'src/assets/index-cards.png',
    description: 'Organize your sets, write on both sides, and review at your own pace.',
  },
  {
    id: 'word-search', label: 'Word Search', path: '/word-search/', icon: 'word-search',
    image: 'src/assets/word-search.png',
    description: 'Create your own word searches, find every word, and pick up where you left off.'
  },
];
