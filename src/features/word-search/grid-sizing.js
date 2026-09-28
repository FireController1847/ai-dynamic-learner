import { MIN_CELL_SIZE, MAX_CELL_SIZE } from './display-options.js';

const { nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } = window.Vue;

// Only external geometry drives sizing, never content height or scroll position.
export function useGridSizing(area, size, options) {
  const cellSize = ref(Math.max(MIN_CELL_SIZE, options.value.cellSize));
  let observer;
  let frame;
  let container;
  let workspace;
  let geometry = '';
  function measure() {
    if (!area.value?.isConnected || area.value.clientWidth === 0) return;
    const settings = options.value;
    const minimum = Math.max(MIN_CELL_SIZE, Math.ceil(16 * settings.textSize / 100 / 0.62));
    const viewport = window.visualViewport;
    const styles = getComputedStyle(container);
    const containerWidth = container.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    const beside = container.classList.contains('word-search-play-layout') && containerWidth >= 650;
    const width = containerWidth - (beside ? 244 : 0) - 10;
    // Reserve space for the heading, instructions and controls. Reading the
    // scrollport height avoids feedback from messages, found words or focus scrolling.
    const height = Math.min(workspace?.clientHeight ?? window.innerHeight,
      viewport?.height ?? window.innerHeight) - 240;
    const available = Math.floor(Math.min(width, height) / size.value);
    cellSize.value = Math.max(minimum, settings.fit === 'screen'
      ? Math.min(MAX_CELL_SIZE, available) : settings.cellSize);
  }
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  }
  function geometryChanged() {
    const next = `${container.clientWidth}:${workspace?.clientHeight ?? 0}`;
    if (next === geometry) return;
    geometry = next;
    schedule();
  }
  onMounted(() => {
    container = area.value.parentElement;
    workspace = area.value.closest('.word-search-detail');
    observer = new ResizeObserver(geometryChanged);
    observer.observe(container);
    if (workspace) observer.observe(workspace);
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
