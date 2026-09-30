import type { FeatureId } from '../features/feature-definitions.ts';
export type TipsFeatureId = FeatureId | 'home';
export interface TipsFeature { id: TipsFeatureId; label: string }
export type TargetSelector = string | string[];
export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center';
export interface StepAction { click: TargetSelector }
export interface TipStep {
  title: string; body: string; target: TargetSelector; targetLabel: string;
  placement?: Placement; nextAction?: StepAction; backAction?: StepAction;
  nextLabel?: string; back?: boolean;
}
export interface TipSection {
  id: string; title: string; description: string; steps: TipStep[];
  when?: TargetSelector; prepare?: string; auto?: boolean; finishLabel?: string;
  continueToAvailable?: boolean; finishAction?: StepAction;
}
export interface Tutorial { version: number; sections: TipSection[] }

// TIPS content is separate from feature components so onboarding can change without
// changing the apps themselves. Each section appears when that part of the app is open.
export const tipsCatalog: Record<TipsFeatureId, Tutorial> = {
  home: {
    version: 1,
    sections: [
      {
        id: 'getting-started',
        title: 'Getting started',
        description: 'Learn where to find help and how to open an app.',
        when: '.home-page',
        steps: [
          {
            title: 'Tips can show you around',
            body: 'Press Tips anytime you want help with the page you are using.',
            target: '.tips-trigger',
            targetLabel: 'Tips button',
            placement: 'bottom',
          },
          {
            title: 'Pick an app to begin',
            body: 'Choose one of these apps. You can always come back home and pick another one.',
            target: '.home-app-grid',
            targetLabel: 'Learning apps',
            placement: 'top',
          },
        ],
      },
    ],
  },

  notebook: {
    version: 5,
    sections: [
      {
        id: 'library',
        title: 'Notebook library',
        description: 'Keep your groups and documents organized.',
        when: '#notebook-library',
        steps: [
          {
            title: 'Your notes live here',
            body: 'This list holds your groups and documents. You can put groups inside other groups to keep things easy to find.',
            target: '#notebook-library',
            targetLabel: 'Notebook library',
            placement: 'right',
          },
          {
            title: 'Make or import a document',
            body: 'Use these buttons to make a new group, make a new document, or import a supported file.',
            target: '#notebook-library .directory-create-actions',
            targetLabel: 'New and import buttons',
            placement: 'right',
          },
        ],
      },
      {
        id: 'creation',
        title: 'Choose a document type',
        description: 'Pick the kind of page you want.',
        when: '.notebook-builder',
        prepare: 'creation',
        steps: [
          {
            title: 'Pick the kind of page you want',
            body: 'Each type of document has its own tools. Pick one of the available choices to make that document.',
            target: '.notebook-type-grid',
            targetLabel: 'Document choices',
            placement: 'left',
          },
        ],
      },
      {
        id: 'markdown',
        title: 'Markdown Paper',
        description: 'Learn the main tools for Markdown Paper.',
        when: '.markdown-workspace',
        prepare: 'markdown',
        steps: [
          {
            title: 'Write on one side and see the result',
            body: 'In Split view, you type Markdown on one side. The other side shows what the finished page will look like.',
            target: '.markdown-workspace',
            targetLabel: 'Markdown editor',
            placement: 'top',
          },
          {
            title: 'Pick the view you like',
            body: 'Split shows both sides. Source shows only what you type. Preview shows only the finished page. You can also swap the two sides.',
            target: '.markdown-toolbar',
            targetLabel: 'View buttons',
            placement: 'bottom',
          },
          {
            title: 'Help is built in',
            body: 'Cheatsheet shows Markdown examples. Contents helps you jump to headings. Download saves a copy of the file.',
            target: ['.markdown-source-panel', '.markdown-preview-panel', '.markdown-toolbar'],
            targetLabel: 'Markdown tools',
            placement: 'top',
          },
        ],
      },
      {
        id: 'lined',
        title: 'Lined Paper',
        description: 'Write notes, add page headings, and make the paper your own.',
        when: '.lined-editor',
        prepare: 'lined',
        steps: [
          {
            title: 'Give each sheet its own heading',
            body: 'Type a heading at the top of each page. Each sheet has its own heading, and changing it does not rename the document in your library.',
            target: '.lined-paper-title',
            targetLabel: 'Page heading',
            placement: 'bottom',
          },
          {
            title: 'Write on the lines',
            body: 'Write your notes here. Your changes save automatically in this browser. A workspace backup keeps a copy you can restore or move to another device.',
            target: '.lined-paper-main',
            targetLabel: 'Main writing area',
            placement: 'left',
          },
          {
            title: 'Keep little notes in the margin',
            body: 'The space to the left of the red line is a separate writing area. Use it for numbers, dates, or short reminders. Its text lines up against the right edge.',
            target: '.lined-paper-margin',
            targetLabel: 'Margin writing area',
            placement: 'right',
          },
          {
            title: 'Keep writing onto another sheet',
            body: 'When a page fills up, more sheets appear below it. Each new heading starts blank. Changing the window size or paper settings can move page breaks; headings stay with their page numbers. Margin notes flow separately from the main notes.',
            target: '.lined-page-number',
            targetLabel: 'Page number',
            placement: 'top',
          },
          {
            title: 'Make the paper comfortable to read',
            body: 'Open the Library, then Settings and the Lined Paper tab. Pick your font, text size, ink, ruling, paper size, punch holes, and text alignment. These settings apply to all lined documents; Markdown has its own tab.',
            target: ['#notebook-library .library-settings-button', '.notebook-page .library-floating-toggle'],
            targetLabel: 'Library settings',
            placement: 'right',
          },
        ],
      },
    ],
  },

  'todo-list': {
    version: 2,
    sections: [
      {
        id: 'library',
        title: 'Todo library',
        description: 'Create lists and find older ones.',
        when: '#todo-list-library',
        steps: [
          {
            title: 'Start a list',
            body: 'Press + to create a list. Lists are organized by when you made them; no due date needed.',
            target: '#todo-list-library [aria-label="New todo list"]',
            targetLabel: 'New todo list button',
            placement: 'right',
          },
          {
            title: 'Keep older lists',
            body: 'Lists fade as they age, then move to Archive. Settings lets you change that timing and the paper’s appearance. Archived lists stay editable.',
            target: '.todo-library-footer',
            targetLabel: 'Settings and Archive',
            placement: 'top',
          },
        ],
      },
      {
        id: 'writing',
        title: 'Writing tasks',
        description: 'Open a list to learn sections, priorities, and checkboxes.',
        when: '.todo-task-editor',
        steps: [
          {
            title: 'Write in sections',
            body: 'Click the section name to change the prefix on its tasks. Enter adds a task; Enter on an empty task starts a section. Shift+Enter adds a line.',
            target: '.todo-task-writing',
            targetLabel: 'Task writing area',
            placement: 'bottom',
          },
          {
            title: 'Give a section priority',
            body: 'Type 1 here for P#1. The priority applies to the whole section.',
            target: '.todo-section-priority-marker',
            targetLabel: 'Section priority',
            placement: 'right',
          },
          {
            title: 'Done or skipping it?',
            body: 'Check the box when done. Click × to skip or defer: the task is crossed out and moves to the top of its section. Click × again to restore it.',
            target: '.todo-task-margin',
            targetLabel: 'Skip and completion controls',
            placement: 'right',
          },
        ],
      },
    ],
  },

  'index-cards': {
    version: 5,
    sections: [
      {
        id: 'library',
        title: 'Card library',
        description: 'Keep your groups and card sets organized.',
        when: '#index-cards-library',
        steps: [
          {
            title: 'Your card sets live here',
            body: 'Groups help you sort things. Sets hold the cards you study. Pick a set to open it.',
            target: '#index-cards-library',
            targetLabel: 'Card library',
            placement: 'right',
          },
          {
            title: 'Make a new set',
            body: 'Press this button to make a new set. The folder button next to it makes a new group.',
            target: '#index-cards-library [aria-label="New set"]',
            targetLabel: 'New set button',
            placement: 'right',
          },
        ],
      },
      {
        id: 'set',
        title: 'Making cards',
        description: 'Add cards and write what you want to study.',
        when: '.index-cards-detail.is-set',
        prepare: 'set',
        continueToAvailable: true,
        steps: [
          {
            title: 'Add a card and write on it',
            body: 'A card has a front and a back. Add your first card, then type what you want to study.',
            target: ['.card-set-empty', '.ruled-card-stack'],
            targetLabel: 'Card',
            placement: 'left',
          },
          {
            title: 'See all your cards here',
            body: 'This list shows every card in the set. Press a card to jump to it.',
            target: ['.card-list-panel', '.index-cards-detail.is-set'],
            targetLabel: 'Cards list',
            placement: 'left',
          },
        ],
      },
      {
        id: 'review',
        title: 'Flip and review',
        description: 'Flip a card, then learn Review mode.',
        when: '.card-flip-button',
        prepare: 'review',
        steps: [
          {
            title: 'Flip the card',
            body: 'Press this button to switch between the front and back.',
            target: '.card-flip-button',
            targetLabel: 'Flip button',
            placement: 'bottom',
          },
          {
            title: 'Start Review mode',
            body: 'Review helps you practice the whole set. We will open it for you.',
            target: '.card-review-button',
            targetLabel: 'Review button',
            placement: 'bottom',
            nextLabel: 'Open Review',
            nextAction: { click: '.card-review-button' },
          },
          {
            title: 'Pick which side you see first',
            body: 'Choose Front first or Back first. You will try to remember the other side before you flip the card.',
            target: '.review-setup .review-choices',
            targetLabel: 'Starting side',
            placement: 'right',
            nextAction: { click: '.review-setup button[type="submit"]' },
            backAction: { click: '.review-setup .review-cancel-button' },
          },
          {
            title: 'Pick the card order',
            body: 'Go from first to last, last to first, or mix the cards up.',
            target: '.review-setup .review-choices',
            targetLabel: 'Card order',
            placement: 'right',
            nextLabel: 'Start Review',
            nextAction: { click: '.review-setup button[type="submit"]' },
            backAction: { click: '.review-setup .review-previous-button' },
          },
          {
            title: 'Now you are reviewing',
            body: 'Look at the first side and try to remember the answer. Then flip the card to check yourself.',
            target: '.card-review-session',
            targetLabel: 'Review status',
            placement: 'bottom',
            back: false,
          },
          {
            title: 'Flip, then move to the next card',
            body: 'Show the other side, then press Next card. On the last card, that button finishes the review.',
            target: '.card-review-controls',
            targetLabel: 'Review buttons',
            placement: 'bottom',
            back: false,
          },
        ],
      },
    ],
  },

  'word-search': {
    version: 5,
    sections: [
      {
        id: 'library',
        title: 'Word Search library',
        description: 'Keep your puzzles organized.',
        when: '#word-search-library',
        steps: [
          {
            title: 'Your puzzles live here',
            body: 'This list holds your groups and word searches. Use groups to keep similar puzzles together.',
            target: '#word-search-library',
            targetLabel: 'Word Search library',
            placement: 'right',
          },
          {
            title: 'Make a new word search',
            body: 'Press this button to start making a puzzle.',
            target: '#word-search-library [aria-label="New word search"]',
            targetLabel: 'New word search button',
            placement: 'right',
          },
        ],
      },
      {
        id: 'creation',
        title: 'Making a puzzle',
        description: 'Choose the words and how hard the puzzle should be.',
        when: '.word-search-form',
        prepare: 'creation',
        steps: [
          {
            title: 'Add the words to find',
            body: 'Type the words you want in the puzzle here. You can put one word on each line.',
            target: '#puzzle-words',
            targetLabel: 'Words box',
            placement: 'right',
          },
          {
            title: 'Pick the size and difficulty',
            body: 'A bigger grid gives words more room. Difficulty changes the ways words can be hidden.',
            target: ['.word-search-difficulty', '#puzzle-size'],
            targetLabel: 'Size and difficulty',
            placement: 'left',
          },
          {
            title: 'Show words or clues',
            body: 'You can show the words people need to find, or give them clues instead.',
            target: '.word-search-study-mode',
            targetLabel: 'Study display',
            placement: 'left',
          },
        ],
      },
      {
        id: 'play',
        title: 'Solving a puzzle',
        description: 'Learn how to find words and use puzzle help.',
        when: '.word-search-game',
        prepare: 'play',
        steps: [
          {
            title: 'Find a word on the grid',
            body: 'Drag across a word. You can also pick the first letter and then the last letter.',
            target: ['.word-search-play-layout', '.word-search-game'],
            targetLabel: 'Puzzle grid',
            placement: 'left',
          },
          {
            title: 'Check what is left',
            body: 'This box shows the words to find, or the clues you need to solve.',
            target: '.word-search-word-bank',
            targetLabel: 'Words or clues',
            placement: 'left',
          },
          {
            title: 'Use help if you need it',
            body: 'Hint gives you a small clue. You can also show answers, start over, or make a new layout.',
            target: '.word-search-game-actions',
            targetLabel: 'Puzzle buttons',
            placement: 'top',
          },
        ],
      },
    ],
  },
};
