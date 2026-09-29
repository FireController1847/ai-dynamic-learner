// TIPS content is separate from feature components so onboarding can evolve without
// coupling application behavior to tutorial copy. Apps can define multiple contextual
// sections. A section becomes available when its `when` target is visible.
export const tipsCatalog = {
  notebook: {
    version: 3,
    sections: [
      {
        id: 'library',
        title: 'Notebook library',
        description: 'Organize groups and documents, create new items, and import supported files.',
        when: '#notebook-library',
        steps: [
          {
            title: 'Everything starts in the library',
            body: 'Groups and documents live here. Use groups to organize by class, subject, project, or any structure that fits the way you work.',
            target: '#notebook-library',
            targetLabel: 'Notebook library',
            placement: 'right',
          },
          {
            title: 'Create a new document',
            body: 'This button opens the document builder. The builder is where you choose what kind of document you want to create.',
            target: '#notebook-library [aria-label="New document"]',
            targetLabel: 'New document button',
            placement: 'right',
          },
          {
            title: 'Import documents here',
            body: 'The import control is the entry point for bringing supported document files into Notebook. More document formats can plug into this same workflow as Notebook grows.',
            target: '#notebook-library [aria-label="Import document"]',
            targetLabel: 'Import document button',
            placement: 'right',
          },
          {
            title: 'Give yourself more room',
            body: 'On larger screens, drag the divider beside the library to resize it. Double-click the divider to reset its width. On smaller screens, the library becomes a collapsible overlay.',
            target: ['.notebook-page .library-resizer', '#notebook-library'],
            targetLabel: 'Library sizing control',
            placement: 'right',
          },
        ],
      },
      {
        id: 'creation',
        title: 'Creating documents',
        description: 'Choose a document type and understand how the document builder works.',
        when: '.notebook-builder',
        steps: [
          {
            title: 'Choose the kind of document you need',
            body: 'Notebook is built around document types. Each type can provide its own editor, behavior, and presentation while still living in the same library.',
            target: '.notebook-builder',
            targetLabel: 'Document builder',
            placement: 'left',
          },
          {
            title: 'Document types live here',
            body: 'Each card represents a different kind of document. Available types can be selected now, while unavailable cards show document types that are planned for later.',
            target: '.notebook-type-grid',
            targetLabel: 'Document type choices',
            placement: 'left',
          },
          {
            title: 'Your choice determines the editor',
            body: 'Selecting a type creates that document and opens the editor designed for it. Notebook itself stays document-agnostic so new document types can be added over time.',
            target: ['.notebook-type-card:not([aria-disabled="true"])', '.notebook-type-grid'],
            targetLabel: 'Available document type',
            placement: 'left',
          },
        ],
      },
      {
        id: 'workspace',
        title: 'Working with documents',
        description: 'Understand the common document workspace shared by every Notebook document type.',
        when: '.notebook-detail.is-document',
        steps: [
          {
            title: 'This is the document workspace',
            body: 'The main area changes based on the document type you opened. Different types can provide very different editors while keeping the same Notebook structure around them.',
            target: '.notebook-detail.is-document',
            targetLabel: 'Document workspace',
            placement: 'left',
          },
          {
            title: 'Editor controls belong to the document type',
            body: 'Controls in this area are specific to the document you opened. A text document, graph-paper document, or future document type can each expose the tools that make sense for it.',
            target: ['.markdown-toolbar', '.notebook-editor-scaffold', '.notebook-detail.is-document'],
            targetLabel: 'Document-specific editor',
            placement: 'bottom',
          },
          {
            title: 'Organization stays consistent',
            body: 'No matter which document type you use, Location and order lets you move the document between groups and control where it appears in the library.',
            target: '.notebook-detail.is-document .item-organization',
            targetLabel: 'Location and order',
            placement: 'top',
          },
        ],
      },
    ],
  },

  'index-cards': {
    version: 3,
    sections: [
      {
        id: 'library',
        title: 'Card library',
        description: 'Organize groups and sets, then open the set you want to study.',
        when: '#index-cards-library',
        steps: [
          {
            title: 'Organize your card sets here',
            body: 'Groups organize subjects and sets hold the cards you actually study. Select a set to open its workspace.',
            target: '#index-cards-library',
            targetLabel: 'Index Cards library',
            placement: 'right',
          },
          {
            title: 'Create a new set',
            body: 'This button creates a set in the location you are currently browsing. The folder button beside it creates a group.',
            target: '#index-cards-library [aria-label="New set"]',
            targetLabel: 'New set button',
            placement: 'right',
          },
          {
            title: 'Display settings live here',
            body: 'Settings controls how cards are presented across the app without changing the contents of your sets.',
            target: '#index-cards-library .library-settings-button',
            targetLabel: 'Index Cards settings',
            placement: 'right',
          },
        ],
      },
      {
        id: 'set',
        title: 'Working with a set',
        description: 'Write cards, flip between sides, review the set, and move through the card list.',
        when: '.index-cards-detail.is-set',
        steps: [
          {
            title: 'This is your card workspace',
            body: 'The center area is where you write and review cards. If the set is empty, start by adding the first card.',
            target: ['.ruled-card-stack', '.card-set-empty', '.index-cards-detail.is-set'],
            targetLabel: 'Card workspace',
            placement: 'left',
          },
          {
            title: 'Flip between the two sides',
            body: 'Cards have a front and a back. The main card controls let you reveal the other side and move between cards.',
            target: ['.card-review-controls', '.card-set-empty', '.index-cards-detail.is-set'],
            targetLabel: 'Card navigation and flip controls',
            placement: 'bottom',
          },
          {
            title: 'Review without changing your cards',
            body: 'Review lets you choose which side appears first and how the set is ordered. Your saved cards stay the same.',
            target: ['.card-review-session', '.index-cards-detail.is-set'],
            targetLabel: 'Review controls',
            placement: 'bottom',
          },
          {
            title: 'The Cards panel keeps the whole set visible',
            body: 'Use this panel to jump directly to another card or add a new one. On larger screens, its divider can be resized too.',
            target: ['.card-list-panel', '.index-cards-detail.is-set'],
            targetLabel: 'Cards panel',
            placement: 'left',
          },
        ],
      },
    ],
  },

  'word-search': {
    version: 3,
    sections: [
      {
        id: 'library',
        title: 'Word Search library',
        description: 'Organize groups and puzzles, then open or create the one you want.',
        when: '#word-search-library',
        steps: [
          {
            title: 'Organize your puzzles here',
            body: 'The library holds both groups and word searches. Use it to organize puzzles by subject, unit, class, or anything else that makes sense to you.',
            target: '#word-search-library',
            targetLabel: 'Word Search library',
            placement: 'right',
          },
          {
            title: 'Create a word search',
            body: 'This button opens the word-search creation page in the main workspace. Nothing is saved until you finish the form.',
            target: '#word-search-library [aria-label="New word search"]',
            targetLabel: 'New word search button',
            placement: 'right',
          },
          {
            title: 'Display settings live here',
            body: 'Settings controls how puzzle grids are presented across Word Search without changing the words inside a saved puzzle.',
            target: '.word-search-settings-button',
            targetLabel: 'Word Search settings',
            placement: 'right',
          },
        ],
      },
      {
        id: 'creation',
        title: 'Creating a puzzle',
        description: 'See how the word list, difficulty, study display, and puzzle settings fit together.',
        when: '.word-search-form',
        steps: [
          {
            title: 'This page builds the puzzle',
            body: 'Give the word search a title, add the words you want included, and choose how the generated puzzle should behave.',
            target: '.word-search-form',
            targetLabel: 'Word Search creation page',
            placement: 'left',
          },
          {
            title: 'Your word list drives the puzzle',
            body: 'Add the words learners should find here. The preview and validation help you catch duplicates or words that will not fit the selected grid.',
            target: '#puzzle-words',
            targetLabel: 'Words to find',
            placement: 'right',
          },
          {
            title: 'Difficulty changes how words are hidden',
            body: 'Choose the difficulty and grid size to control how challenging the generated search will be.',
            target: ['.word-search-difficulty', '#puzzle-size'],
            targetLabel: 'Puzzle difficulty and size',
            placement: 'left',
          },
          {
            title: 'Choose the study experience',
            body: 'Study display decides whether the player sees the answer list directly or works from clues. This lets the same puzzle format support different learning styles.',
            target: '.word-search-study-mode',
            targetLabel: 'Study display',
            placement: 'left',
          },
        ],
      },
      {
        id: 'play',
        title: 'Solving a puzzle',
        description: 'Learn the grid, answer bank, hints, and puzzle actions while a saved word search is open.',
        when: '.word-search-game',
        steps: [
          {
            title: 'This is the playable puzzle',
            body: 'Select a word by dragging across its letters or choosing its two endpoints. The grid tracks found words as you solve.',
            target: ['.word-search-play-layout', '.word-search-game'],
            targetLabel: 'Playable word search',
            placement: 'left',
          },
          {
            title: 'Your answers or clues stay beside the grid',
            body: 'This panel shows the words to find or clue-style prompts, depending on how the puzzle was configured.',
            target: '.word-search-word-bank',
            targetLabel: 'Word or clue bank',
            placement: 'left',
          },
          {
            title: 'Puzzle actions are down here',
            body: 'Use Hint when you need help, reveal answers when appropriate, restart the current grid, or generate a new arrangement.',
            target: '.word-search-game-actions',
            targetLabel: 'Puzzle actions',
            placement: 'top',
          },
        ],
      },
    ],
  },
};
