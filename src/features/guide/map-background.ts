import { defineComponent, h, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch, type PropType } from 'vue';
import type { GuideMapPattern } from './library-model.ts';
import { MAP_CANVAS_HEIGHT, MAP_CANVAS_WIDTH } from './map-presentation.ts';

export const GUIDE_MAP_PATTERNS: readonly { value: GuideMapPattern; label: string }[] = [
  { value: 'water', label: 'Water · varied wave crests' },
  { value: 'contours', label: 'Contours · small terrain curves' },
  { value: 'constellations', label: 'Constellations · starlight' },
  { value: 'flow', label: 'Flow · drifting currents' },
  { value: 'plain', label: 'Plain · no pattern' },
];

export interface GuideMapBackdropHandle { interactAt(x: number, y: number): void }
interface Disturbance { x: number; y: number; start: number }

const W = MAP_CANVAS_WIDTH, H = MAP_CANVAS_HEIGHT;
const TAU = Math.PI * 2;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const hash = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
const lifetime = (pattern: GuideMapPattern) =>
  pattern === 'constellations' ? 1050 : pattern === 'water' ? 1750 : 1450;

/** A small actual star, not the connected straight segments of the old backdrop. */
function star(ctx: CanvasRenderingContext2D, x: number, y: number,
  radius: number, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = i * Math.PI / points - Math.PI / 2;
    const r = i % 2 ? radius * (points === 4 ? 0.21 : 0.43) : radius;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** Deterministic tiling with local variation; stays still when there is no effect. */
function drawTexture(ctx: CanvasRenderingContext2D, pattern: GuideMapPattern,
  effects: readonly Disturbance[], now: number) {
  if (pattern === 'plain') return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.05;
  ctx.fillStyle = ctx.strokeStyle;
  if (pattern === 'water') {
    for (let row = 0; row < H / 48 + 1; row++) {
      for (let col = 0; col < W / 76 + 1; col++) {
        const seed = row * 109 + col * 17;
        const x = 20 + col * 76 + (row % 2) * 35 + (hash(seed + 1) - 0.5) * 15;
        const y = 18 + row * 48 + (hash(seed + 2) - 0.5) * 10;
        const half = 11 + hash(seed + 3) * 5;
        const rise = 5 + hash(seed + 4) * 3;
        let displacement = 0;
        for (const effect of effects) {
          const age = (now - effect.start) / lifetime('water');
          const distance = Math.hypot(x - effect.x, y - effect.y);
          const relative = (distance - age * 265) / 37;
          displacement += Math.cos(relative * 2.2) * Math.exp(-relative * relative) *
            (1 - age) * 5;
        }
        const yy = y + displacement;
        ctx.globalAlpha = 0.047 + hash(seed + 5) * 0.035;
        ctx.beginPath();
        ctx.moveTo(x - half, yy + 2);
        ctx.quadraticCurveTo(x - half * 0.53, yy - rise, x, yy + 2);
        ctx.quadraticCurveTo(x + half * 0.52, yy - rise * 0.87, x + half, yy + 2);
        ctx.stroke();
      }
    }
  } else if (pattern === 'contours') {
    for (let row = 0; row < H / 109 + 1; row++) {
      for (let col = 0; col < W / 136 + 1; col++) {
        const seed = row * 157 + col * 31;
        const x = 12 + col * 136 + (row % 2) * 34 + hash(seed + 1) * 24;
        const y = 8 + row * 109 + hash(seed + 2) * 20;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((hash(seed + 3) - 0.5) * 1.15);
        ctx.globalAlpha = 0.043 + hash(seed + 4) * 0.035;
        const count = hash(seed + 5) > 0.62 ? 3 : 2;
        for (let ring = 0; ring < count; ring++) {
          const shift = ring * 9;
          ctx.beginPath();
          ctx.moveTo(-21 - shift * 0.2, 20 + shift);
          ctx.bezierCurveTo(-12, -5 + shift, 14 + shift * 0.28, -8 + shift,
            27 + shift * 0.38, 13 + shift);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  } else if (pattern === 'constellations') {
    // No straight connection segments: use real 5-point silhouettes, glints and dots.
    for (let row = 0; row < H / 82 + 1; row++) {
      for (let col = 0; col < W / 90 + 1; col++) {
        const seed = row * 197 + col * 41;
        const x = 12 + col * 90 + hash(seed + 1) * 58;
        const y = 12 + row * 82 + hash(seed + 2) * 54;
        const kind = hash(seed + 3);
        ctx.globalAlpha = 0.075 + hash(seed + 4) * 0.085;
        if (kind < 0.31) {
          ctx.beginPath();
          ctx.arc(x, y, 0.8 + hash(seed + 5) * 0.55, 0, TAU);
          ctx.fill();
        } else if (kind < 0.78) {
          star(ctx, x, y, 2.6 + hash(seed + 6) * 2.1);
        } else {
          star(ctx, x, y, 3.1 + hash(seed + 7) * 2.7, 4);
        }
        if (hash(seed + 8) > 0.75) {
          ctx.globalAlpha = 0.062;
          ctx.beginPath();
          ctx.arc(x + 20 + hash(seed + 9) * 11,
            y + 12 + hash(seed + 10) * 9, 0.8, 0, TAU);
          ctx.fill();
        }
      }
    }
  } else if (pattern === 'flow') {
    for (let row = 0; row < H / 70 + 1; row++) {
      for (let col = 0; col < W / 114 + 1; col++) {
        const seed = row * 131 + col * 23;
        const x = 13 + col * 114 + (row % 2) * 44 + hash(seed + 1) * 19;
        const y = 13 + row * 70 + hash(seed + 2) * 19;
        const length = 22 + hash(seed + 3) * 20;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((hash(seed + 4) - 0.5) * 1.3);
        ctx.globalAlpha = 0.046 + hash(seed + 5) * 0.037;
        ctx.beginPath();
        ctx.moveTo(-length / 2, 0);
        ctx.bezierCurveTo(-length / 4, -9 - hash(seed + 6) * 3,
          length / 5, 8 + hash(seed + 7) * 5, length / 2, -1);
        ctx.stroke();
        if (hash(seed + 8) > 0.72) {
          ctx.beginPath();
          ctx.arc(length / 2 + 6, 0, 0.85, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

function drawWater(ctx: CanvasRenderingContext2D, effect: Disturbance, age: number) {
  for (let ring = 0; ring < 3; ring++) {
    const t = (age - ring * 0.12) / (1 - ring * 0.12);
    if (t <= 0 || t >= 1) continue;
    ctx.globalAlpha = 0.23 * Math.sin(Math.PI * t) * (1 - t * 0.4);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, 7 + t * 246, 0, TAU);
    ctx.stroke();
  }
}

/** Terrain bloom follows wobbly contour levels, not perfectly circular ripples. */
function drawContourBloom(ctx: CanvasRenderingContext2D, effect: Disturbance, age: number) {
  for (let ring = 0; ring < 3; ring++) {
    const t = (age - ring * 0.13) / (1 - ring * 0.13);
    if (t <= 0 || t >= 1) continue;
    const radius = 14 + t * 125;
    ctx.globalAlpha = 0.14 * Math.sin(Math.PI * t);
    ctx.lineWidth = 1.05;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const angle = i / 60 * TAU;
      const wiggle = 1 + 0.09 * Math.sin(angle * 5 + ring) +
        0.055 * Math.cos(angle * 8 - ring * 0.6);
      const x = effect.x + Math.cos(angle) * radius * wiggle;
      const y = effect.y + Math.sin(angle) * radius * wiggle * 0.67;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

/** A tiny point explosion: separate star particles, never concentric circles. */
function drawStarlight(ctx: CanvasRenderingContext2D, effect: Disturbance, age: number) {
  const fade = Math.pow(1 - age, 1.35);
  ctx.fillStyle = ctx.strokeStyle;
  if (age < 0.55) {
    ctx.globalAlpha = 0.22 * (1 - age / 0.55);
    star(ctx, effect.x, effect.y, 7 + age * 12, 4);
  }
  for (let i = 0; i < 13; i++) {
    const angle = i / 13 * TAU + (hash(i + 16) - 0.5) * 0.55;
    const travel = (27 + hash(i + 36) * 68) * (0.08 + age * 0.92);
    const px = effect.x + Math.cos(angle) * travel;
    const py = effect.y + Math.sin(angle) * travel;
    ctx.globalAlpha = (0.12 + hash(i + 55) * 0.14) * fade;
    if (i % 4 === 0) star(ctx, px, py, 2.5 + (1 - age) * 2.4, 4);
    else {
      ctx.beginPath();
      ctx.arc(px, py, 0.9 + hash(i + 78) * 1.1, 0, TAU);
      ctx.fill();
    }
  }
}

/** A short gust: curved directional strokes drift outward and disappear. */
function drawFlowGust(ctx: CanvasRenderingContext2D, effect: Disturbance, age: number) {
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * TAU + hash(i + 33) * 0.65;
    const travel = age * (54 + hash(i + 46) * 58);
    const x = effect.x + Math.cos(angle) * travel;
    const y = effect.y + Math.sin(angle) * travel;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2 + age * 0.55);
    ctx.globalAlpha = 0.145 * Math.sin(Math.PI * age) *
      (0.7 + hash(i + 57) * 0.3);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(-14, 1);
    ctx.bezierCurveTo(-6, -7, 4, 7, 17, -2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, pattern: GuideMapPattern,
  effects: readonly Disturbance[], now: number) {
  if (pattern === 'plain') return;
  ctx.save();
  for (const effect of effects) {
    const age = clamp((now - effect.start) / lifetime(pattern), 0, 1);
    if (pattern === 'water') drawWater(ctx, effect, age);
    else if (pattern === 'contours') drawContourBloom(ctx, effect, age);
    else if (pattern === 'constellations') drawStarlight(ctx, effect, age);
    else if (pattern === 'flow') drawFlowGust(ctx, effect, age);
  }
  ctx.restore();
}

export const GuideMapBackdrop = defineComponent({
  name: 'GuideMapBackdrop',
  props: { pattern: { type: String as PropType<GuideMapPattern>, required: true } },
  setup(props, { expose }) {
    const canvas = ref<HTMLCanvasElement | null>(null);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const effects: Disturbance[] = [];
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
      for (let i = effects.length - 1; i >= 0; i--) {
        if (now - effects[i].start >= lifetime(props.pattern)) effects.splice(i, 1);
      }
      drawTexture(ctx, props.pattern, effects, now);
      drawEffects(ctx, props.pattern, effects, now);
      ctx.globalAlpha = 1;
    }
    function animate(now: number) {
      frame = 0;
      if (!mounted) return;
      if (motion.matches) effects.splice(0);
      draw(now);
      if (effects.length) frame = requestAnimationFrame(animate);
    }
    function invalidate() {
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      if (mounted) draw();
      if (mounted && effects.length) frame = requestAnimationFrame(animate);
    }
    function interactAt(x: number, y: number) {
      if (!mounted || props.pattern === 'plain' || motion.matches ||
          !Number.isFinite(x) || !Number.isFinite(y)) return;
      effects.push({ x: clamp(x, 0, W), y: clamp(y, 0, H), start: performance.now() });
      if (effects.length > 5) effects.shift();
      if (!frame) frame = requestAnimationFrame(animate);
    }
    expose({ interactAt } satisfies GuideMapBackdropHandle);
    function onMotionChange() { if (motion.matches) effects.splice(0); invalidate(); }
    onMounted(() => {
      mounted = true;
      observer = new MutationObserver(invalidate);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      motion.addEventListener('change', onMotionChange);
      window.addEventListener('resize', invalidate);
      invalidate();
    });
    onActivated(invalidate);
    onDeactivated(() => {
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      effects.splice(0);
    });
    watch(() => props.pattern, () => { effects.splice(0); invalidate(); });
    onBeforeUnmount(() => {
      mounted = false;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      motion.removeEventListener('change', onMotionChange);
      window.removeEventListener('resize', invalidate);
      effects.splice(0);
    });
    return () => h('canvas', { ref: canvas, class: 'guide-map-backdrop',
      'aria-hidden': 'true', role: 'presentation' });
  },
});
