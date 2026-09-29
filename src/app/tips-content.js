// TIPS content is separate from feature components so onboarding can change without
// changing the apps themselves. Each section appears when that part of the app is open.
export const tipsCatalog = {
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
        description: 'Flip a card, then try Review mode.',
        when: '.card-flip-button',
        finishLabel: 'Open Review',
        finishAction: { click: '.card-review-button' },
        steps: [
          {
            title: 'Flip the card',
            body: 'Press this button to switch between the front and back of the card.',
            target: '.card-flip-button',
            targetLabel: 'Flip button',
            placement: 'bottom',
          },
          {
            title: 'Review helps you practice',
            body: 'Review can show the front or back first. It can also go in order or mix the cards. We will open Review for you next.',
            target: '.card-review-button',
            targetLabel: 'Review button',
            placement: 'bottom',
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
