import type { GuideMapPattern } from './library-model.ts';
import { MAP_CANVAS_HEIGHT as H, MAP_CANVAS_WIDTH as W } from './map-presentation.ts';

const TAU = Math.PI * 2;
const hash = (seed: number): number => {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/**
 * Sparse, slowly moving accents layered over the static Canvas patterns.
 * No randomness, simulation state, networking or time-dependent storage.
 */
interface WaterDisturbance { x: number; y: number; start: number }
interface WaterCrest { x: number; y: number; size: number; phase: number; speed: number; opacity: number }
const waterCrests: WaterCrest[] = [];
// Restore the earlier crest density: roughly 450 soft, individually timed caps.
for (let row = 0; row < H / 48 + 1; row++) for (let col = 0; col < W / 76 + 1; col++) {
  const seed = row * 109 + col * 23;
  waterCrests.push({
    x: 16 + col * 76 + (row % 2) * 31 + (hash(seed + 1) - 0.5) * 14,
    y: 15 + row * 48 + (hash(seed + 2) - 0.5) * 11,
    size: 0.72 + hash(seed + 3) * 0.45,
    phase: hash(seed + 4) * TAU,
    speed: 0.48 + hash(seed + 5) * 0.57,
    opacity: 0.24 + hash(seed + 6) * 0.12,
  });
}

/** A crisp, paired water crest with narrow foam highlights at the high points.
 * Only the tips/crests brighten; no shadow blur, halo or gradient is applied. */
export function createWaterFoamSprite(ink: string): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  // Pre-render at 2× resolution so small crests stay defined when composited.
  sprite.width = 128; sprite.height = 64;
  const ctx = sprite.getContext('2d');
  if (!ctx) return sprite;
  ctx.scale(2, 2);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Restore the original two adjoining arcs instead of a single wide hump.
  ctx.globalAlpha = 0.56;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(8, 23);
  ctx.quadraticCurveTo(20, 9, 32, 23);
  ctx.quadraticCurveTo(44, 12, 56, 23);
  ctx.stroke();

  // Crisp foam glints trace just the tops of both arches. Compute these
  // segments from the same quadratic curves so they follow the exact shape.
  function foamAtCrest(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const t = 0.34 + (i / 8) * 0.32;
      const a = 1 - t;
      const x = a * a * x0 + 2 * a * t * cx + t * t * x1;
      const y = a * a * y0 + 2 * a * t * cy + t * t * y1;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 0.86;
  ctx.lineWidth = 1.3;
  foamAtCrest(8, 23, 20, 9, 32, 23);
  foamAtCrest(32, 23, 44, 12, 56, 23);

  // Only the outer tips get a tiny fleck, not a fuzzy whole-shape glow.
  ctx.globalAlpha = 0.34;
  for (const x of [9, 55]) {
    ctx.beginPath();
    ctx.arc(x, 22, 0.8, 0, TAU);
    ctx.fill();
  }
  return sprite;
}

/** These accents are deliberately less expensive than the cached backdrop. */
export function drawGuideAmbient(ctx: CanvasRenderingContext2D,
  pattern: GuideMapPattern, seconds: number,
  glowSprite?: HTMLCanvasElement | null, disturbances: readonly WaterDisturbance[] = [],
  waterSprite?: HTMLCanvasElement | null): void {
  if (pattern === 'plain') return;
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineCap = 'round';

  if (pattern === 'constellations') {
    // Real stationary stars are in the base texture; a small subset glints.
    for (let row = 0; row < H / 82 + 1; row++) {
      for (let col = 0; col < W / 90 + 1; col++) {
        const seed = row * 197 + col * 41;
        if (hash(seed + 3) < 0.31 || hash(seed + 8) < 0.63) continue;
        const x = 12 + col * 90 + hash(seed + 1) * 58;
        const y = 12 + row * 82 + hash(seed + 2) * 54;
        const shimmer = Math.max(0, Math.sin(seconds * (0.8 + hash(seed + 19) * 0.6) +
          hash(seed + 21) * TAU));
        const brightness = shimmer ** 8;
        if (brightness < 0.045) continue;
        ctx.globalAlpha = 0.22 * brightness;
        const radius = 2 + brightness * 3;
        ctx.beginPath();
        ctx.moveTo(x - radius, y);
        ctx.lineTo(x + radius, y);
        ctx.moveTo(x, y - radius);
        ctx.lineTo(x, y + radius);
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
    }
  } else if (pattern === 'fireflies') {
    // Glowing fireflies drift without changing their underlying seeded positions.
    for (let i = 0; i < 44; i++) {
      const x0 = 22 + hash(i * 5 + 1) * (W - 44);
      const y0 = 22 + hash(i * 5 + 2) * (H - 44);
      const phase = hash(i * 5 + 3) * TAU;
      const speed = 0.26 + hash(i * 5 + 4) * 0.3;
      const x = x0 + Math.sin(seconds * speed + phase) * (12 + hash(i + 17) * 16);
      const y = y0 + Math.cos(seconds * (speed * 0.85) + phase) * (9 + hash(i + 29) * 14);
      const glow = Math.max(0, Math.sin(seconds * (0.9 + hash(i + 91) * 0.65) + phase));
      const brightness = glow * glow * (0.5 + 0.5 * hash(i + 69));
      if (brightness < 0.055) continue;
      if (glowSprite) {
        ctx.globalAlpha = brightness * 0.14;
        ctx.drawImage(glowSprite, x - 13, y - 13, 26, 26);
      }
      ctx.globalAlpha = brightness * 0.33;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(x, y, 1.1 + hash(i + 51) * 0.7, 0, TAU);
      ctx.fill();
    }
  } else if (pattern === 'water') {
    // Restore the original paired cap silhouette. Foam appears and fades
    // along its upper ridges rather than blurring the entire wave with a halo.
    for (const crest of waterCrests) {
      const phase = seconds * crest.speed + crest.phase - crest.x * 0.006;
      const foam = (0.5 + 0.5 * Math.sin(phase)) ** 1.9;
      if (foam < 0.025) continue;
      // Minimize sideways/up-and-down motion that made the paired crests
      // look like flapping birds. Brightness changes do most of the work.
      const x = crest.x + Math.cos(phase * 0.8) * 1.1;
      let y = crest.y + Math.sin(phase) * 0.75;
      let size = crest.size * (0.98 + foam * 0.04);
      for (const disturbance of disturbances) {
        const age = (seconds * 1000 - disturbance.start) / 1750;
        if (age < 0 || age >= 1 ||
            Math.abs(x - disturbance.x) > 330 ||
            Math.abs(y - disturbance.y) > 330) continue;
        const dist = Math.hypot(x - disturbance.x, y - disturbance.y);
        const offset = (dist - age * 265) / 34;
        if (Math.abs(offset) > 3) continue;
        const impulse = Math.exp(-offset * offset) * (1 - age);
        y += 5 * Math.cos(offset * 2) * impulse;
        size += 0.045 * impulse;
      }
      ctx.globalAlpha = crest.opacity * foam;
      if (waterSprite) {
        const w = 54 * size, h = 27 * size;
        ctx.drawImage(waterSprite, x - w / 2, y - h / 2, w, h);
      } else {
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x - 24 * size, y + 2);
        ctx.quadraticCurveTo(x - 12 * size, y - 12 * size, x, y + 2);
        ctx.quadraticCurveTo(x + 12 * size, y - 9 * size, x + 24 * size, y + 2);
        ctx.stroke();
      }
    }
  } else if (pattern === 'flow') {
    for (let i = 0; i < 22; i++) {
      const x = 25 + hash(i * 11 + 1) * (W - 50);
      const y = 25 + hash(i * 11 + 2) * (H - 50);
      const phase = seconds * (0.33 + hash(i + 5) * 0.2) + hash(i + 7) * TAU;
      const dx = Math.sin(phase) * 9;
      ctx.globalAlpha = 0.055 * (0.55 + 0.45 * Math.cos(phase));
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x - 8 + dx, y);
      ctx.quadraticCurveTo(x + dx, y - 6, x + 8 + dx, y + 1);
      ctx.stroke();
    }
  } else if (pattern === 'contours') {
    for (let i = 0; i < 14; i++) {
      const x = 25 + hash(i * 11 + 1) * (W - 50);
      const y = 25 + hash(i * 11 + 2) * (H - 50);
      const phase = seconds * 0.28 + hash(i + 3) * TAU;
      ctx.globalAlpha = 0.045 * (0.55 + 0.45 * Math.sin(phase));
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.ellipse(x, y, 12 + Math.sin(phase) * 2, 5.5 + Math.cos(phase) * 1.2,
        phase * 0.09, 0.18 * Math.PI, 0.84 * Math.PI);
      ctx.stroke();
    }
  }
  ctx.restore();
}
