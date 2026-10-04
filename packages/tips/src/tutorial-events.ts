import type { TutorialRequest } from './types.ts';

export const TIPS_ACTION_EVENT = 'tips:action';

export function dispatchTutorialAction(eventName: string, request: TutorialRequest) {
  window.dispatchEvent(new CustomEvent<TutorialRequest>(eventName, { detail: request }));
}
