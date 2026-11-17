import { computed, nextTick, onActivated, onMounted, ref, watch } from 'vue';
import { isValidId } from '../core/ids.ts';
import { clearPreference } from '../core/ui-preferences.ts';

interface LibrarySelectionOptions<T extends { id: string; name: string }> {
  app: string;
  lookup(id: string): T | null;
  enabled?(): boolean;
  initialRecent?(): string | null;
  onHome?(): void;
}

/** Home has no selection. Recent items are local UI preferences, not workspace data. */
export function useLibrarySelection<T extends { id: string; name: string }>(options: LibrarySelectionOptions<T>) {
  const key = `dynamic-learner.ui.${options.app}.recent-item`;
  const selectedId = ref<string | null>(null);
  function initialRecent() {
    try {
      const id = localStorage.getItem(key);
      if (isValidId(id) && options.lookup(id)) return id;
    } catch { /* UI preferences are best-effort only. */ }
    const fallback = options.initialRecent?.();
    return isValidId(fallback) && options.lookup(fallback) ? fallback : null;
  }
  const recentId = ref<string | null>(initialRecent());
  const recentItem = computed(() => recentId.value ? options.lookup(recentId.value) : null);
  function remember(id: string | null) {
    if (!id || !options.lookup(id)) return;
    recentId.value = id;
    try { localStorage.setItem(key, id); }
    catch { /* UI preferences are best-effort only. */ }
  }
  watch(() => selectedId.value !== null && !options.lookup(selectedId.value), missing => {
    if (missing) selectedId.value = null;
  });
  watch(recentItem, item => {
    if (item || !recentId.value) return;
    recentId.value = null;
    clearPreference(key);
  });
  onActivated(() => {
    if (options.enabled?.() === false) return;
    selectedId.value = null;
    options.onHome?.();
  });
  return { selectedId, recentItem, remember };
}

interface AutomaticLibrarySelectionOptions {
  firstId(): string | null;
  hasItem(id: string): boolean;
  enabled?(): boolean;
  onAutoSelect?(id: string): void;
}

export function useAutomaticLibrarySelection(options: AutomaticLibrarySelectionOptions) {
  const selectedId = ref<string | null>(options.firstId());

  function revealSelection() {
    const id = selectedId.value;
    if (id) nextTick(() => {
      if (selectedId.value === id) options.onAutoSelect?.(id);
    });
  }

  function selectFirst() {
    if (options.enabled?.() === false) return;
    selectedId.value = options.firstId();
    revealSelection();
  }

  watch(() => ({
    firstId: options.firstId(),
    hasSelection: selectedId.value !== null && options.hasItem(selectedId.value),
    enabled: options.enabled?.() ?? true,
  }), ({ firstId, hasSelection, enabled }) => {
    if (enabled && !hasSelection && selectedId.value !== firstId) selectFirst();
  });

  onMounted(revealSelection);
  onActivated(selectFirst);
  return selectedId;
}
