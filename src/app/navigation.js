const { onUnmounted, ref } = window.Vue;

export function useNavigation(onNavigate) {
  const currentPath = ref(window.location.pathname);

  function syncLocation() {
    currentPath.value = window.location.pathname;
    onNavigate();
  }

  function navigate(event, path) {
    // Preserve native open-in-new-tab/window and modified-click behavior.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    if (window.location.pathname !== path || window.location.search || window.location.hash) {
      window.history.pushState(null, '', path);
    }
    syncLocation();
  }

  window.addEventListener('popstate', syncLocation);
  onUnmounted(() => window.removeEventListener('popstate', syncLocation));

  return { currentPath, navigate };
}
