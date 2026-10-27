import { defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';

/** A temporary, canvas-rendered mosaic for a new draw. No cells enter saved state. */
// Four times the former 8px cell / 10px pitch, with transparent interiors.
const CELL_PITCH = 40;
const LEAD_MS = 130;
const WAVE_MS = 860;
const POP_MS = 240;
const HOLD_MS = 1350;
const DRAW_MS = LEAD_MS + WAVE_MS + POP_MS;

export const GridConstruction = defineComponent({
  name: 'GridConstruction',
  emits: { finished: () => true },
  setup(_, { emit }) {
    const stage = ref<HTMLElement | null>(null);
    const surface = ref<HTMLCanvasElement | null>(null);
    let frame = 0;
    let holdTimer: number | undefined;
    let observer: ResizeObserver | undefined;
    let stopped = false;

    onMounted(() => {
      const canvas = surface.value;
      const host = stage.value;
      const context = canvas?.getContext('2d');
      if (!canvas || !host || !context) { emit('finished'); return; }
      // Preserve the null-checked elements as non-null local constants so the
      // nested animation callbacks keep the same guarantee under strict TS.
      const drawingCanvas: HTMLCanvasElement = canvas;
      const drawingHost: HTMLElement = host;
      const drawingContext: CanvasRenderingContext2D = context;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      let started = 0;

      // Fit a *square* to whichever dimension has more room: in wide layouts
      // it uses up to 2/3 of the width; in tall/mobile layouts, 2/3 of the height.
      // The other dimension can be used in full when necessary.
      function resize() {
        const width = drawingHost.clientWidth;
        const height = drawingHost.clientHeight;
        const size = Math.max(0, Math.floor(width >= height
          ? Math.min(width * (2 / 3), height)
          : Math.min(width, height * (2 / 3))));
        drawingCanvas.style.width = `${size}px`;
        drawingCanvas.style.height = `${size}px`;
        const bitmap = Math.ceil(size * ratio);
        if (drawingCanvas.width !== bitmap || drawingCanvas.height !== bitmap) {
          drawingCanvas.width = bitmap;
          drawingCanvas.height = bitmap;
        }
        return size;
      }

      function draw(elapsed: number) {
        const size = resize();
        if (!size) return;
        const cells = Math.max(1, Math.round(size / CELL_PITCH));
        const pitch = size / cells;
        const baseSize = pitch * 0.8;
        const line = Math.max(1, Math.min(2, pitch * 0.05));
        const diagonalMax = Math.max(1, 2 * cells - 2);

        drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
        drawingContext.clearRect(0, 0, size, size);
        drawingContext.strokeStyle = '#000';
        drawingContext.lineWidth = line;

        // Each transparent square scales past its final size, then settles;
        // all cells share the same pitch and use a diagonal stagger.
        for (let row = 0; row < cells; row++) {
          for (let column = 0; column < cells; column++) {
            const delay = LEAD_MS + ((row + column) / diagonalMax) * WAVE_MS;
            const progress = Math.max(0, Math.min(1, (elapsed - delay) / POP_MS));
            if (!progress) continue;
            const scale = progress < 0.6
              ? 1.17 * (1 - Math.pow(1 - progress / 0.6, 3))
              : 1 + 0.17 * Math.pow(1 - (progress - 0.6) / 0.4, 2);
            const cellSize = baseSize * scale;
            const x = (column + 0.5) * pitch - cellSize / 2;
            const y = (row + 0.5) * pitch - cellSize / 2;
            drawingContext.strokeRect(x + line / 2, y + line / 2,
              Math.max(0, cellSize - line), Math.max(0, cellSize - line));
          }
        }
      }

      function render(now: number) {
        if (stopped) return;
        if (!started) started = now;
        const elapsed = now - started;
        draw(Math.min(elapsed, DRAW_MS));
        // Hold the completed canvas without redrawing every frame.
        if (elapsed >= DRAW_MS) {
          holdTimer = window.setTimeout(() => { if (!stopped) emit('finished'); }, HOLD_MS);
        } else {
          frame = window.requestAnimationFrame(render);
        }
      }
      observer = new ResizeObserver(() => {
        if (!stopped && started) draw(Math.min(performance.now() - started, DRAW_MS));
      });
      observer.observe(drawingHost);
      frame = window.requestAnimationFrame(render);
    });
    onBeforeUnmount(() => {
      stopped = true;
      if (frame) window.cancelAnimationFrame(frame);
      if (holdTimer !== undefined) window.clearTimeout(holdTimer);
      observer?.disconnect();
    });
    return () => h('div', { ref: stage, class: 'sig-construction-stage', 'aria-hidden': 'true' }, [
      h('canvas', { ref: surface, class: 'sig-construction-grid' }),
    ]);
  },
});
