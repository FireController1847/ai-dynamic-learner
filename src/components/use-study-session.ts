import { onActivated, onBeforeUnmount, onDeactivated, watch, type Ref } from 'vue';
import { reportStudySession } from '../core/study-activity.ts';

// The active status must clear when KeepAlive deactivates a feature.
export function useStudySession(active: Readonly<Ref<boolean>>): void {
  const token = Symbol('study-session');
  let visible = true;
  watch(active, value => reportStudySession(token, visible && value), { immediate: true });
  onActivated(() => {
    visible = true;
    reportStudySession(token, active.value);
  });
  onDeactivated(() => {
    visible = false;
    reportStudySession(token, false);
  });
  onBeforeUnmount(() => reportStudySession(token, false));
}
