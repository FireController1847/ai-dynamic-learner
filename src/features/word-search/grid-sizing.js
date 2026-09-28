const { nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } = window.Vue;

// Measure available width and viewport height, without observing the grid's own size.
export function useGridSizing(area, size, options) {
  const cellSize = ref(options.value.cellSize);
  let observer;
  let frame;
  function measure() {
    if (!area.value?.isConnected || area.value.clientWidth === 0) return;
    const settings = options.value;
    const minimum = Math.max(28, Math.ceil(16 * settings.textSize / 100 / 0.62));
    const viewport = window.visualViewport;
    const top = Math.max(0, area.value.getBoundingClientRect().top - (viewport?.offsetTop ?? 0));
    const width = area.value.clientWidth - 10;
    const height = (viewport?.height ?? window.innerHeight) - top - 120;
    const available = Math.floor(Math.min(width, height) / size.value);
    cellSize.value = Math.max(minimum, settings.fit === 'screen'
      ? Math.min(settings.cellSize, available) : settings.cellSize);
  }
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  }
  onMounted(() => {
    observer = new ResizeObserver(schedule);
    observer.observe(area.value);
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
