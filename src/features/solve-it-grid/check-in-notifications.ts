import type { TaskSet } from './library-model.ts';
import { slotState } from './task-model.ts';

/** Permission requests are initiated only by a user click on the opt-in dialog. */
export function canAskForCheckInNotifications(): boolean {
  return window.isSecureContext && 'Notification' in window && Notification.permission === 'default';
}

export async function requestCheckInNotifications(): Promise<NotificationPermission> {
  if (!('Notification' in window) || !window.isSecureContext) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

const failedReminders = new Set<string>();

/**
 * A tab-open reminder delivery check. Called from the persistent app shell,
 * even if the user navigates away from Solve-It Grid within Dynamic Learner.
 * The saved deadline is stamped only after a successful browser handoff.
 */
export function deliverDueCheckInNotifications(items: TaskSet[], now = Date.now()): void {
  if (!window.isSecureContext || !('Notification' in window) || Notification.permission !== 'granted') return;
  for (const item of items) {
    const focus = item.checkIn;
    if (!focus || !item.lists || !item.round || focus.remindAt > now ||
        focus.notifiedAt === focus.remindAt ||
        item.round.number !== focus.roundNumber ||
        item.round.slots[focus.category].taskId !== focus.taskId ||
        slotState(item.lists, item.round, focus.category) !== 'ready') continue;

    const identifier = `${item.id}:${focus.taskId}:${focus.remindAt}`;
    if (failedReminders.has(identifier)) continue;
    try {
      const notification = new Notification('Solve-It Grid — gentle check-in', {
        body: 'How are you feeling about what you are doing? Check in whenever you are ready.',
        tag: `solve-it-grid-${item.id}-${focus.taskId}`,
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      focus.notifiedAt = focus.remindAt;
    } catch {
      // Some browsers require installed-app notifications. The in-app
      // reminder remains available; avoid retrying a failing constructor.
      failedReminders.add(identifier);
    }
  }
}
