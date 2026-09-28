const socialImage = Object.freeze({
  path: 'src/assets/dynamic-learner-social.jpg',
  type: 'image/jpeg',
  width: 1200,
  height: 630,
  alt: 'Dynamic Learner — a flexible learning workspace for organizing, studying, and reviewing knowledge.',
});

export const appConfig = Object.freeze({
  name: 'Dynamic Learner',
  description: 'A browser-native collection of focused learning tools for studying, organizing material, and reviewing at your own pace.',
  repositoryUrl: 'https://github.com/FireController1847/ai-dynamic-learner',
  license: 'Apache-2.0',
  metadata: Object.freeze({
    language: 'en',
    locale: 'en_US',
    applicationCategory: 'EducationalApplication',
    themeColor: '#0f6cbd',
    backgroundColor: '#ffffff',
    twitterCard: 'summary_large_image',
    keywords: Object.freeze([
      'learning tools',
      'study tools',
      'learning workspace',
      'browser-based learning',
      'index cards',
      'flashcards',
      'notebook',
      'notes',
      'word search',
      'knowledge review',
    ]),
    socialImage,
  }),
});
