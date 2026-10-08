// Shared by the browser registry and webpack build; keep this data browser-neutral.
import type { PageMetadataOverrides } from '../core/metadata.ts';

export type FeatureId = 'calculator' | 'notebook' | 'todo-list' | 'index-cards' | 'word-search' | 'crossword' | 'guide' | 'knowledge-check';
export type FeatureGroup = 'helpers' | 'applications' | 'mastery';
export const featureGroups: readonly { id: FeatureGroup; label: string }[] = [
  { id: 'helpers', label: 'Utilities' },
  { id: 'applications', label: 'Applications' },
  { id: 'mastery', label: 'Mastery' },
];

export interface FeatureDefinition {
  hidden?: boolean;
  id: FeatureId;
  group: FeatureGroup;
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
    group: 'helpers',
    version: '1.4.0',
    image: 'assets/app-icons/calculator.png',
    description: 'A scientific calculator for expressions and functions.',
    metadata: {
      keywords: ['calculator', 'scientific calculator', 'arithmetic', 'trigonometry', 'logarithms'],
      socialImage: {
        path: 'assets/app-icons/calculator.png',
        type: 'image/png',
        width: 1254,
        height: 1254,
        alt: 'Calculator — Glossy blue-and-white calculator with a 123 display and rounded number and arithmetic keys.',
      },
    },
  },
  {
    id: 'notebook', label: 'Notebook', path: '/notebook/', icon: 'document',
    group: 'helpers',
    version: '1.4.3',
    image: 'assets/app-icons/notebook.png',
    description: 'Organize notes into groups and keep your documents together in one notebook.',
  },
  {
    id: 'todo-list', label: 'Todo List', path: '/todo-list/', icon: 'checklist',
    group: 'helpers',
    version: '1.5.1',
    image: 'assets/app-icons/todo-list.png',
    description: 'Write, organize, and prioritize tasks in simple lists that archive automatically.',
    metadata: {
      keywords: ['todo list', 'tasks', 'checklist', 'task planning'],
      socialImage: {
        path: 'assets/app-icons/todo-list.png',
        type: 'image/png',
        width: 1254,
        height: 1254,
        alt: 'Todo List — Glossy blue-and-white clipboard with checkmarks and task lines.',
      },
    },
  },
  {
    id: 'index-cards', label: 'Index Cards', path: '/index-cards/', icon: 'cards',
    group: 'applications',
    version: '1.16.0',
    image: 'assets/app-icons/index-cards.png',
    description: 'Create flash cards or fill-in-the-blanks sets and review them at your own pace.',
  },
  {
    id: 'word-search', label: 'Word Search', path: '/word-search/', icon: 'word-search',
    group: 'applications',
    version: '1.5.11',
    image: 'assets/app-icons/word-search.png',
    description: 'Create your own word searches, find every word, and pick up where you left off.'
  },
  {
    id: 'crossword', label: 'Crossword', path: '/crossword/', icon: 'crossword',
    group: 'applications',
    version: '1.1.6',
    image: 'assets/app-icons/crossword.png',
    description: 'Create your own crosswords, solve the clues, and pick up where you left off.',
    metadata: {
      keywords: ['crossword', 'crossword puzzle', 'crossword maker', 'clues'],
      socialImage: {
        path: 'assets/app-icons/crossword.png',
        type: 'image/png',
        width: 1254,
        height: 1254,
        alt: 'Crossword — Glossy blue-and-white puzzle grid with letters, clue numbers, and blue blocked squares.',
      },
    },
  },
  {
    id: 'guide', label: 'Guide', path: '/guide/', icon: 'document',
    group: 'mastery',
    version: '1.5.4',
    image: 'assets/app-icons/guide.png',
    description: 'Build simple bullet lists or connected topic maps, then study a map one stop at a time.',
    metadata: {
      keywords: ['guide', 'study notes', 'learning', 'revision'],
      socialImage: {
        path: 'assets/app-icons/guide.png',
        type: 'image/png',
        width: 1254,
        height: 1254,
        alt: 'Guide — Glossy blue-and-white open book with a ribbon bookmark, note lines, and a highlighted star.',
      },
    },
  },
  {
    id: 'knowledge-check', label: 'Review', path: '/knowledge-check/', icon: 'checklist',
    group: 'mastery',
    version: '1.9.1',
    image: 'assets/app-icons/knowledge-check.png',
    description: 'Make knowledge sets to study, quiz yourself, or take a test.',
    metadata: {
      keywords: ['review', 'study', 'quiz', 'self assessment', 'learning'],
      socialImage: {
        path: 'assets/app-icons/knowledge-check.png',
        type: 'image/png',
        width: 1254,
        height: 1254,
        alt: 'Review — Glossy blue-and-white quiz sheet with a question mark, answer choices, and a checkmark badge.',
      },
    },
  },
];
