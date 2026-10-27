import { defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';

/** A temporary, canvas-rendered mosaic for a new draw. No cells enter saved state. */
const CELL = 10;
const LEAD_MS = 130;
const WAVE_MS = 860;
const POP_MS = 240;
const HOLD_MS = 1350;
const DRAW_MS = LEAD_MS + WAVE_MS + POP_MS;

export const GridConstruction = defineComponent({
  name: 'GridConstruction',
  emits: { finished: () => true },
  setup(_, { emit }) {
    const surface = ref<HTMLCanvasElement | null>(null);
    let frame = 0;
    let holdTimer: number | undefined;
    let stopped = false;

    onMounted(() => {
      const canvas = surface.value;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) { emit('finished'); return; }
      const color = getComputedStyle(canvas).color;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      let started = 0;
      function render(now: number) {
        if (stopped || !canvas || !context) return;
        if (!started) started = now;
        const elapsed = now - started;
        // The fully drawn grid is a static canvas during its hold; avoid
        // repainting thousands of cells while nothing is changing.

        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (width && height) {
          const bitmapWidth = Math.ceil(width * ratio);
          const bitmapHeight = Math.ceil(height * ratio);
          if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
            canvas.width = bitmapWidth;
            canvas.height = bitmapHeight;
          }
          context.setTransform(ratio, 0, 0, ratio, 0, 0);
          context.clearRect(0, 0, width, height);
          context.fillStyle = color;
          const columns = Math.ceil(width / CELL);
          const rows = Math.ceil(height / CELL);
          const diagonalMax = Math.max(1, columns + rows - 2);

          // Diagonal, staggered starts: every 8px square pops in place, briefly
          // overshoots, and settles. Only the temporary canvas is repainted.
          for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
              const delay = LEAD_MS + ((row + column) / diagonalMax) * WAVE_MS;
              const progress = Math.max(0, Math.min(1, (elapsed - delay) / POP_MS));
              if (!progress) continue;
              const scale = progress < 0.6
                ? 1.17 * (1 - Math.pow(1 - progress / 0.6, 3))
                : 1 + 0.17 * Math.pow(1 - (progress - 0.6) / 0.4, 2);
              const size = 8 * scale;
              const x = column * CELL + CELL / 2 - size / 2;
              const y = row * CELL + CELL / 2 - size / 2;
              context.globalAlpha = 0.32;
              context.fillRect(x, y, size, size);
            }
          }
          context.globalAlpha = 1;
        }
        if (elapsed >= DRAW_MS) {
          holdTimer = window.setTimeout(() => { if (!stopped) emit('finished'); }, HOLD_MS);
        } else {
          frame = window.requestAnimationFrame(render);
        }
      }
      frame = window.requestAnimationFrame(render);
    });
    onBeforeUnmount(() => {
      stopped = true;
      if (frame) window.cancelAnimationFrame(frame);
      if (holdTimer !== undefined) window.clearTimeout(holdTimer);
    });
    return () => h('canvas', {
      ref: surface, class: 'sig-construction-grid', 'aria-hidden': 'true',
    });
  },
});
