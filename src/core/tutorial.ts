/** Typed request/cleanup boundary between the tips coordinator and feature demos. */
export type TutorialCleanup = () => void | Promise<void>;
export interface TutorialRequest {
  featureId: string;
  action: string;
  handled: boolean;
  resolve: (cleanup: TutorialCleanup) => void;
  reject: (reason: unknown) => void;
}
export const TIPS_ACTION_EVENT = 'dynamic-learner:tips-action';

declare global {
  interface WindowEventMap {
    'dynamic-learner:tips-action': CustomEvent<TutorialRequest>;
  }
}
