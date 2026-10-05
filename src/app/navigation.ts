import { onUnmounted, ref } from 'vue';
import { requestLeave } from '../core/leave-guards.ts';
import { isRecord } from '../core/validation.ts';

// The generated HTML supplies the site root, including a Pages repository prefix.
const basePath = new URL(document.baseURI).pathname;
export function pageHref(path: string): string {
  return `${basePath}${path.slice(1)}`;
}

function localPath() {
  const pathname = window.location.pathname;
  return pathname.startsWith(basePath) ? `/${pathname.slice(basePath.length)}` : pathname;
}

export function useNavigation(onNavigate: () => void) {
  const currentPath = ref(localPath());
  let position = 0;
  let currentHref = window.location.href;
  let reverting = false;
  function writePosition(replace: boolean, href: string) {
    const state: unknown = window.history.state;
    const next = { ...(isRecord(state) ? state : {}), dynamicLearnerPosition: position };
    if (replace) window.history.replaceState(next, '', href);
    else window.history.pushState(next, '', href);
  }
  const initialState: unknown = window.history.state;
  if (isRecord(initialState) && typeof initialState.dynamicLearnerPosition === 'number') position = initialState.dynamicLearnerPosition;
  writePosition(true, currentHref);

  function handlePopState(event: PopStateEvent) {
    if (reverting) { reverting = false; return; }
    const state: unknown = event.state;
    const nextPosition = isRecord(state) && typeof state.dynamicLearnerPosition === 'number' ? state.dynamicLearnerPosition : null;
    if (!requestLeave()) {
      if (nextPosition !== null && nextPosition !== position) {
        reverting = true;
        window.history.go(position - nextPosition);
      } else writePosition(false, currentHref);
      return;
    }
    position = nextPosition ?? position;
    currentHref = window.location.href;
    syncLocation();
  }

  function syncLocation() {
    currentPath.value = localPath();
    onNavigate();
  }

  function navigate(event: MouseEvent, path: string) {
    // Preserve native open-in-new-tab/window and modified-click behavior.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    const href = pageHref(path);
    if (currentPath.value !== path && !requestLeave()) return;
    if (window.location.pathname !== href || window.location.search || window.location.hash) {
      position += 1;
      writePosition(false, href);
    }
    currentHref = window.location.href;
    syncLocation();
  }

  window.addEventListener('popstate', handlePopState);
  onUnmounted(() => window.removeEventListener('popstate', handlePopState));

  return { currentPath, navigate };
}
