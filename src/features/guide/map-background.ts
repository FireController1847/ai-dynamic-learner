import { defineComponent, h, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch, type PropType } from 'vue';
import type { GuideMapPattern } from './library-model.ts';
import { MAP_CANVAS_HEIGHT, MAP_CANVAS_WIDTH } from './map-presentation.ts';
import { drawGuideAmbient } from './map-ambient.ts';

export const GUIDE_MAP_PATTERNS: readonly { value: GuideMapPattern; label: string }[] = [
  { value: 'water', label: 'Water · varied wave crests' },
  { value: 'contours', label: 'Contours · small terrain curves' },
  { value: 'constellations', label: 'Constellations · starlight' },
  { value: 'flow', label: 'Flow · drifting currents' },
  { value: 'fireflies', label: 'Fireflies · drifting lights' },
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
  } else if (pattern === 'fireflies') {
    for (let i = 0; i < 44; i++) {
      const x = 22 + hash(i * 5 + 1) * (W - 44);
      const y = 22 + hash(i * 5 + 2) * (H - 44);
      ctx.globalAlpha = 0.045 + hash(i + 67) * 0.035;
      ctx.beginPath();
      ctx.arc(x, y, 1 + hash(i + 51) * 0.55, 0, TAU);
      ctx.fill();
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

/** Tapping fireflies scatters a few points of light, not circular water ripples. */
function drawFireflies(ctx: CanvasRenderingContext2D, effect: Disturbance, age: number) {
  ctx.fillStyle = ctx.strokeStyle;
  for (let i = 0; i < 12; i++) {
    const angle = i * 2.39996 + hash(i + 34) * 0.7;
    const distance = age * (23 + hash(i + 49) * 94);
    const x = effect.x + Math.cos(angle) * distance;
    const y = effect.y + Math.sin(angle) * distance - age * 15;
    ctx.globalAlpha = 0.22 * (1 - age) * (0.45 + hash(i + 51) * 0.55);
    ctx.beginPath();
    ctx.arc(x, y, 1 + hash(i + 63) * 1.15, 0, TAU);
    ctx.fill();
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
    else if (pattern === 'fireflies') drawFireflies(ctx, effect, age);
  }
  ctx.restore();
}

export const GuideMapBackdrop = defineComponent({
  name: 'GuideMapBackdrop',
  props: {
    pattern: { type: String as PropType<GuideMapPattern>, required: true },
    paused: { type: Boolean, default: false },
  },
  setup(props, { expose }) {
    const canvas = ref<HTMLCanvasElement | null>(null);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const effects: Disturbance[] = [];
    let frame = 0, mounted = false, active = true, visible = true;
    let tick: number | null = null;
    // The scenery and firefly glow are immutable until the theme, DPR or
    // selected pattern changes. Keep them off the ambient animation hot path.
    let staticLayer: HTMLCanvasElement | null = null;
    let glowSprite: HTMLCanvasElement | null = null;
    let ink = '';
    let cachedWidth = 0, cachedHeight = 0, needsRepaint = true;
    function invalidateStatic() {
      needsRepaint = true;
      invalidate();
    }
    function ensureStatic(element: HTMLCanvasElement, dpr: number) {
      const width = Math.round(W * dpr), height = Math.round(H * dpr);
      if (!needsRepaint && staticLayer && width === cachedWidth && height === cachedHeight) return;
      needsRepaint = false;
      cachedWidth = width; cachedHeight = height;
      ink = getComputedStyle(element).color;
      const layer = document.createElement('canvas');
      layer.width = width; layer.height = height;
      const layerCtx = layer.getContext('2d');
      if (layerCtx) {
        layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        layerCtx.strokeStyle = ink;
        drawTexture(layerCtx, props.pattern, [], 0);
        staticLayer = layer;
      } else staticLayer = null;
      // A single reusable firefly halo replaces dozens of radial gradients
      // created on every frame. The glow follows the current theme ink.
      const sprite = document.createElement('canvas');
      sprite.width = sprite.height = 40;
      const spriteCtx = sprite.getContext('2d');
      if (spriteCtx) {
        const gradient = spriteCtx.createRadialGradient(20, 20, 0, 20, 20, 20);
        gradient.addColorStop(0, ink);
        gradient.addColorStop(0.18, ink);
        gradient.addColorStop(1, 'transparent');
        spriteCtx.fillStyle = gradient;
        spriteCtx.fillRect(0, 0, 40, 40);
        glowSprite = sprite;
      } else glowSprite = null;
    }
    let observer: MutationObserver | null = null;
    let visibilityObserver: IntersectionObserver | null = null;
    function canAnimate() {
      return mounted && active && visible && !props.paused && !motion.matches &&
        !document.hidden && props.pattern !== 'plain';
    }
    function stopAnimation() {
      if (tick !== null) { window.clearTimeout(tick); tick = null; }
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
    }
    // Ambient motion is intentionally throttled to ~10fps (brief interactions
    // to ~20fps), rather than running a constant 60fps render loop.
    function schedule() {
      if (!canAnimate() || frame || tick !== null) return;
      tick = window.setTimeout(() => {
        tick = null;
        if (canAnimate()) frame = requestAnimationFrame(animate);
      }, effects.length ? 50 : 100);
    }
    function draw(now = performance.now()) {
      const element = canvas.value;
      const ctx = element?.getContext('2d');
      if (!element || !ctx) return;
      // Decorative low-contrast lines do not benefit from full 2–3x retina
      // buffers. Limit the pixel work while retaining crisp, small details.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const pixelW = Math.round(W * dpr), pixelH = Math.round(H * dpr);
      if (element.width !== pixelW || element.height !== pixelH) {
        element.width = pixelW; element.height = pixelH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ensureStatic(element, dpr);
      ctx.strokeStyle = ink;
      for (let i = effects.length - 1; i >= 0; i--) {
        if (now - effects[i].start >= lifetime(props.pattern)) effects.splice(i, 1);
      }
      if (staticLayer) ctx.drawImage(staticLayer, 0, 0, W, H);
      else drawTexture(ctx, props.pattern, [], 0);
      if (canAnimate()) drawGuideAmbient(ctx, props.pattern, now / 1000, glowSprite, effects);
      drawEffects(ctx, props.pattern, effects, now);
      ctx.globalAlpha = 1;
    }
    function animate(now: number) {
      frame = 0;
      if (!canAnimate()) return;
      draw(now);
      schedule();
    }
    function invalidate() {
      stopAnimation();
      if (mounted) draw();
      schedule();
    }
    function interactAt(x: number, y: number) {
      if (!canAnimate() || !Number.isFinite(x) || !Number.isFinite(y)) return;
      effects.push({ x: clamp(x, 0, W), y: clamp(y, 0, H), start: performance.now() });
      if (effects.length > 5) effects.shift();
      stopAnimation();
      frame = requestAnimationFrame(animate);
    }
    expose({ interactAt } satisfies GuideMapBackdropHandle);
    function onMotionChange() { if (motion.matches) effects.splice(0); invalidate(); }
    onMounted(() => {
      mounted = true;
      observer = new MutationObserver(invalidateStatic);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      visibilityObserver = new IntersectionObserver(entries => {
        visible = entries.some(entry => entry.isIntersecting);
        invalidate();
      });
      if (canvas.value) visibilityObserver.observe(canvas.value);
      motion.addEventListener('change', onMotionChange);
      document.addEventListener('visibilitychange', invalidate);
      window.addEventListener('resize', invalidateStatic);
      invalidate();
    });
    onActivated(() => { active = true; invalidate(); });
    onDeactivated(() => { active = false; stopAnimation(); effects.splice(0); });
    watch(() => props.pattern, () => { effects.splice(0); invalidateStatic(); });
    watch(() => props.paused, paused => {
      if (paused) { stopAnimation(); effects.splice(0); }
      else invalidate();
    });
    onBeforeUnmount(() => {
      mounted = false;
      stopAnimation();
      observer?.disconnect();
      visibilityObserver?.disconnect();
      motion.removeEventListener('change', onMotionChange);
      document.removeEventListener('visibilitychange', invalidate);
      window.removeEventListener('resize', invalidateStatic);
      staticLayer = null;
      glowSprite = null;
      effects.splice(0);
    });
    return () => h('canvas', { ref: canvas, class: 'guide-map-backdrop',
      'aria-hidden': 'true', role: 'presentation' });
  },
});
