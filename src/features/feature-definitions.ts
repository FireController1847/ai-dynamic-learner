// Shared by the browser registry and webpack build; keep this data browser-neutral.
import type { PageMetadataOverrides } from '../core/metadata.ts';

export type FeatureId = 'calculator' | 'notebook' | 'todo-list' | 'index-cards' | 'word-search' | 'crossword';

export interface FeatureDefinition {
  hidden?: boolean;
  imageSrc?: string;
  id: FeatureId;
  label: string;
  version: `${number}.${number}.${number}`;
  path: `/${string}/`;
  icon: string;
  image: string;
  description: string;
  metadata?: PageMetadataOverrides;
}

export const featureDefinitions: readonly FeatureDefinition[] = [
  {
    id: 'calculator', label: 'Calculator', path: '/calculator/', icon: 'calculator',
    version: '1.3.0',
    image: 'assets/calculator.png',
    description: 'A scientific calculator for expressions and functions.',
    metadata: {
      keywords: ['calculator', 'scientific calculator', 'arithmetic', 'trigonometry', 'logarithms'],
      socialImage: {
        path: 'assets/calculator.png',
        type: 'image/png',
        width: 1254,
        height: 1254,
        alt: 'Calculator — Glossy blue-and-white calculator with a 123 display and rounded number and arithmetic keys.',
      },
    },
  },
  {
    id: 'notebook', label: 'Notebook', path: '/notebook/', icon: 'document',
    version: '1.4.3',
    image: 'assets/notebook.png',
    description: 'Organize notes into groups and keep your documents together in one notebook.',
  },
  {
    id: 'todo-list', label: 'Todo List', path: '/todo-list/', icon: 'checklist',
    version: '1.4.3',
    image: 'assets/todo-list.png',
    description: 'Write, organize, and prioritize tasks in simple lists that archive automatically.',
    metadata: {
      keywords: ['todo list', 'tasks', 'checklist', 'task planning'],
      socialImage: {
        path: 'assets/todo-list.png',
        type: 'image/png',
        width: 1254,
        height: 1254,
        alt: 'Todo List — Glossy blue-and-white clipboard with checkmarks and task lines.',
      },
    },
  },
  {
    id: 'index-cards', label: 'Index Cards', path: '/index-cards/', icon: 'cards',
    version: '1.9.0',
    image: 'assets/index-cards.png',
    description: 'Create flash cards or fill-in-the-blanks sets and review them at your own pace.',
  },
  {
    id: 'word-search', label: 'Word Search', path: '/word-search/', icon: 'word-search',
    version: '1.5.11',
    image: 'assets/word-search.png',
    description: 'Create your own word searches, find every word, and pick up where you left off.'
  },
  {
    id: 'crossword', label: 'Crossword', path: '/crossword/', icon: 'crossword',
    version: '1.1.6',
    image: 'assets/crossword.png',
    description: 'Create your own crosswords, solve the clues, and pick up where you left off.',
    metadata: {
      keywords: ['crossword', 'crossword puzzle', 'crossword maker', 'clues'],
      socialImage: {
        path: 'assets/crossword.png',
        type: 'image/png',
        width: 1254,
        height: 1254,
        alt: 'Crossword — Glossy blue-and-white puzzle grid with letters, clue numbers, and blue blocked squares.',
      },
    },
  },
];
