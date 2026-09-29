// TIPS content is separate from feature components so onboarding can evolve without
// coupling application behavior to tutorial copy. Apps can define multiple contextual
// sections. A section becomes available when its `when` target is visible.
export const tipsCatalog = {
  notebook: {
    version: 4,
    sections: [
      {
        id: 'library',
        title: 'Notebook library',
        description: 'Organize your notes and start new documents.',
        when: '#notebook-library',
        steps: [
          {
            title: 'Keep everything organized here',
            body: 'The library holds both groups and documents. Groups can be nested, so you can organize notes around classes, projects, subjects, or whatever structure works for you.',
            target: '#notebook-library',
            targetLabel: 'Notebook library',
            placement: 'right',
          },
          {
            title: 'Create or import documents',
            body: 'Use these controls to create a new document or bring in a supported document file. New documents are placed relative to what you currently have selected.',
            target: '#notebook-library .directory-create-actions',
            targetLabel: 'Document controls',
            placement: 'right',
          },
        ],
      },
      {
        id: 'creation',
        title: 'Choose a document type',
        description: 'Pick the kind of document you want to create.',
        when: '.notebook-builder',
        steps: [
          {
            title: 'Choose the paper that fits the job',
            body: 'Each document type has its own editor and tools. Pick an available type to create it; more document types can be added here as Notebook grows.',
            target: '.notebook-type-grid',
            targetLabel: 'Document type choices',
            placement: 'left',
          },
        ],
      },
      {
        id: 'markdown',
        title: 'Markdown Paper',
        description: 'Learn the source, preview, and layout tools for Markdown documents.',
        when: '.markdown-workspace',
        steps: [
          {
            title: 'Write source and see the result',
            body: 'Markdown Paper keeps the editable Markdown source and its rendered preview together. In Split mode, changes on the source side appear in the preview beside it.',
            target: '.markdown-workspace',
            targetLabel: 'Markdown editor',
            placement: 'top',
          },
          {
            title: 'Change the editor layout',
            body: 'Use Split, Source, or Preview depending on what you want to focus on. In Split mode you can also swap the panels and resize the divider.',
            target: '.markdown-toolbar',
            targetLabel: 'Markdown layout controls',
            placement: 'bottom',
          },
          {
            title: 'Use the helpers when you need them',
            body: 'Cheatsheet gives you Markdown syntax help, Contents navigates headings in the preview, and the download control saves the current document as a Markdown file.',
            target: ['.markdown-source-panel', '.markdown-preview-panel', '.markdown-toolbar'],
            targetLabel: 'Markdown document tools',
            placement: 'top',
          },
        ],
      },
    ],
  },

  'index-cards': {
    version: 4,
    sections: [
      {
        id: 'library',
        title: 'Card library',
        description: 'Organize groups and sets, then open the set you want to study.',
        when: '#index-cards-library',
        steps: [
          {
            title: 'Organize subjects and sets here',
            body: 'Groups keep related material together, while sets contain the cards you actually study. Select a set to open it.',
            target: '#index-cards-library',
            targetLabel: 'Index Cards library',
            placement: 'right',
          },
          {
            title: 'Create a set when you are ready',
            body: 'Use the set button to create cards in the location you are currently browsing. The folder button beside it creates another group.',
            target: '#index-cards-library [aria-label="New set"]',
            targetLabel: 'New set button',
            placement: 'right',
          },
        ],
      },
      {
        id: 'set',
        title: 'Working with a set',
        description: 'Write cards, review them, and move through the set.',
        when: '.index-cards-detail.is-set',
        steps: [
          {
            title: 'Write directly on your cards',
            body: 'The main card is your editor. Use Show back or Show front to switch sides, and Previous or Next to move through the set.',
            target: ['.ruled-card-stack', '.card-set-empty', '.card-review-controls'],
            targetLabel: 'Card editor',
            placement: 'left',
          },
          {
            title: 'Review changes how you study, not what you saved',
            body: 'Review lets you choose which side appears first and whether cards run forward, backward, or shuffled. Your card contents stay unchanged.',
            target: ['.card-review-session', '.index-cards-detail.is-set'],
            targetLabel: 'Review controls',
            placement: 'bottom',
          },
          {
            title: 'Jump to any card from the Cards panel',
            body: 'The Cards panel shows the whole set at a glance. Select any card to jump straight to it, or add another card from the panel.',
            target: '.card-list-panel',
            targetLabel: 'Cards panel',
            placement: 'left',
          },
        ],
      },
    ],
  },

  'word-search': {
    version: 4,
    sections: [
      {
        id: 'library',
        title: 'Word Search library',
        description: 'Organize groups and puzzles, then open or create one.',
        when: '#word-search-library',
        steps: [
          {
            title: 'Keep your puzzles organized here',
            body: 'The library holds both groups and word searches. Use groups for subjects, units, classes, or any other structure that helps you find a puzzle again.',
            target: '#word-search-library',
            targetLabel: 'Word Search library',
            placement: 'right',
          },
          {
            title: 'Create a new puzzle here',
            body: 'This button opens the puzzle builder. Nothing is saved until you finish the form and create the word search.',
            target: '#word-search-library [aria-label="New word search"]',
            targetLabel: 'New word search button',
            placement: 'right',
          },
        ],
      },
      {
        id: 'creation',
        title: 'Creating a puzzle',
        description: 'Choose the words and the learning experience you want.',
        when: '.word-search-form',
        steps: [
          {
            title: 'Start with the words learners should find',
            body: 'Enter the answer words here. The builder checks duplicates and warns when a word will not fit the selected grid.',
            target: '#puzzle-words',
            targetLabel: 'Words to find',
            placement: 'right',
          },
          {
            title: 'Control how difficult the search is',
            body: 'Grid size controls the available space, while difficulty changes the directions and patterns used to hide words.',
            target: ['.word-search-difficulty', '#puzzle-size'],
            targetLabel: 'Grid size and difficulty',
            placement: 'left',
          },
          {
            title: 'Choose words or clues',
            body: 'Study display decides whether learners see the answers they are looking for or work from clue-style hints instead.',
            target: '.word-search-study-mode',
            targetLabel: 'Study display',
            placement: 'left',
          },
        ],
      },
      {
        id: 'play',
        title: 'Solving a puzzle',
        description: 'Learn the grid, answer bank, and puzzle actions.',
        when: '.word-search-game',
        steps: [
          {
            title: 'Select words directly on the grid',
            body: 'Drag across a word or choose its two endpoints. Found words are tracked automatically as you solve the puzzle.',
            target: ['.word-search-play-layout', '.word-search-game'],
            targetLabel: 'Puzzle grid',
            placement: 'left',
          },
          {
            title: 'Follow the word list or clues',
            body: 'This panel shows either the words to find or clue-style prompts, depending on how the puzzle was created.',
            target: '.word-search-word-bank',
            targetLabel: 'Word or clue bank',
            placement: 'left',
          },
          {
            title: 'Use puzzle actions when you need them',
            body: 'Hint can point you in the right direction. You can also reveal answers, restart the current grid, or generate a new arrangement.',
            target: '.word-search-game-actions',
            targetLabel: 'Puzzle actions',
            placement: 'top',
          },
        ],
      },
    ],
  },
};
