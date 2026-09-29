// TIPS content is intentionally separate from feature components so tutorials can evolve
// without coupling application behavior to onboarding copy.
export const tipsCatalog = {
  notebook: {
    version: 1,
    steps: [
      {
        title: 'Keep your notes organized',
        body: 'Use the library to group related notebook documents together. Select an item whenever you want to open it in the workspace.',
      },
      {
        title: 'Create what you need',
        body: 'New documents are created inside the location you are currently browsing, so you can build a hierarchy that matches the way you think.',
      },
      {
        title: 'Your workspace stays yours',
        body: 'Dynamic Learner keeps your notebook data in your workspace. You can use the workspace tools in the navigation drawer to back it up or restore it.',
      },
      {
        title: 'Adjust the layout',
        body: 'Resize workspace panels when you want more room to read or write. Double-click supported dividers to return them to their default size.',
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
