// TIPS content is intentionally separate from feature components so tutorials can evolve
// without coupling application behavior to onboarding copy. A step may optionally point at
// one or more DOM selectors; the first visible match becomes its spotlight target.
export const tipsCatalog = {
  notebook: {
    version: 2,
    steps: [
      {
        title: 'Build your notebook library',
        body: 'This library is the home for your groups and documents. Use groups for classes, subjects, projects, or any structure that fits the way you work.',
        target: '#notebook-library',
        targetLabel: 'Notebook library',
        placement: 'right',
      },
      {
        title: 'Create a document here',
        body: 'The document button opens the Notebook builder. New documents are created relative to the location you are currently browsing in the library.',
        target: '#notebook-library [aria-label="New document"]',
        targetLabel: 'New document button',
        placement: 'right',
      },
      {
        title: 'Markdown can come with you',
        body: 'This upload button imports an existing .md file into Notebook. It is useful when you already have notes outside Dynamic Learner.',
        target: '#notebook-library [aria-label="Upload Markdown file"]',
        targetLabel: 'Upload Markdown button',
        placement: 'right',
      },
      {
        title: 'Write Markdown your way',
        body: 'When a Markdown document is open, its toolbar lets you switch between Split, Source, and Preview views, swap the panels, and download the Markdown file.',
        target: ['.markdown-toolbar', '.notebook-empty-state'],
        targetLabel: 'Markdown workspace',
        placement: 'bottom',
      },
      {
        title: 'Make the workspace comfortable',
        body: 'The divider beside the library can be dragged to give your notes more room. Double-click it to return to the default width. On smaller screens, the library becomes a collapsible overlay instead.',
        target: ['.notebook-page .library-resizer', '#notebook-library'],
        targetLabel: 'Library sizing control',
        placement: 'right',
      },
    ],
  },
  'index-cards': {
    version: 2,
    steps: [
      {
        title: 'Build your card library',
        body: 'Groups organize subjects and sets hold the cards you actually study. The library stays available while you move between sets.',
        target: '#index-cards-library',
        targetLabel: 'Index Cards library',
        placement: 'right',
      },
      {
        title: 'Create a set here',
        body: 'This button creates a new card set in the location you are currently browsing. The folder button beside it creates a group instead.',
        target: '#index-cards-library [aria-label="New set"]',
        targetLabel: 'New set button',
        placement: 'right',
      },
      {
        title: 'Write on both sides',
        body: 'After you open a set, the main workspace becomes your card editor. Add cards, write directly on them, and use Show back or Show front to flip between sides.',
        target: ['.ruled-card-stack', '.card-set-empty', '.index-cards-detail'],
        targetLabel: 'Card workspace',
        placement: 'left',
      },
      {
        title: 'Review from the same workspace',
        body: 'The Review control appears above an active card. It lets you choose which side appears first and how the set is ordered without changing the cards themselves.',
        target: ['.card-review-session', '.index-cards-detail'],
        targetLabel: 'Review controls',
        placement: 'bottom',
      },
      {
        title: 'Adjust the layout',
        body: 'The library and Cards panel are resizable on larger screens. Drag their dividers for more room, or double-click a divider to reset it.',
        target: ['.index-cards-page .library-resizer', '#index-cards-library'],
        targetLabel: 'Resizable library',
        placement: 'right',
      },
    ],
  },
  'word-search': {
    version: 2,
    steps: [
      {
        title: 'Organize your puzzles',
        body: 'The library holds both groups and word searches. Use it to organize puzzles by subject, unit, class, or anything else that makes sense to you.',
        target: '#word-search-library',
        targetLabel: 'Word Search library',
        placement: 'right',
      },
      {
        title: 'Build a word search here',
        body: 'This button opens the word-search builder in the main workspace. New puzzles are saved relative to the location you are currently browsing.',
        target: '#word-search-library [aria-label="New word search"]',
        targetLabel: 'New word search button',
        placement: 'right',
      },
      {
        title: 'This is your puzzle workspace',
        body: 'The right side is where puzzle setup and play happen. Once a puzzle exists, this area becomes the interactive grid and its word or clue bank.',
        target: ['.word-search-play-layout', '.word-search-placeholder', '.word-search-detail'],
        targetLabel: 'Puzzle workspace',
        placement: 'left',
      },
      {
        title: 'Tune how puzzles look',
        body: 'Settings lives at the bottom of the library. Display changes apply across your word searches and save with your workspace.',
        target: '.word-search-settings-button',
        targetLabel: 'Word Search settings',
        placement: 'right',
      },
    ],
  },
};
