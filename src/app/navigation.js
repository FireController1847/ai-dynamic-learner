import { onUnmounted, ref } from 'vue';

// The generated HTML supplies the site root, including a Pages repository prefix.
const basePath = new URL(document.baseURI).pathname;
export function pageHref(path) {
  return `${basePath}${path.slice(1)}`;
}

function localPath() {
  const pathname = window.location.pathname;
  return pathname.startsWith(basePath) ? `/${pathname.slice(basePath.length)}` : pathname;
}

export function useNavigation(onNavigate) {
  const currentPath = ref(localPath());

  function syncLocation() {
    currentPath.value = localPath();
    onNavigate();
  }

  function navigate(event, path) {
    // Preserve native open-in-new-tab/window and modified-click behavior.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    const href = pageHref(path);
    if (window.location.pathname !== href || window.location.search || window.location.hash) {
      window.history.pushState(null, '', href);
    }
    syncLocation();
  }

  window.addEventListener('popstate', syncLocation);
  onUnmounted(() => window.removeEventListener('popstate', syncLocation));

  return { currentPath, navigate };
}
