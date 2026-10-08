import { nextTick, onActivated, onMounted, ref, watch } from 'vue';

interface LibrarySelectionOptions {
  firstId(): string | null;
  hasItem(id: string): boolean;
  enabled?(): boolean;
  onAutoSelect?(id: string): void;
}

export function useLibrarySelection(options: LibrarySelectionOptions) {
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
