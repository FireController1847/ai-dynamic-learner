import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import type { GuideMapPattern } from './library-model.ts';
import { MAP_CANVAS_HEIGHT, MAP_CANVAS_WIDTH } from './map-presentation.ts';

export const GUIDE_MAP_PATTERNS: readonly { value: GuideMapPattern; label: string }[] = [
  { value: 'water', label: 'Water · small wave crests' },
  { value: 'contours', label: 'Contours · delicate topographic lines' },
  { value: 'constellations', label: 'Constellations · scattered stars' },
  { value: 'flow', label: 'Flow · quiet curved dashes' },
  { value: 'plain', label: 'Plain · no pattern' },
];

export interface GuideMapBackdropHandle { rippleAt(x: number, y: number): void }
interface Ripple { x: number; y: number; start: number }
const W = MAP_CANVAS_WIDTH, H = MAP_CANVAS_HEIGHT;
const RIPPLE_LIFETIME = 1750;
const hash = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

/** Small repeated motifs: no permanent circles centered on authored stops. */
function drawTexture(ctx: CanvasRenderingContext2D, pattern: GuideMapPattern,
  ripples: readonly Ripple[], now: number) {
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pattern === 'water') {
    ctx.globalAlpha = 0.105;
    ctx.beginPath();
    for (let row = 0; row < H / 48 + 1; row++) {
      for (let col = 0; col < W / 72 + 1; col++) {
        const x = 20 + col * 72 + (row % 2) * 35;
        const y = 21 + row * 48;
        // A ripple briefly displaces the little water crests as it travels past.
        let displacement = 0;
        for (const ripple of ripples) {
          const age = (now - ripple.start) / RIPPLE_LIFETIME;
          const distance = Math.hypot(x - ripple.x, y - ripple.y);
          const wavefront = age * 270;
          const offset = (distance - wavefront) / 24;
          displacement += Math.cos(offset * 2.1) * Math.exp(-offset * offset) *
            (1 - age) * 7;
        }
        const yy = y + displacement;
        ctx.moveTo(x - 16, yy + 3);
        ctx.quadraticCurveTo(x - 7, yy - 7, x + 1, yy + 3);
        ctx.quadraticCurveTo(x + 10, yy - 5, x + 18, yy + 3);
      }
    }
    ctx.stroke();
  } else if (pattern === 'contours') {
    ctx.globalAlpha = 0.095;
    ctx.beginPath();
    for (let row = 0; row < H / 90 + 1; row++) for (let col = 0; col < W / 110 + 1; col++) {
      const x = col * 110 + 14 + (row % 2) * 28, y = row * 90 + 16;
      for (let j = 0; j < 3; j++) {
        const offset = j * 9;
        ctx.moveTo(x, y + offset + 20);
        ctx.bezierCurveTo(x + 12, y + offset - 6, x + 27, y + offset + 2, x + 40, y + offset + 15);
      }
    }
    ctx.stroke();
  } else if (pattern === 'constellations') {
    ctx.globalAlpha = 0.13;
    ctx.beginPath();
    for (let row = 0; row < H / 75 + 1; row++) for (let col = 0; col < W / 92 + 1; col++) {
      const n = row * 41 + col * 7;
      const x = col * 92 + 10 + hash(n + 7) * 28;
      const y = row * 75 + 9 + hash(n + 18) * 25;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 17 + hash(n + 2) * 11, y - 10 + hash(n + 9) * 18);
      ctx.moveTo(x + 1.2, y);
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
    }
    ctx.stroke();
  } else if (pattern === 'flow') {
    ctx.globalAlpha = 0.105;
    ctx.beginPath();
    for (let row = 0; row < H / 62 + 1; row++) for (let col = 0; col < W / 96 + 1; col++) {
      const x = 12 + col * 96 + (row % 2) * 42, y = 18 + row * 62;
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 12, y - 7, x + 22, y + 9, x + 36, y);
    }
    ctx.stroke();
  }
}

/** Real animated Canvas ripples, only rendered while an interaction is active. */
function drawRipples(ctx: CanvasRenderingContext2D, pattern: GuideMapPattern,
  ripples: readonly Ripple[], now: number) {
  if (pattern === 'plain') return;
  for (const ripple of ripples) {
    const age = clamp((now - ripple.start) / RIPPLE_LIFETIME, 0, 1);
    for (let ring = 0; ring < (pattern === 'water' ? 3 : 2); ring++) {
      const progress = (age - ring * 0.12) / (1 - ring * 0.12);
      if (progress <= 0 || progress >= 1) continue;
      ctx.beginPath();
      ctx.globalAlpha = (pattern === 'water' ? 0.34 : 0.20) *
        Math.sin(Math.PI * Math.min(1, progress)) * (1 - progress * 0.52);
      ctx.lineWidth = pattern === 'water' ? 1.8 : 1.4;
      ctx.arc(ripple.x, ripple.y, 8 + progress * (pattern === 'water' ? 260 : 160),
        0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export const GuideMapBackdrop = defineComponent({
  name: 'GuideMapBackdrop',
  props: { pattern: { type: String as PropType<GuideMapPattern>, required: true } },
  setup(props, { expose }) {
    const canvas = ref<HTMLCanvasElement | null>(null);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ripples: Ripple[] = [];
    let frame = 0, mounted = false;
    let observer: MutationObserver | null = null;
    function draw(now = performance.now()) {
      const element = canvas.value;
      const ctx = element?.getContext('2d');
      if (!element || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelW = Math.round(W * dpr), pixelH = Math.round(H * dpr);
      if (element.width !== pixelW || element.height !== pixelH) {
        element.width = pixelW; element.height = pixelH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = getComputedStyle(element).color;
      for (let i = ripples.length - 1; i >= 0; i--) {
        if (now - ripples[i].start >= RIPPLE_LIFETIME) ripples.splice(i, 1);
      }
      drawTexture(ctx, props.pattern, ripples, now);
      drawRipples(ctx, props.pattern, ripples, now);
      ctx.globalAlpha = 1;
    }
    function animate(now: number) {
      frame = 0;
      if (!mounted) return;
      if (motion.matches) ripples.splice(0);
      draw(now);
      if (ripples.length) frame = requestAnimationFrame(animate);
    }
    function invalidate() {
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      if (mounted) draw();
      if (mounted && ripples.length) frame = requestAnimationFrame(animate);
    }
    function rippleAt(x: number, y: number) {
      if (!mounted || props.pattern === 'plain' || motion.matches ||
          !Number.isFinite(x) || !Number.isFinite(y)) return;
      ripples.push({ x: clamp(x, 0, W), y: clamp(y, 0, H), start: performance.now() });
      if (ripples.length > 5) ripples.shift();
      if (!frame) frame = requestAnimationFrame(animate);
    }
    expose({ rippleAt } satisfies GuideMapBackdropHandle);
    function onMotionChange() { if (motion.matches) ripples.splice(0); invalidate(); }
    onMounted(() => {
      mounted = true;
      observer = new MutationObserver(invalidate);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      motion.addEventListener('change', onMotionChange);
      window.addEventListener('resize', invalidate);
      invalidate();
    });
    watch(() => props.pattern, () => { ripples.splice(0); invalidate(); });
    onBeforeUnmount(() => {
      mounted = false;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      motion.removeEventListener('change', onMotionChange);
      window.removeEventListener('resize', invalidate);
      ripples.splice(0);
    });
    return () => h('canvas', { ref: canvas, class: 'guide-map-backdrop',
      'aria-hidden': 'true', role: 'presentation' });
  },
});
