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
const CHECK_IN_NOTIFICATION_TITLE = 'Solve-It Grid — gentle check-in';
const CHECK_IN_NOTIFICATION_BODY = 'How are you feeling about what you are doing? Check in whenever you are ready.';

function showCheckInNotification(tag: string, preview = false): boolean {
  try {
    const notification = new Notification(CHECK_IN_NOTIFICATION_TITLE, {
      body: preview ? `Preview: ${CHECK_IN_NOTIFICATION_BODY}` : CHECK_IN_NOTIFICATION_BODY,
      tag,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    // Some browser contexts cannot construct notifications, even with
    // permission. In-app check-ins remain available.
    return false;
  }
}

export type CheckInPreviewNotificationResult = 'sent' | 'denied' | 'unsupported' | 'failed';

/** Triggered directly by the speaker's click, never by an automatic timer. */
export async function previewCheckInNotification(): Promise<CheckInPreviewNotificationResult> {
  if (!window.isSecureContext || !('Notification' in window)) return 'unsupported';
  const permission = Notification.permission === 'default'
    ? await requestCheckInNotifications() : Notification.permission;
  if (permission !== 'granted') return 'denied';
  // Distinct from real reminder tags and never updates persisted deadlines.
  return showCheckInNotification('solve-it-grid-preview', true) ? 'sent' : 'failed';
}

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
    if (showCheckInNotification(`solve-it-grid-${item.id}-${focus.taskId}`)) {
      focus.notifiedAt = focus.remindAt;
    } else {
      // Avoid repeatedly trying a failing notification constructor.
      failedReminders.add(identifier);
    }
  }
}
