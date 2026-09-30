import type { Ref } from 'vue';
import type { DisplayOptions } from './display-options.ts';
import { MIN_CELL_SIZE, MAX_CELL_SIZE } from './display-options.ts';

import { nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const CLUE_PANEL_WITH_GAP = 388;
const SIDE_BY_SIDE_BREAKPOINT = 860;
const VERTICAL_ALLOWANCE = 230;

export function useGridSizing(
  area: Ref<HTMLElement | null>,
  size: Readonly<Ref<number>>,
  options: Readonly<Ref<DisplayOptions>>,
) {
  const cellSize = ref(Math.max(MIN_CELL_SIZE, options.value.cellSize));
  let observer: ResizeObserver | undefined;
  let frame = 0;
  let container: HTMLElement | null = null;
  let workspace: Element | null = null;

  function measure() {
    if (!area.value?.isConnected || !container?.isConnected) return;
    const settings = options.value;
    const styles = getComputedStyle(container);
    const containerWidth = container.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    const beside = containerWidth >= SIDE_BY_SIDE_BREAKPOINT;
    const width = containerWidth - (beside ? CLUE_PANEL_WITH_GAP : 0) - 12;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const workspaceHeight = workspace?.getBoundingClientRect().height ?? viewportHeight;
    const height = Math.min(workspaceHeight, viewportHeight) - VERTICAL_ALLOWANCE;
    const available = Math.floor(Math.min(width, height) / size.value);
    cellSize.value = Math.max(MIN_CELL_SIZE, settings.fit === 'screen'
      ? Math.min(MAX_CELL_SIZE, available)
      : settings.cellSize);
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  }

  onMounted(() => {
    if (!area.value?.parentElement) return;
    container = area.value.parentElement;
    workspace = area.value.closest('.crossword-detail');
    observer = new ResizeObserver(schedule);
    observer.observe(container);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    schedule();
  });
  onActivated(schedule);
  watch([size, options], () => nextTick(schedule), { deep: true });
  onBeforeUnmount(() => {
    observer?.disconnect();
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('resize', schedule);
  });

  return cellSize;
}
