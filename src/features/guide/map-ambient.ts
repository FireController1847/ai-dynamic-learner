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
export function drawGuideAmbient(ctx: CanvasRenderingContext2D,
  pattern: GuideMapPattern, seconds: number): void {
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
      ctx.globalAlpha = brightness * 0.14;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, 13);
      halo.addColorStop(0, ctx.strokeStyle.toString());
      halo.addColorStop(1, 'transparent');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = brightness * 0.33;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(x, y, 1.1 + hash(i + 51) * 0.7, 0, TAU);
      ctx.fill();
    }
  } else if (pattern === 'water') {
    // A handful of crest highlights move a few pixels, not an entire wave sheet.
    for (let i = 0; i < 18; i++) {
      const x = 22 + hash(i * 7 + 1) * (W - 44);
      const y = 20 + hash(i * 7 + 2) * (H - 40);
      const phase = seconds * 0.4 + hash(i * 7 + 3) * TAU;
      ctx.globalAlpha = 0.035 * (0.5 + 0.5 * Math.sin(phase));
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x - 10, y + Math.sin(phase) * 2);
      ctx.quadraticCurveTo(x, y - 4, x + 10, y);
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
