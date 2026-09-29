// TIPS content is intentionally separate from feature components so tutorials can evolve
// without coupling application behavior to onboarding copy.
export const tipsCatalog = {
  notebook: {
    version: 1,
    steps: [
      {
        title: 'Build your notebook library',
        body: 'Use groups to organize documents by class, subject, project, or anything else that fits your workflow. New documents are created in the location you are currently browsing.',
      },
      {
        title: 'Choose a document type',
        body: 'Creating a document opens the Notebook builder. Markdown Paper is available now, while Lined Paper and Graph Paper are already represented as future document types.',
      },
      {
        title: 'Write Markdown with a live preview',
        body: 'Markdown documents open with source and preview side by side. Switch between Split, Source, and Preview views, swap the panels, or resize them to fit the way you work.',
      },
      {
        title: 'Use the built-in writing tools',
        body: 'Open the Markdown cheatsheet when you need syntax help, use Contents to navigate headings in the preview, and download a document as a Markdown file whenever you want a copy outside Dynamic Learner.',
      },
      {
        title: 'Make the workspace comfortable',
        body: 'Resize the Notebook library for more writing room and double-click supported dividers to reset them. Your document contents and organization stay saved in the Dynamic Learner workspace.',
      },
    ],
  },
  'index-cards': {
    version: 1,
    steps: [
      {
        title: 'Build your library',
        body: 'Use groups to organize subjects and sets to hold the cards you actually study. New items are created under the location you are currently browsing.',
      },
      {
        title: 'Write on both sides',
        body: 'Open a set to create cards, then switch between the front and back while editing. Your card list makes it easy to move through the set.',
      },
      {
        title: 'Review when you are ready',
        body: 'Review tools let you study the same set without changing the cards themselves. Pick the presentation that fits what you are practicing.',
      },
      {
        title: 'Make the workspace comfortable',
        body: 'The library, card list, and display settings are adjustable. Resize panels for more room, and double-click supported dividers to reset them.',
      },
    ],
  },
  'word-search': {
    version: 1,
    steps: [
      {
        title: 'Organize your puzzles',
        body: 'The library holds both groups and word searches. Use groups for subjects, units, or any structure that helps you find a puzzle again.',
      },
      {
        title: 'Build a word search',
        body: 'Create a new word search from the library, enter the words and clues you want, and let Dynamic Learner build the puzzle for you.',
      },
      {
        title: 'Play without losing your place',
        body: 'Open a saved puzzle to keep solving it. Found words and other saved puzzle state stay with that word search so you can come back later.',
      },
      {
        title: 'Tune the presentation',
        body: 'Display settings let you change how the puzzle is presented without changing its contents. The library can also be resized or collapsed when you need more room.',
      },
    ],
  },
};
