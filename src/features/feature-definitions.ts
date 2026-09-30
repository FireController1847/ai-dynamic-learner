// Shared by the browser registry and webpack build; keep this data browser-neutral.
import type { PageMetadataOverrides } from '../core/metadata.ts';

export type FeatureId = 'notebook' | 'todo-list' | 'index-cards' | 'word-search';

export interface FeatureDefinition {
  hidden?: boolean;
  imageSrc?: string;
  id: FeatureId;
  label: string;
  path: `/${string}/`;
  icon: string;
  image: string;
  description: string;
  metadata?: PageMetadataOverrides;
}

export const featureDefinitions: readonly FeatureDefinition[] = [
  {
    id: 'notebook', label: 'Notebook', path: '/notebook/', icon: 'document',
    image: 'assets/notebook.png',
    description: 'Organize notes into groups and keep your documents together in one notebook.',
  },
  {
    id: 'todo-list', label: 'Todo List', path: '/todo-list/', icon: 'checklist',
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
    image: 'assets/index-cards.png',
    description: 'Organize your sets, write on both sides, and review at your own pace.',
  },
  {
    id: 'word-search', label: 'Word Search', path: '/word-search/', icon: 'word-search',
    image: 'assets/word-search.png',
    description: 'Create your own word searches, find every word, and pick up where you left off.'
  },
];
