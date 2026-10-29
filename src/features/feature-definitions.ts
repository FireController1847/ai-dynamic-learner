// Shared by the browser registry and webpack build; keep this data browser-neutral.
import type { PageMetadataOverrides } from '../core/metadata.ts';

export type FeatureId = 'calculator' | 'anatomy' | 'notebook' | 'todo-list' | 'solve-it-grid' | 'index-cards' | 'word-search' | 'crossword' | 'guide' | 'knowledge-check';
export type FeatureGroup = 'tools' | 'work' | 'study' | 'master';
export const featureGroups: readonly { id: FeatureGroup; label: string }[] = [
  { id: 'tools', label: 'Tools' },
  { id: 'work', label: 'Work' },
  { id: 'study', label: 'Study' },
  { id: 'master', label: 'Master' },
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
    group: 'tools',
    version: '1.9.4',
    image: 'assets/app-icons/calculator.png',
    description: 'A scientific calculator for expressions and functions.',
    metadata: {
      keywords: ['calculator', 'scientific calculator', 'arithmetic', 'trigonometry', 'logarithms'],
      socialImage: {
        path: 'assets/app-icons/calculator.png',
        type: 'image/png',
        width: 350,
        height: 350,
        alt: 'Calculator — Layered blue calculator with a pale display and cyan arithmetic keys.',
      },
    },
  },
  {
    id: 'anatomy', label: 'Anatomy', path: '/anatomy/', icon: 'anatomy',
    group: 'tools',
    version: '0.13.2',
    image: 'assets/app-icons/anatomy.png',
    description: 'Explore selectable skeletal, muscular, nervous, endocrine and cardiovascular systems in an offline 2D atlas.',
    metadata: {
      keywords: ['human anatomy', 'body systems', 'skeletal', 'muscular', 'nervous', 'endocrine', 'cardiovascular', 'heart', 'blood vessels', 'anatomical atlas'],
      socialImage: {
        path: 'assets/app-icons/anatomy.png',
        type: 'image/png',
        width: 1408,
        height: 1408,
        alt: 'Anatomy — Layered blue human torso with an icy-blue ribcage and cyan heart.',
      },
    },
  },
  {
    id: 'notebook', label: 'Notebook', path: '/notebook/', icon: 'document',
    group: 'work',
    version: '1.7.1',
    image: 'assets/app-icons/notebook.png',
    description: 'Organize notes into groups and keep your documents together in one notebook.',
  },
  {
    id: 'todo-list', label: 'Todo List', path: '/todo-list/', icon: 'checklist',
    group: 'work',
    version: '1.6.4',
    image: 'assets/app-icons/todo-list.png',
    description: 'Write, organize, and prioritize tasks in simple lists that archive automatically.',
    metadata: {
      keywords: ['todo list', 'tasks', 'checklist', 'task planning'],
      socialImage: {
        path: 'assets/app-icons/todo-list.png',
        type: 'image/png',
        width: 1254,
        height: 1254,
        alt: 'Todo List — Pale blue checklist with cyan checkboxes and a layered blue folded corner.',
      },
    },
  },
  {
    id: 'solve-it-grid', label: 'Solve-It Grid', path: '/solve-it-grid/', icon: 'grid',
    group: 'work',
    version: '1.3.2',
    image: 'assets/app-icons/solve-it-grid.png',
    description: 'Build four task lists, then follow a lively grid that turns them into one task at a time.',
    metadata: {
      keywords: ['solve-it grid', 'four-section chart', 'behavior reflection'],
      socialImage: {
        path: 'assets/app-icons/solve-it-grid.png',
        type: 'image/png',
        width: 1254,
        height: 1254,
        alt: 'Solve-It Grid — A layered blue four-section chart with a cyan checkmark.',
      },
    },
  },
  {
    id: 'index-cards', label: 'Index Cards', path: '/index-cards/', icon: 'cards',
    group: 'study',
    version: '1.24.1',
    image: 'assets/app-icons/index-cards.png',
    description: 'Create flash cards or fill-in-the-blanks sets, then review or view them at your own pace.',
  },
  {
    id: 'word-search', label: 'Word Search', path: '/word-search/', icon: 'word-search',
    group: 'study',
    version: '1.14.1',
    image: 'assets/app-icons/word-search.png',
    description: 'Create your own word searches, find every word, and pick up where you left off.'
  },
  {
    id: 'crossword', label: 'Crossword', path: '/crossword/', icon: 'crossword',
    group: 'study',
    version: '1.9.1',
    image: 'assets/app-icons/crossword.png',
    description: 'Create your own crosswords, solve the clues, and pick up where you left off.',
    metadata: {
      keywords: ['crossword', 'crossword puzzle', 'crossword maker', 'clues'],
      socialImage: {
        path: 'assets/app-icons/crossword.png',
        type: 'image/png',
        width: 350,
        height: 350,
        alt: 'Crossword — An azure blue and icy-white crossword grid.',
      },
    },
  },
  {
    id: 'guide', label: 'Guide', path: '/guide/', icon: 'document',
    group: 'master',
    version: '1.12.1',
    image: 'assets/app-icons/guide.png',
    description: 'Build simple bullet lists or connected topic maps, then study a map one stop at a time.',
    metadata: {
      keywords: ['guide', 'study notes', 'learning', 'revision'],
      socialImage: {
        path: 'assets/app-icons/guide.png',
        type: 'image/png',
        width: 350,
        height: 350,
        alt: 'Guide — A folded study map with connected waypoints and a destination flag.',
      },
    },
  },
  {
    id: 'knowledge-check', label: 'Review', path: '/knowledge-check/', icon: 'checklist',
    group: 'master',
    version: '1.47.3',
    image: 'assets/app-icons/knowledge-check.png',
    description: 'Make knowledge sets to study, quiz yourself, or take a test.',
    metadata: {
      keywords: ['review', 'study', 'quiz', 'self assessment', 'learning'],
      socialImage: {
        path: 'assets/app-icons/knowledge-check.png',
        type: 'image/png',
        width: 350,
        height: 350,
        alt: 'Review — A layered blue document with a folded corner and a cyan checkmark badge.',
      },
    },
  },
];
