export { TipsExperience, type TipsHandle } from './tips.ts';
export { TIPS_ACTION_EVENT, dispatchTutorialAction } from './tutorial-events.ts';
export { readTipsPreferences, writeTipsPreferences } from './preferences.ts';
export { visibleTarget, useTipsPosition } from './position.ts';
export { useTips } from './use-tips.ts';
export type {
  Placement,
  StepAction,
  TargetSelector,
  TipSection,
  TipStep,
  TipsCatalog,
  TipsFeature,
  TipsFeatureId,
  TipsPreferences,
  TipsProps,
  Tutorial,
  TutorialCleanup,
  TutorialRequest,
} from './types.ts';
