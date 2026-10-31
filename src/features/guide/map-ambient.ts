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
interface WaterCrest { x: number; y: number; half: number; rise: number; phase: number; speed: number; opacity: number }
const waterCrests: WaterCrest[] = [];
for (let row = 0; row < H / 74 + 1; row++) for (let col = 0; col < W / 91 + 1; col++) {
  const seed = row * 109 + col * 23;
  waterCrests.push({
    x: 18 + col * 91 + (row % 2) * 35 + (hash(seed + 1) - 0.5) * 19,
    y: 17 + row * 74 + (hash(seed + 2) - 0.5) * 16,
    half: 10 + hash(seed + 3) * 7,
    rise: 4 + hash(seed + 4) * 4,
    phase: hash(seed + 5) * TAU,
    speed: 0.56 + hash(seed + 6) * 0.33,
    opacity: 0.046 + hash(seed + 7) * 0.039,
  });
}

/** These accents are deliberately less expensive than the cached backdrop. */
export function drawGuideAmbient(ctx: CanvasRenderingContext2D,
  pattern: GuideMapPattern, seconds: number,
  glowSprite?: HTMLCanvasElement | null, disturbances: readonly WaterDisturbance[] = []): void {
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
    // Rolling crests travel in staggered, softly overlapping bands over the
    // cached water motif. Each crest has its own phase, height and speed.
    ctx.lineWidth = 1.15;
    for (const crest of waterCrests) {
      const phase = seconds * crest.speed - crest.x * 0.014 + crest.phase;
      const swell = Math.sin(phase);
      const x = crest.x + Math.cos(phase * 0.7) * 3.5;
      let y = crest.y + swell * 4.4;
      let rise = crest.rise * (0.84 + 0.25 * Math.sin(phase + 0.7));
      for (const disturbance of disturbances) {
        const age = (seconds * 1000 - disturbance.start) / 1750;
        if (age < 0 || age >= 1) continue;
        const distance = Math.hypot(x - disturbance.x, y - disturbance.y);
        const offset = (distance - age * 265) / 35;
        y += 6 * Math.cos(offset * 2.2) * Math.exp(-offset * offset) * (1 - age);
        rise += 1.5 * Math.exp(-offset * offset) * (1 - age);
      }
      ctx.globalAlpha = crest.opacity * (0.72 + 0.28 * (swell + 1) * 0.5);
      ctx.beginPath();
      ctx.moveTo(x - crest.half, y + 1.8);
      ctx.quadraticCurveTo(x - crest.half * 0.50, y - rise, x, y + 1.8);
      ctx.quadraticCurveTo(x + crest.half * 0.53, y - rise * 0.9,
        x + crest.half, y + 1.8);
      ctx.stroke();
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
