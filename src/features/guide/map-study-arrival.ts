/**
 * A continued map journey settles on its destination before the lesson opens.
 * Map-intro and manual map navigation retain their own behaviors.
 */
export const CONTINUE_ARRIVAL_PAUSE_MS = 340;
export const REDUCED_MOTION_ARRIVAL_PAUSE_MS = 100;

export function mayOpenContinuedStop(state: {
  started: boolean; travelling: boolean; arriving: boolean;
  currentId: string | null; targetId: string; focused: boolean;
}): boolean {
  return state.started && !state.travelling && !state.arriving &&
    state.currentId === state.targetId && !state.focused;
}
