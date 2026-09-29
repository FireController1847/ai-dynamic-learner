import { clearPreference, readNumberPreference, writeNumberPreference } from '../core/ui-preferences.ts';

import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

export interface PersistedPanelResizeOptions {
  preferenceKey: string;
  container: Ref<HTMLElement | null>;
  panelSelector: string;
  minWidth: number;
  maxWidth: number;
  minRemainingWidth: number;
  fallbackWidth: number;
  disabled?: () => boolean;
}

export function usePersistedPanelResize(options: PersistedPanelResizeOptions) {
  const width = ref(readNumberPreference(options.preferenceKey));
  const resizing = ref(false);

  function maxWidth() {
    const available = options.container.value?.clientWidth ??
      (options.maxWidth + options.minRemainingWidth);
    return Math.max(options.minWidth,
      Math.min(options.maxWidth, available - options.minRemainingWidth));
  }

  function currentWidth() {
    return width.value ??
      options.container.value?.querySelector<HTMLElement>(options.panelSelector)
        ?.getBoundingClientRect().width ??
      options.fallbackWidth;
  }

  function setWidth(value: number) {
    width.value = Math.round(Math.min(Math.max(value, options.minWidth), maxWidth()));
    writeNumberPreference(options.preferenceKey, width.value);
  }

  function resetWidth() {
    clearPreference(options.preferenceKey);
    width.value = null;
  }

  function keepInBounds() {
    if (width.value !== null) setWidth(width.value);
  }

  function resizeFromPointer(event: PointerEvent) {
    if (!resizing.value || !options.container.value) return;
    const bounds = options.container.value.getBoundingClientRect();
    setWidth(event.clientX - bounds.left);
  }

  function beginResize(event: PointerEvent) {
    if (event.button !== 0 || options.disabled?.()) return;
    event.preventDefault();
    resizing.value = true;
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    resizeFromPointer(event);
  }

  function endResize(event: PointerEvent) {
    resizing.value = false;
    if (event.currentTarget instanceof HTMLElement &&
        event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resizeFromKeyboard(event: KeyboardEvent) {
    const step = event.shiftKey ? 48 : 16;
    let value = currentWidth();
    if (event.key === 'ArrowLeft') value -= step;
    else if (event.key === 'ArrowRight') value += step;
    else if (event.key === 'Home') value = options.minWidth;
    else if (event.key === 'End') value = maxWidth();
    else return;
    event.preventDefault();
    setWidth(value);
  }

  onMounted(() => {
    keepInBounds();
    window.addEventListener('resize', keepInBounds);
  });
  onBeforeUnmount(() => window.removeEventListener('resize', keepInBounds));

  return {
    width,
    resizing,
    maxWidth,
    currentWidth,
    resetWidth,
    beginResize,
    resizeFromPointer,
    endResize,
    resizeFromKeyboard,
  };
}
