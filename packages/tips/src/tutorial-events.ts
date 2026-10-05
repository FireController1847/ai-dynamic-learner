import type { TutorialRequest } from './types.ts';

export const TIPS_ACTION_EVENT = 'tips:action' as const;

export type TutorialActionHandler = (event: CustomEvent<TutorialRequest>) => void;

export function addTutorialActionListener(handler: TutorialActionHandler) {
  window.addEventListener(TIPS_ACTION_EVENT, handler as EventListener);
  return () => window.removeEventListener(TIPS_ACTION_EVENT, handler as EventListener);
}

export function dispatchTutorialAction(eventName: string, request: TutorialRequest) {
  window.dispatchEvent(new CustomEvent<TutorialRequest>(eventName, { detail: request }));
}
