import { defineComponent, h, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch, type PropType } from 'vue';
import type { GuideMapPattern } from './library-model.ts';
import { MAP_CANVAS_HEIGHT, MAP_CANVAS_WIDTH } from './map-presentation.ts';
import { createWaterFoamSprite, drawGuideAmbient } from './map-ambient.ts';
import { drawCircuitBase, drawCircuitMotion, drawProgrammingBase, drawProgrammingMotion,
  launchCircuitSignals, type CircuitSignal } from './map-tech-background.ts';
import { drawProgrammingHudBase, drawProgrammingHudMotion } from './map-programming-hud.ts';
import { drawPowerLinesBase, drawPowerLinesMotion, type PowerPulse } from './map-power-lines.ts';
import { clearPowerLinesInteractions, createPowerLinesInteractions,
  drawPowerLinesInteractions, triggerPowerLinesAt } from './map-power-lines-interactions.ts';

export const GUIDE_MAP_PATTERNS: readonly { value: GuideMapPattern; label: string }[] = [
  { value: 'water', label: 'Water · varied wave crests' },
  { value: 'contours', label: 'Contours · small terrain curves' },
  { value: 'constellations', label: 'Constellations · starlight' },
  { value: 'flow', label: 'Flow · drifting currents' },
  { value: 'fireflies', label: 'Fireflies · drifting lights' },
  { value: 'circuit', label: 'Circuit Board · electrical traces' },
  { value: 'programming', label: 'Programming · binary and hex' },
  { value: 'power-lines', label: 'Power Lines · desert railway and wires' },
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
  pattern === 'constellations' ? 1050 : pattern === 'water' ? 1750 : pattern === 'programming' ? 2300 : 1450;

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
  if (pattern === 'circuit') { drawCircuitBase(ctx); return; }
  if (pattern === 'programming') { drawProgrammingBase(ctx); drawProgrammingHudBase(ctx); return; }
  if (pattern === 'power-lines') { drawPowerLinesBase(ctx); return; }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.05;
  ctx.fillStyle = ctx.strokeStyle;
  if (pattern === 'water') {
    // The foam caps are drawn once in reduced motion or animated over this
    // transparent still layer; no duplicate birds remain underneath.
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

/**
 * Two browser-composited Canvas layers. The static scenery is painted only
 * when the pattern, theme or pixel ratio changes; interactions repaint just
 * the one-pixel-per-map-unit transparent overlay.
 */
export const GuideMapBackdrop = defineComponent({
  name: 'GuideMapBackdrop',
  props: {
    pattern: { type: String as PropType<GuideMapPattern>, required: true },
    paused: { type: Boolean, default: false },
  },
  setup(props, { expose }) {
    const root = ref<HTMLElement | null>(null);
    const staticCanvas = ref<HTMLCanvasElement | null>(null);
    const overlayCanvas = ref<HTMLCanvasElement | null>(null);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const effects: Disturbance[] = [];
    const circuitSignals: CircuitSignal[] = [];
    const powerPulses: PowerPulse[] = [];
    const powerInteractions = createPowerLinesInteractions();
    let mounted = false, active = true, visible = true;
    let frame = 0, lastPaint = 0, animationTime = 0, lastTick = 0;
    let ink = '', waterSprite: HTMLCanvasElement | null = null;
    let glowSprite: HTMLCanvasElement | null = null;
    let observer: MutationObserver | null = null;
    let visibilityObserver: IntersectionObserver | null = null;
    const TARGET_FRAME_MS = 1000 / 40;
    const FALLBACK_FRAME_MS = 1000 / 30;
    let frameBudget = TARGET_FRAME_MS;

    function canAnimate() {
      return mounted && active && visible && !props.paused && !motion.matches &&
        !document.hidden && props.pattern !== 'plain';
    }
    function cancelLoop() {
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      lastPaint = 0;
      lastTick = 0;
    }
    function ensureSize(element: HTMLCanvasElement, scale: number) {
      const width = Math.round(W * scale), height = Math.round(H * scale);
      if (element.width !== width || element.height !== height) {
        element.width = width; element.height = height;
      }
    }
    function repaintStatic() {
      const element = staticCanvas.value;
      if (!mounted || !element) return;
      const scale = Math.min(window.devicePixelRatio || 1, 1.25);
      ensureSize(element, scale);
      const ctx = element.getContext('2d', { alpha: true });
      if (!ctx) return;
      ink = getComputedStyle(element).color;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = ink;
      drawTexture(ctx, props.pattern, [], 0);
      // Firefly glows and water foam are colored/rasterized once, then reused.
      glowSprite = document.createElement('canvas');
      glowSprite.width = glowSprite.height = 40;
      const glow = glowSprite.getContext('2d');
      if (glow) {
        const gradient = glow.createRadialGradient(20, 20, 0, 20, 20, 20);
        gradient.addColorStop(0, ink);
        gradient.addColorStop(0.18, ink);
        gradient.addColorStop(1, 'transparent');
        glow.fillStyle = gradient;
        glow.fillRect(0, 0, 40, 40);
      } else glowSprite = null;
      waterSprite = createWaterFoamSprite(ink);
    }
    function paintOverlay(now: number) {
      const element = overlayCanvas.value;
      if (!element) return;
      // Low-latency 2D is GPU-composited by supporting browsers. 1x buffer
      // bounds pixel-fill work without introducing a WebGL-only dependency.
      ensureSize(element, 1);
      const ctx = element.getContext('2d', { alpha: true, desynchronized: true });
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = ink;
      for (let i = effects.length - 1; i >= 0; i--) {
        if (now - effects[i].start >= lifetime(props.pattern)) effects.splice(i, 1);
      }
      const running = canAnimate();
      if (running && props.pattern === 'circuit')
        drawCircuitMotion(ctx, now / 1000, circuitSignals);
      else if (running && props.pattern === 'programming') {
        drawProgrammingMotion(ctx, now / 1000, effects);
        drawProgrammingHudMotion(ctx, now / 1000);
      } else if (running && props.pattern === 'power-lines') {
        drawPowerLinesMotion(ctx, now / 1000, powerPulses);
        drawPowerLinesInteractions(ctx, now / 1000, powerInteractions);
      }
      // Draw still whitecaps in reduced-motion mode, too.
      if (running || props.pattern === 'water') {
        drawGuideAmbient(ctx, props.pattern, running ? now / 1000 : 0,
          glowSprite, running ? effects : [], waterSprite);
      }
      if (running) drawEffects(ctx, props.pattern, effects, now);
    }
    function animate(now: number) {
      frame = 0;
      if (!canAnimate()) return;
      if (lastPaint && now - lastPaint < frameBudget - 1) {
        frame = requestAnimationFrame(animate);
        return;
      }
      if (lastTick) animationTime += Math.min(now - lastTick, 150);
      lastTick = now;
      const start = performance.now();
      paintOverlay(animationTime);
      const cost = performance.now() - start;
      // Target 40 FPS; avoid fighting map navigation on slower hardware.
      frameBudget = cost > TARGET_FRAME_MS * 0.72 ? FALLBACK_FRAME_MS : TARGET_FRAME_MS;
      lastPaint = now;
      frame = requestAnimationFrame(animate);
    }
    function refresh() {
      cancelLoop();
      if (mounted) {
        repaintStatic();
        paintOverlay(animationTime);
      }
      if (canAnimate()) frame = requestAnimationFrame(animate);
    }
    function updateActivity() {
      cancelLoop();
      if (canAnimate()) frame = requestAnimationFrame(animate);
      else if (mounted && motion.matches) paintOverlay(0);
    }
    function interactAt(x: number, y: number) {
      if (!canAnimate() || !Number.isFinite(x) || !Number.isFinite(y)) return;
      if (props.pattern === 'circuit') {
        launchCircuitSignals(clamp(x, 0, W), clamp(y, 0, H), animationTime, circuitSignals);
      } else if (props.pattern === 'power-lines') {
        triggerPowerLinesAt(clamp(x, 0, W), clamp(y, 0, H), animationTime, powerInteractions, powerPulses);
      } else {
        effects.push({ x: clamp(x, 0, W), y: clamp(y, 0, H), start: animationTime });
        if (effects.length > 5) effects.shift();
      }
      // Do not interrupt/recreate the render loop on an interaction.
      if (!frame) frame = requestAnimationFrame(animate);
    }
    expose({ interactAt } satisfies GuideMapBackdropHandle);
    onMounted(() => {
      mounted = true;
      observer = new MutationObserver(refresh);
      observer.observe(document.documentElement, {
        attributes: true, attributeFilter: ['data-theme'],
      });
      visibilityObserver = new IntersectionObserver(entries => {
        visible = entries.some(entry => entry.isIntersecting);
        updateActivity();
      });
      if (root.value) visibilityObserver.observe(root.value);
      motion.addEventListener('change', updateActivity);
      document.addEventListener('visibilitychange', updateActivity);
      window.addEventListener('resize', refresh);
      refresh();
    });
    onActivated(() => { active = true; updateActivity(); });
    onDeactivated(() => { active = false; cancelLoop(); effects.splice(0); circuitSignals.splice(0); powerPulses.splice(0); clearPowerLinesInteractions(powerInteractions); });
    watch(() => props.pattern, () => { effects.splice(0); circuitSignals.splice(0); powerPulses.splice(0); clearPowerLinesInteractions(powerInteractions); refresh(); });
    watch(() => props.paused, paused => {
      if (paused) {
        cancelLoop();
        effects.splice(0);
      } else updateActivity();
    });
    onBeforeUnmount(() => {
      mounted = false;
      cancelLoop();
      observer?.disconnect();
      visibilityObserver?.disconnect();
      motion.removeEventListener('change', updateActivity);
      document.removeEventListener('visibilitychange', updateActivity);
      window.removeEventListener('resize', refresh);
      effects.splice(0);
      circuitSignals.splice(0);
      powerPulses.splice(0);
      clearPowerLinesInteractions(powerInteractions);
      glowSprite = waterSprite = null;
    });
    return () => h('div', { ref: root, class: 'guide-map-backdrop',
      'aria-hidden': 'true', role: 'presentation' }, [
      h('canvas', { ref: staticCanvas, class: 'guide-map-backdrop-layer guide-map-backdrop-static',
        'aria-hidden': 'true', role: 'presentation' }),
      h('canvas', { ref: overlayCanvas, class: 'guide-map-backdrop-layer guide-map-backdrop-motion',
        'aria-hidden': 'true', role: 'presentation' }),
    ]);
  },
});
