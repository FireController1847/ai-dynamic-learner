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

/** Render the foam and glow once, then reuse the tiny sprite for every crest. */
export function createWaterFoamSprite(ink: string): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = 64; sprite.height = 32;
  const ctx = sprite.getContext('2d');
  if (!ctx) return sprite;
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineCap = 'round';
  ctx.shadowColor = ink;
  ctx.shadowBlur = 5;
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = 1.6;
  // A single shallow foam lip, not the paired arches that resembled birds.
  ctx.beginPath();
  ctx.moveTo(7, 21);
  ctx.quadraticCurveTo(31, 8, 57, 21);
  ctx.stroke();
  ctx.globalAlpha = 0.23;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(16, 24);
  ctx.quadraticCurveTo(29, 21, 40, 24);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.22;
  for (const [x, y] of [[21, 25], [39, 26], [48, 23]]) {
    ctx.beginPath();
    ctx.arc(x, y, 0.75, 0, TAU);
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
    // Quiet swells continuously appear, foam briefly, then vanish as the next
    // crest rolls in. Foam is a cached one-hump sprite, avoiding per-frame paths,
    // shadows or gradients for hundreds of caps.
    for (const crest of waterCrests) {
      const phase = seconds * crest.speed + crest.phase - crest.x * 0.006;
      const foam = (0.5 + 0.5 * Math.sin(phase)) ** 1.9;
      if (foam < 0.025) continue;
      const x = crest.x + Math.cos(phase * 0.8) * 3.8;
      let y = crest.y + Math.sin(phase) * 2.4;
      let size = crest.size * (0.92 + foam * 0.12);
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
        ctx.moveTo(x - 13 * size, y + 2);
        ctx.quadraticCurveTo(x, y - 6 * size, x + 13 * size, y + 2);
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
