import { MAP_CANVAS_HEIGHT as H, MAP_CANVAS_WIDTH as W } from './map-presentation.ts';

/** Small monochrome sketches, with one vegetable-specific interaction per click. */
const KINDS = ['asparagus', 'celery', 'carrot', 'broccoli', 'corn',
  'radish', 'cabbage', 'onion', 'mushroom', 'peas', 'pepper'] as const;
type VegetableKind = typeof KINDS[number];
interface Vegetable { x: number; y: number; scale: number; angle: number; kind: VegetableKind }
export interface VegetableMotion { target: number; start: number }
export const VEGETABLE_MOTION_LIFETIME = 2900;
const TAU = Math.PI * 2;
const hash = (seed: number) => {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Dense, deterministic, slightly offset rows avoid a rigid wallpaper grid. */
const vegetables: readonly Vegetable[] = (() => {
  const items: Vegetable[] = [];
  for (let row = 0; row < Math.ceil(H / 92); row++) {
    for (let col = 0; col < Math.ceil(W / 100); col++) {
      const seed = row * 101 + col * 37;
      const x = 47 + col * 100 + (row % 2) * 37 + (hash(seed + 1) - .5) * 19;
      const y = 46 + row * 92 + (hash(seed + 2) - .5) * 21;
      if (x > W - 22 || y > H - 20) continue;
      items.push({
        x, y,
        scale: .44 + hash(seed + 3) * .11,
        angle: (hash(seed + 4) - .5) * .46,
        kind: KINDS[(row * 4 + col * 7 + Math.floor(hash(seed + 5) * 5)) % KINDS.length],
      });
    }
  }
  return items;
})();

function renderVegetable(ctx: CanvasRenderingContext2D, vegetable: Vegetable,
  ink: string, elapsed: number | null): void {
  const active = elapsed !== null;
  const time = (elapsed ?? 0) / 1000;
  const swell = active ? Math.sin(Math.PI * clamp(elapsed / VEGETABLE_MOTION_LIFETIME, 0, 1)) : 0;
  const alpha = active ? .30 + .35 * swell : .105;
  ctx.save();
  ctx.translate(vegetable.x, vegetable.y);
  ctx.rotate(vegetable.angle);
  ctx.scale(vegetable.scale, vegetable.scale);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.5;

  const stroke = (path: () => void, amount = 1, width = 2.5) => {
    ctx.beginPath(); path();
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha * amount;
    ctx.stroke();
  };
  const fill = (path: () => void, amount = 1) => {
    ctx.beginPath(); path();
    ctx.globalAlpha = (active ? .085 + .07 * swell : .021) * amount;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = alpha;
    ctx.stroke();
  };
  const circle = (x: number, y: number, radius: number, amount = 1) =>
    stroke(() => ctx.arc(x, y, radius, 0, TAU), amount, 2);
  const leaf = (x: number, y: number, dx: number, dy: number) =>
    fill(() => {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + dx * .25 - dy * .3, y + dy * .28 + dx * .2,
        x + dx, y + dy);
      ctx.quadraticCurveTo(x + dx * .4 + dy * .25, y + dy * .45 - dx * .14, x, y);
      ctx.closePath();
    });
  const wiggle = Math.sin(time * 12) * swell;
  const bounce = Math.abs(Math.sin(time * 8)) * 11 * swell;

  switch (vegetable.kind) {
    case 'asparagus': {
      for (const offset of [-14, 0, 14]) {
        stroke(() => {
          ctx.moveTo(offset - 5, 32);
          ctx.quadraticCurveTo(offset - 3, -9, offset - 2, -29);
          ctx.lineTo(offset + 5, -29);
          ctx.quadraticCurveTo(offset + 2, -3, offset + 5, 32);
        });
        fill(() => {
          ctx.moveTo(offset - 8, -26); ctx.lineTo(offset + 1, -47);
          ctx.lineTo(offset + 10, -26);
          ctx.quadraticCurveTo(offset + 1, -20, offset - 8, -26);
          ctx.closePath();
        });
        stroke(() => { ctx.moveTo(offset - 6, -22); ctx.lineTo(offset + 6, -22); }, .7);
      }
      if (active) {
        // A tiny saucepan forms around the stalks and begins bubbling.
        fill(() => {
          ctx.moveTo(-30, 10); ctx.lineTo(-28, 35);
          ctx.quadraticCurveTo(0, 42, 28, 35); ctx.lineTo(30, 10);
          ctx.closePath();
        });
        stroke(() => ctx.ellipse(0, 10, 31, 6, 0, 0, TAU));
        stroke(() => { ctx.moveTo(29, 18); ctx.lineTo(43, 17); }, .85, 3);
        for (let i = 0; i < 5; i++) {
          const rise = (time * (17 + i * 3.8) + i * 12) % 48;
          const x = (i - 2) * 10 + Math.sin(time * 3 + i) * 2;
          circle(x, 13 - rise, 2 + (i % 2), .6 * swell);
        }
        for (let i = 0; i < 2; i++) {
          const shift = Math.sin(time * 5 + i) * 3;
          stroke(() => {
            ctx.moveTo(-13 + i * 26, -45);
            ctx.quadraticCurveTo(-21 + i * 26 + shift, -52,
              -12 + i * 26 + shift, -61);
          }, .5 * swell, 1.6);
        }
      }
      break;
    }
    case 'celery': {
      for (const offset of [-16, 0, 16]) {
        stroke(() => {
          ctx.moveTo(offset - 5, 37);
          ctx.quadraticCurveTo(offset - 8, 2, offset - 3, -24);
          ctx.moveTo(offset + 5, 37);
          ctx.quadraticCurveTo(offset + 4, 0, offset + 3, -24);
        });
        stroke(() => { ctx.moveTo(offset, 32); ctx.lineTo(offset, -17); }, .48, 1.5);
        const swing = active ? wiggle * (offset === 0 ? 7 : 11) : 0;
        leaf(offset, -22, -17 + swing, -22);
        leaf(offset, -22, 17 + swing, -24);
        leaf(offset, -30, swing + 2, -19);
      }
      break;
    }
    case 'carrot': {
      ctx.translate(0, -bounce);
      fill(() => {
        ctx.moveTo(-28, -17);
        ctx.quadraticCurveTo(0, -25, 29, -17);
        ctx.quadraticCurveTo(11, 22, 0, 48);
        ctx.quadraticCurveTo(-13, 19, -28, -17);
        ctx.closePath();
      });
      for (const a of [-.65, 0, .65]) {
        stroke(() => {
          ctx.moveTo(0, -18);
          ctx.quadraticCurveTo(8 * Math.sin(a), -33, Math.sin(a) * 23, -48);
        }, 1, 3.3);
        leaf(0, -30, Math.sin(a) * 28 + 4, -19);
      }
      for (let i = 0; i < 3; i++) {
        stroke(() => { ctx.moveTo(-17 + i * 9, 2 + i * 7); ctx.lineTo(-10 + i * 9, 4 + i * 7); }, .45, 1.7);
      }
      if (active) for (const dx of [-21, 23])
        circle(dx, 46 + Math.sin(time * 9 + dx) * 3, 1.8, swell * .42);
      break;
    }
    case 'broccoli': {
      ctx.rotate(active ? .12 * wiggle : 0);
      fill(() => {
        ctx.moveTo(-10, 38); ctx.lineTo(-9, 2); ctx.lineTo(8, 2);
        ctx.lineTo(11, 38); ctx.closePath();
      });
      for (const [x, y, r] of [[-23,-13,21],[-4,-25,25],[22,-12,22],[-11,4,20],[14,6,19]] as const) {
        fill(() => ctx.arc(x, y, r, 0, TAU));
      }
      for (const dx of [-15, 0, 15]) circle(dx, -19, 3, .45);
      break;
    }
    case 'corn': {
      ctx.rotate(active ? Math.sin(time * 7) * .07 * swell : 0);
      fill(() => ctx.ellipse(0, 0, 21, 39, 0, 0, TAU));
      for (let y = -28; y < 32; y += 10) {
        for (const x of [-10, 0, 10]) circle(x, y + (x === 0 ? 3 : 0), 3, .66);
      }
      leaf(-13, 36, -29, -61);
      leaf(13, 36, 28, -60);
      if (active) for (let i = 0; i < 3; i++) {
        const travel = (elapsed / 1000 * 22 + i * 11) % 42;
        circle(-5 + i * 14 + Math.sin(time * 9 + i) * 3, 12 - travel, 3.2, swell * .78);
      }
      break;
    }
    case 'radish': {
      ctx.rotate(active ? .16 * wiggle : 0);
      fill(() => {
        ctx.moveTo(0, -31);
        ctx.bezierCurveTo(-47, -34, -42, 22, -1, 30);
        ctx.bezierCurveTo(42, 22, 47, -34, 0, -31);
        ctx.closePath();
      });
      stroke(() => {
        ctx.moveTo(0, 30);
        ctx.quadraticCurveTo(8, 41, 0, 49);
        ctx.quadraticCurveTo(-8, 53, -6, 59);
      }, 1, 1.7);
      leaf(0, -26, -21 + wiggle * 4, -22);
      leaf(0, -30, 7 + wiggle * 6, -32);
      leaf(0, -27, 25 + wiggle * 5, -16);
      break;
    }
    case 'cabbage': {
      fill(() => ctx.arc(0, 0, 38, 0, TAU));
      stroke(() => {
        ctx.moveTo(-19, -27);
        ctx.bezierCurveTo(-43, -5, -22, 30, 5, 34);
        ctx.moveTo(20, -27);
        ctx.bezierCurveTo(40, -11, 20, 22, -7, 24);
        ctx.moveTo(-10, -10);
        ctx.quadraticCurveTo(11, -31, 24, 1);
      }, .8, 1.9);
      if (active) {
        const fold = (1 + Math.sin(time * 6)) * .5 * swell;
        leaf(-27, 15, -26 - fold * 12, -33 - fold * 10);
        leaf(24, 17, 21 + fold * 10, -35);
      }
      break;
    }
    case 'onion': {
      // An unmistakable onion bulb. No peeling strands or tentacles:
      // clicking makes it gently squish and shed a couple of tiny teardrops.
      const squeeze = active ? Math.sin(time * 10) * .045 * swell : 0;
      ctx.scale(1 + squeeze, 1 - squeeze);
      fill(() => {
        ctx.moveTo(0, -43);
        ctx.bezierCurveTo(-15, -13, -40, -4, -37, 22);
        ctx.bezierCurveTo(-33, 49, 34, 49, 37, 22);
        ctx.bezierCurveTo(41, -4, 14, -16, 0, -43);
        ctx.closePath();
      });
      for (const dx of [-16, 16]) {
        stroke(() => {
          ctx.moveTo(0, -38);
          ctx.quadraticCurveTo(dx * 1.7, 2, dx, 30);
        }, .65, 1.8);
      }
      // Short, discrete teardrops fall free of the onion instead of
      // animating an attached, worm-like peeling line.
      if (active) {
        for (let i = 0; i < 2; i++) {
          const progress = clamp((elapsed - 300 - i * 250) / 850, 0, 1);
          if (progress <= 0 || progress >= 1) continue;
          const x = (i === 0 ? -37 : 37) + (i === 0 ? -6 : 6) * progress;
          const y = 4 + 31 * progress * progress;
          ctx.beginPath();
          ctx.moveTo(x, y - 5);
          ctx.quadraticCurveTo(x - 5, y + 1, x - 3, y + 4);
          ctx.quadraticCurveTo(x, y + 7, x + 3, y + 4);
          ctx.quadraticCurveTo(x + 5, y + 1, x, y - 5);
          ctx.closePath();
          ctx.globalAlpha = alpha * Math.sin(Math.PI * progress) * .8;
          ctx.fill();
        }
      }
      break;
    }
    case 'mushroom': {
      const bob = active ? Math.abs(Math.sin(time * 7)) * 8 * swell : 0;
      ctx.translate(0, -bob);
      fill(() => {
        ctx.moveTo(-11, 8); ctx.lineTo(-13, 38);
        ctx.quadraticCurveTo(0, 43, 13, 38);
        ctx.lineTo(11, 8); ctx.closePath();
      });
      fill(() => {
        ctx.moveTo(-42, 8);
        ctx.bezierCurveTo(-40, -40, 39, -40, 42, 8);
        ctx.quadraticCurveTo(0, 19, -42, 8);
        ctx.closePath();
      });
      for (const [x,y,r] of [[-18,-7,4],[9,-15,5],[24,0,3]] as const)
        circle(x,y,r,.72);
      if (active) {
        stroke(() => {
          ctx.moveTo(-24, 46 + bob); ctx.lineTo(-30, 51 + bob);
          ctx.moveTo(24, 46 + bob); ctx.lineTo(30, 51 + bob);
        }, swell * .7, 1.8);
      }
      break;
    }
    case 'peas': {
      ctx.rotate(active ? Math.sin(time * 11) * .12 * swell : 0);
      fill(() => {
        ctx.moveTo(-43, 10);
        ctx.bezierCurveTo(-34, -22, 29, -27, 43, 1);
        ctx.bezierCurveTo(28, 27, -26, 35, -43, 10);
        ctx.closePath();
      });
      for (let i = 0; i < 3; i++) {
        const hop = active ? Math.abs(Math.sin(time * 8 + i * .45)) * 8 * swell : 0;
        circle(-23 + i * 23, 7 - hop, 9, 1);
      }
      stroke(() => { ctx.moveTo(41, 1); ctx.quadraticCurveTo(51, -7, 53, -14); }, .65);
      break;
    }
    case 'pepper': {
      // Distinctly elongated chili-pepper silhouette instead of a
      // round, lobed bell pepper that could be mistaken for a pumpkin.
      const sway = active ? Math.sin(time * 8) * .11 * swell : 0;
      const hop = active ? Math.abs(Math.sin(time * 6.5)) * 5 * swell : 0;
      ctx.translate(0, -hop);
      ctx.rotate(sway);
      fill(() => {
        ctx.moveTo(-6, -34);
        ctx.bezierCurveTo(-34, -36, -40, -8, -32, 15);
        ctx.bezierCurveTo(-24, 38, -2, 50, 16, 51);
        ctx.quadraticCurveTo(6, 37, 20, 19);
        ctx.bezierCurveTo(33, 3, 37, -17, 22, -32);
        ctx.quadraticCurveTo(9, -39, -6, -34);
        ctx.closePath();
      });
      // Small, recognizable cap, leaf and curved stem at the top.
      fill(() => {
        ctx.moveTo(-17, -32);
        ctx.quadraticCurveTo(-4, -41, 8, -35);
        ctx.quadraticCurveTo(19, -41, 26, -27);
        ctx.quadraticCurveTo(8, -25, -3, -28);
        ctx.quadraticCurveTo(-13, -25, -17, -32);
        ctx.closePath();
      }, .75);
      stroke(() => {
        ctx.moveTo(6, -35);
        ctx.bezierCurveTo(3, -45, -7, -53, -19, -50);
      }, 1, 3.2);
      stroke(() => {
        ctx.moveTo(-18, -20);
        ctx.quadraticCurveTo(-26, 0, -15, 21);
      }, .43, 1.7);
      if (active) {
        // A tiny grounded bounce, not loose floating blobs.
        const dash = 8 * swell;
        stroke(() => {
          ctx.moveTo(-17, 55); ctx.lineTo(-17 - dash, 55 + dash * .35);
          ctx.moveTo(15, 55); ctx.lineTo(15 + dash, 55 + dash * .35);
        }, .5 * swell, 1.6);
      }
      break;
    }
  }
  ctx.restore();
}

export function drawVegetablesBase(ctx: CanvasRenderingContext2D, ink: string): void {
  for (const item of vegetables) renderVegetable(ctx, item, ink, null);
}

/** Choose only one nearby illustration; repeat clicks replay that vegetable's action. */
export function triggerVegetableMotion(x: number, y: number, now: number,
  effects: VegetableMotion[]): void {
  let target = 0, best = Infinity;
  for (let i = 0; i < vegetables.length; i++) {
    const item = vegetables[i];
    const distance = (item.x - x) ** 2 + (item.y - y) ** 2;
    if (distance < best) { best = distance; target = i; }
  }
  const old = effects.findIndex(effect => effect.target === target);
  if (old >= 0) effects.splice(old, 1);
  effects.push({ target, start: now });
  if (effects.length > 5) effects.shift();
}

export function drawVegetablesMotion(ctx: CanvasRenderingContext2D, now: number,
  effects: readonly VegetableMotion[], ink: string): void {
  for (const effect of effects) {
    const item = vegetables[effect.target];
    const elapsed = now - effect.start;
    if (item && elapsed >= 0 && elapsed < VEGETABLE_MOTION_LIFETIME)
      renderVegetable(ctx, item, ink, elapsed);
  }
}
