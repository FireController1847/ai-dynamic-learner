import type { TipsCatalog } from '../../packages/tips/src/index.ts';
import { knowledgeCheckTips } from './knowledge-check-tips.ts';

// Dynamic Learner's guide content lives here; the reusable TIPS engine does not know these selectors or feature IDs.
export const tipsCatalog: TipsCatalog = {
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


  calculator: {
    version: 7,
    sections: [
      {
        id: 'basics',
        title: 'Calculator',
        description: 'See what makes it different.',
        when: '.calculator-page',
        steps: [
          {
            title: 'Use the MathPrint display',
            body: 'Enter fractions with n/d, use ▲/▼ to move through fractions or recent entries, and press = to replace the entry with its answer.',
            target: ['.calculator-display', '.calculator-basic-keypad'],
            targetLabel: 'Calculator display and keypad',
            placement: 'bottom',
          },
          {
            title: 'Scientific and answer controls',
            body: 'Scientific opens advanced functions. DEG/RAD, FR↔DC, and Settings control how calculations and answers behave.',
            target: ['.calculator-scientific-toggle', '.calculator-angle-mode', '.calculator-fraction-toggle', '.calculator-settings-trigger'],
            targetLabel: 'Calculator controls',
            placement: 'bottom',
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
        description: 'Write notes on paper-style pages.',
        when: '.lined-editor',
        prepare: 'lined',
        steps: [
          {
            title: 'Write your notes',
            body: 'Type on the lines. New pages appear when you need them.',
            target: '.lined-paper-main',
            targetLabel: 'Writing area',
            placement: 'left',
          },
          {
            title: 'Add a page heading',
            body: 'Use the title at the top when a page needs a label.',
            target: '.lined-paper-title',
            targetLabel: 'Page heading',
            placement: 'bottom',
          },
          {
            title: 'Use the margin for small notes',
            body: 'Write short reminders, numbers, or labels in the margin.',
            target: '.lined-paper-margin',
            targetLabel: 'Margin',
            placement: 'right',
          },
        ],
      },
    ],
  },

  'todo-list': {
    version: 3,
    sections: [
      {
        id: 'library',
        title: 'Todo library',
        description: 'Make a list and find older ones.',
        when: '#todo-list-library',
        steps: [
          {
            title: 'Start a list',
            body: 'Press + to make a new list.',
            target: '#todo-list-library [aria-label="New todo list"]',
            targetLabel: 'New todo list button',
            placement: 'right',
          },
          {
            title: 'Find older lists',
            body: 'Older lists move to Archive automatically. Press Archive to find them.',
            target: '.todo-library-footer',
            targetLabel: 'Archive',
            placement: 'top',
          },
        ],
      },
      {
        id: 'writing',
        title: 'Writing tasks',
        description: 'Write and organize your tasks.',
        when: '.todo-task-editor',
        steps: [
          {
            title: 'Write your tasks',
            body: 'Type a task and press Enter for the next one.',
            target: '.todo-task-writing',
            targetLabel: 'Task writing area',
            placement: 'bottom',
          },
          {
            title: 'Make a section',
            body: 'Press Enter on an empty task to start a new section. Click its name to rename it.',
            target: '.todo-section-prefix',
            targetLabel: 'Section name',
            placement: 'right',
          },
          {
            title: 'Remove a task or section',
            body: 'Open ⋯ for more options. You can remove a task or remove a section there.',
            target: '.todo-row-tools',
            targetLabel: 'Task and section options',
            placement: 'right',
          },
          {
            title: 'Set a priority',
            body: 'Type a number next to P# to give the section a priority.',
            target: '.todo-section-priority-marker',
            targetLabel: 'Section priority',
            placement: 'right',
          },
          {
            title: 'Sort your sections',
            body: 'Use Sort to keep sections in your own order, by name, or by priority.',
            target: '.todo-sort-control',
            targetLabel: 'Sort sections',
            placement: 'bottom',
          },
          {
            title: 'Finish or skip a task',
            body: 'Check the box when you finish it. Press × if you want to skip it for now.',
            target: '.todo-task-margin',
            targetLabel: 'Task controls',
            placement: 'right',
          },
        ],
      },
    ],
  },

  'study-guide': {
    version: 1,
    sections: [],
  },

  'knowledge-check': knowledgeCheckTips,

  'index-cards': {
    version: 6,
    sections: [
      {
        id: 'library',
        title: 'Card library',
        description: 'Keep your sets and groups organized.',
        when: '#index-cards-library',
        steps: [
          {
            title: 'Your sets live here',
            body: 'Groups keep sets together. Pick a set to open it.',
            target: '#index-cards-library',
            targetLabel: 'Card library',
            placement: 'right',
          },
          {
            title: 'Make a set',
            body: 'Press New set, then choose how you want to study.',
            target: '#index-cards-library [aria-label="New set"]',
            targetLabel: 'New set button',
            placement: 'right',
          },
        ],
      },
      {
        id: 'creation',
        title: 'Choose a study mode',
        description: 'Choose how you want to use your cards.',
        when: '.index-cards-builder',
        prepare: 'creation',
        steps: [
          {
            title: 'Choose a study mode',
            body: 'Flash Cards use a front and back. Fill in the Blanks hides words for you to recall.',
            target: '.index-cards-mode-grid',
            targetLabel: 'Study modes',
            placement: 'left',
          },
        ],
      },
      {
        id: 'flash-cards',
        title: 'Flash Cards',
        description: 'Learn how to make and review flash cards.',
        when: '.card-set:not(.fill-blank-set)',
        prepare: 'flash-cards',
        steps: [
          {
            title: 'Write both sides',
            body: 'Put a prompt on the front and the answer on the back.',
            target: '.ruled-card-stack',
            targetLabel: 'Flash card',
            placement: 'left',
          },
          {
            title: 'Flip the card',
            body: 'Press Show back to see the answer. Show front takes you back.',
            target: '.card-flip-button',
            targetLabel: 'Flip card button',
            placement: 'bottom',
          },
          {
            title: 'Start a review',
            body: 'Review lets you practice the whole set.',
            target: '.card-review-button',
            targetLabel: 'Review button',
            placement: 'bottom',
            nextAction: { prepare: 'enable-review', click: '.card-review-button' },
          },
          {
            title: 'Choose the starting side',
            body: 'Choose whether to see the front or back first.',
            target: '.review-setup .review-choices',
            targetLabel: 'Starting side',
            placement: 'right',
            blockTarget: true,
            nextAction: { click: '.review-setup button[type="submit"]' },
          },
          {
            title: 'Choose the card order',
            body: 'Study from first to last, last to first, or mix the cards up.',
            target: '.review-setup .review-choices',
            targetLabel: 'Card order',
            placement: 'right',
            blockTarget: true,
            nextAction: { click: '.review-setup button[type="submit"]' },
          },
          {
            title: 'Review your cards',
            body: 'Try to remember the answer, then flip the card to check yourself.',
            target: '.card-review-session',
            targetLabel: 'Review status',
            placement: 'bottom',
            back: false,
          },
          {
            title: 'Keep going',
            body: 'Flip the card, then press Next card. Finish the review on the last card.',
            target: '.card-review-controls',
            targetLabel: 'Review controls',
            placement: 'bottom',
            back: false,
          },
        ],
        finishAction: { click: '[aria-label="End review"]' },
      },
      {
        id: 'fill-in-the-blanks',
        title: 'Fill in the Blanks',
        description: 'Learn how to make and review fill-in-the-blank cards.',
        when: '.fill-blank-set',
        prepare: 'fill-blank',
        steps: [
          {
            title: 'Write a prompt',
            body: 'Write a sentence or question for the card.',
            target: '.fill-blank-visual-editor',
            targetLabel: 'Prompt editor',
            placement: 'left',
          },
          {
            title: 'Make a blank',
            body: 'Select a word, then press Make blank. Remove blank puts it back.',
            target: '.fill-blank-edit-controls',
            targetLabel: 'Blank controls',
            placement: 'bottom',
          },
          {
            title: 'See the answers',
            body: 'Press Show back to see the answer key. Show front takes you back.',
            target: '.fill-blank-edit-flipper .card-flip-button, .fill-blank-set .card-flip-button',
            targetLabel: 'Flip card button',
            placement: 'bottom',
          },
          {
            title: 'Start a review',
            body: 'Review lets you practice the missing words.',
            target: '.card-review-button',
            targetLabel: 'Review button',
            placement: 'bottom',
            nextAction: { prepare: 'enable-review', click: '.card-review-button' },
          },
          {
            title: 'Choose the card order',
            body: 'Study from first to last, last to first, or mix the cards up.',
            target: '.review-setup .review-choices',
            targetLabel: 'Card order',
            placement: 'right',
            blockTarget: true,
            nextAction: { click: '.review-setup button[type="submit"]' },
          },
          {
            title: 'Fill the blanks',
            body: 'Type each missing word, then press Verify.',
            target: '.fill-blank-review-card',
            targetLabel: 'Fill-in-the-blank card',
            placement: 'left',
            nextAction: { click: '.fill-blank-verify-button' },
          },
          {
            title: 'Check your answers',
            body: 'Correct answers are green. Missed answers show the right answer.',
            target: '.fill-blank-results-card',
            targetLabel: 'Review results',
            placement: 'left',
            back: false,
          },
        ],
        finishAction: { click: '[aria-label="End review"]' },
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

  crossword: {
    version: 2,
    sections: [
      {
        id: 'library',
        title: 'Crossword library',
        description: 'Keep your puzzles organized.',
        when: '#crossword-library',
        steps: [
          {
            title: 'Your crosswords live here',
            body: 'This list holds your groups and crossword puzzles. Use groups to keep related puzzles together.',
            target: '#crossword-library',
            targetLabel: 'Crossword library',
            placement: 'right',
          },
          {
            title: 'Make a new crossword',
            body: 'Press this button to add answers and clues for a new puzzle.',
            target: '#crossword-library [aria-label="New crossword"]',
            targetLabel: 'New crossword button',
            placement: 'right',
          },
        ],
      },
      {
        id: 'creation',
        title: 'Making a crossword',
        description: 'Add answers and clues; the grid builds itself.',
        when: '.crossword-form',
        steps: [
          {
            title: 'Add the answers',
            body: 'Type the answers you want in the puzzle. Spaces and punctuation are removed from the grid.',
            target: '#crossword-answers',
            targetLabel: 'Answers box',
            placement: 'right',
          },
          {
            title: 'Write a clue for each answer',
            body: 'Every answer gets its own clue. The clue numbers are assigned automatically when the grid is built.',
            target: '.crossword-clue-fields',
            targetLabel: 'Clue fields',
            placement: 'top',
          },
          {
            title: 'Check whether the answers connect',
            body: 'Dynamic Learner checks the answer set as you type. If something cannot connect, this box explains what needs to change.',
            target: '#crossword-answer-validation',
            targetLabel: 'Answer validation',
            placement: 'right',
          },
        ],
      },
      {
        id: 'play',
        title: 'Solving a crossword',
        description: 'Move through the grid and use the clue list.',
        when: '.crossword-game',
        steps: [
          {
            title: 'Type directly into the grid',
            body: 'Choose a square and type. Arrow keys move around, and clicking an intersection again switches Across and Down.',
            target: '.crossword-grid',
            targetLabel: 'Crossword grid',
            placement: 'right',
          },
          {
            title: 'Pick clues from here',
            body: 'Across and Down clues select the matching word in the grid. Solved clues are marked automatically.',
            target: '.crossword-clues',
            targetLabel: 'Crossword clues',
            placement: 'left',
          },
          {
            title: 'Use puzzle help when you need it',
            body: 'Check your letters, reveal a cell or word, show answers temporarily, start over, or generate a new layout.',
            target: '.crossword-game-actions',
            targetLabel: 'Crossword controls',
            placement: 'top',
          },
        ],
      },
    ],
  },

};
