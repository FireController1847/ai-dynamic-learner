import type { Ref } from 'vue';
import type { DisplayOptions } from './display-options.ts';
import { MIN_CELL_SIZE, MAX_CELL_SIZE } from './display-options.ts';

import { nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const WORD_BANK_WITH_GAP = 244;
const HINT_BANK_WITH_GAP = 484;
const PLAY_LAYOUT_BREAKPOINT = 650;
const HINT_LAYOUT_BREAKPOINT = 1080;
const VERTICAL_ALLOWANCE = 240;

// Content such as found-word labels and status text must never resize the board.
// Only the stable play width, viewport geometry, puzzle size, or display settings
// schedule a new measurement.
export function useGridSizing(area: Ref<HTMLElement | null>, size: Readonly<Ref<number>>, options: Readonly<Ref<DisplayOptions>>) {
  const cellSize = ref(Math.max(MIN_CELL_SIZE, options.value.cellSize));
  let observer: ResizeObserver | undefined;
  let frame = 0;
  let container: HTMLElement | null = null;
  let workspace: Element | null = null;
  let lastWidth = -1;
  let lastViewportHeight = -1;

  function measure() {
    if (!area.value?.isConnected || !container?.isConnected) return;
    const settings = options.value;
    const minimum = Math.max(MIN_CELL_SIZE, Math.ceil(16 * settings.textSize / 100 / 0.62));
    const styles = getComputedStyle(container);
    const containerWidth = container.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    const hintMode = Boolean(container.querySelector('.word-search-word-bank.uses-hints'));
    const beside = containerWidth >= (hintMode ? HINT_LAYOUT_BREAKPOINT : PLAY_LAYOUT_BREAKPOINT);
    const bankWidth = hintMode ? HINT_BANK_WITH_GAP : WORD_BANK_WITH_GAP;
    const width = containerWidth - (beside ? bankWidth : 0) - 10;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const workspaceHeight = workspace?.getBoundingClientRect().height ?? viewportHeight;
    const height = Math.min(workspaceHeight, viewportHeight) - VERTICAL_ALLOWANCE;
    const available = Math.floor(Math.min(width, height) / size.value);
    cellSize.value = Math.max(minimum, settings.fit === 'screen'
      ? Math.min(MAX_CELL_SIZE, available) : settings.cellSize);
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  }

  function widthChanged() {
    const width = Math.round(container?.getBoundingClientRect().width ?? 0);
    if (!width || width === lastWidth) return;
    lastWidth = width;
    schedule();
  }

  function viewportChanged() {
    const height = Math.round(window.visualViewport?.height ?? window.innerHeight);
    if (height === lastViewportHeight) return;
    lastViewportHeight = height;
    schedule();
  }

  onMounted(() => {
    if (!area.value?.parentElement) return;
    container = area.value.parentElement;
    workspace = area.value.closest('.word-search-detail');
    observer = new ResizeObserver(widthChanged);
    observer.observe(container);
    window.addEventListener('resize', viewportChanged);
    window.visualViewport?.addEventListener('resize', viewportChanged);
    lastWidth = Math.round(container.getBoundingClientRect().width);
    lastViewportHeight = Math.round(window.visualViewport?.height ?? window.innerHeight);
    schedule();
  });
  onActivated(schedule);
  watch([size, options], () => nextTick(schedule), { deep: true });
  onBeforeUnmount(() => {
    observer?.disconnect();
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', viewportChanged);
    window.visualViewport?.removeEventListener('resize', viewportChanged);
  });
  return cellSize;
}
