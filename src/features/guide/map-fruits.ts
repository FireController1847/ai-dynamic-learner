import { MAP_CANVAS_HEIGHT as H, MAP_CANVAS_WIDTH as W } from './map-presentation.ts';

/** Stable, source-free fruit illustrations: muted at rest, temporarily painted on interaction. */
const KINDS = ['banana', 'apple', 'strawberry', 'orange', 'lemon', 'pear',
  'grapes', 'cherries', 'watermelon', 'pineapple', 'kiwi'] as const;
type FruitKind = typeof KINDS[number];
interface Fruit { x: number; y: number; scale: number; angle: number; kind: FruitKind }
export interface FruitPaint { target: number; originX: number; originY: number; start: number }
export const FRUIT_PAINT_LIFETIME = 3000;
const TAU = Math.PI * 2;
const hash = (seed: number) => {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
const palette: Record<FruitKind, { body: string; accent: string; detail: string }> = {
  banana: { body: '#e9c34d', accent: '#a2823d', detail: '#fff0a5' },
  apple: { body: '#df6659', accent: '#569859', detail: '#ffa69a' },
  strawberry: { body: '#db526a', accent: '#5b9956', detail: '#ffe7a3' },
  orange: { body: '#e99a37', accent: '#66a05d', detail: '#ffd08a' },
  lemon: { body: '#ebc852', accent: '#75a45a', detail: '#fff0a1' },
  pear: { body: '#9aad5e', accent: '#658e4d', detail: '#dbe4a0' },
  grapes: { body: '#9876b8', accent: '#6a9960', detail: '#d0b8e1' },
  cherries: { body: '#d95770', accent: '#689b59', detail: '#f79ba7' },
  watermelon: { body: '#df6979', accent: '#559c65', detail: '#593d45' },
  pineapple: { body: '#dda747', accent: '#669c62', detail: '#f7d987' },
  kiwi: { body: '#a6b66d', accent: '#7c8950', detail: '#e9e2a3' },
};

/* Dense but unobtrusive offset rows. The positions, sizes, and fruit variety
 * stay deterministic so the scene never jumps when the map is repainted. */
const fruits: readonly Fruit[] = (() => {
  const result: Fruit[] = [];
  for (let row = 0; row < Math.ceil(H / 83); row++) {
    for (let col = 0; col < Math.ceil(W / 89); col++) {
      const seed = 97 * row + 31 * col;
      const x = 39 + col * 89 + (row % 2) * 28 + (hash(seed + 1) - .5) * 21;
      const y = 38 + row * 83 + (hash(seed + 2) - .5) * 20;
      if (x > W - 20 || y > H - 21) continue;
      result.push({
        x, y,
        scale: .40 + hash(seed + 3) * .14,
        angle: (hash(seed + 4) - .5) * .62,
        kind: KINDS[(row * 5 + col * 7 + Math.floor(hash(seed + 5) * 4)) % KINDS.length],
      });
    }
  }
  return result;
})();

function drawFruit(ctx: CanvasRenderingContext2D, fruit: Fruit,
  ink: string, colored: boolean, opacity = 1) {
  const colors = palette[fruit.kind];
  const neutral = !colored;
  const alpha = colored ? opacity : 1;
  ctx.save();
  ctx.translate(fruit.x, fruit.y);
  ctx.rotate(fruit.angle);
  ctx.scale(fruit.scale, fruit.scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const fill = (color: string) => {
    ctx.fillStyle = neutral ? ink : color;
    ctx.globalAlpha = alpha * (neutral ? .034 : .86);
    ctx.fill();
    ctx.strokeStyle = neutral ? ink : color;
    ctx.globalAlpha = alpha * (neutral ? .115 : .94);
    ctx.lineWidth = 2.3;
    ctx.stroke();
  };
  const stroke = (color: string, thickness = 2.7) => {
    ctx.strokeStyle = neutral ? ink : color;
    ctx.globalAlpha = alpha * (neutral ? .14 : .85);
    ctx.lineWidth = thickness;
    ctx.stroke();
  };
  const dots = (points: readonly [number, number][], color: string, radius = 2.1) => {
    ctx.fillStyle = neutral ? ink : color;
    ctx.globalAlpha = alpha * (neutral ? .11 : .85);
    for (const [x, y] of points) {
      ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
    }
  };
  switch (fruit.kind) {
    case 'banana':
      ctx.beginPath();
      ctx.moveTo(-41, -20);
      ctx.bezierCurveTo(-20, 7, 12, 14, 40, -13);
      ctx.quadraticCurveTo(43, -16, 43, -9);
      ctx.bezierCurveTo(28, 28, -15, 43, -38, 3);
      ctx.closePath(); fill(colors.body);
      ctx.beginPath(); ctx.moveTo(-32, -12);
      ctx.bezierCurveTo(-13, 20, 15, 25, 34, -4); stroke(colors.detail);
      ctx.beginPath(); ctx.moveTo(-42, -21); ctx.lineTo(-46, -24);
      ctx.moveTo(41, -12); ctx.lineTo(46, -16); stroke(colors.accent, 3.2);
      break;
    case 'apple':
      ctx.beginPath(); ctx.moveTo(0, -27);
      ctx.bezierCurveTo(-17, -43, -37, -28, -38, -9);
      ctx.bezierCurveTo(-43, 15, -27, 41, -10, 40);
      ctx.quadraticCurveTo(-2, 39, 0, 36);
      ctx.quadraticCurveTo(14, 46, 28, 31);
      ctx.bezierCurveTo(44, 13, 43, -16, 28, -28);
      ctx.quadraticCurveTo(14, -37, 0, -27); fill(colors.body);
      ctx.beginPath(); ctx.moveTo(0, -29); ctx.quadraticCurveTo(2, -39, 9, -44);
      stroke(colors.accent, 3);
      ctx.beginPath(); ctx.moveTo(2, -35); ctx.quadraticCurveTo(24, -47, 29, -31);
      ctx.quadraticCurveTo(14, -23, 2, -35); fill(colors.accent);
      ctx.beginPath(); ctx.moveTo(-24, -10); ctx.quadraticCurveTo(-26, 5, -19, 13);
      stroke(colors.detail);
      break;
    case 'strawberry':
      ctx.beginPath(); ctx.moveTo(0, -24);
      ctx.bezierCurveTo(-40, -40, -45, -6, -27, 18);
      ctx.quadraticCurveTo(-9, 42, 0, 46);
      ctx.quadraticCurveTo(15, 37, 28, 16);
      ctx.bezierCurveTo(46, -13, 31, -36, 0, -24); fill(colors.body);
      ctx.beginPath(); ctx.moveTo(-30, -24); ctx.quadraticCurveTo(-13, -18, 0, -31);
      ctx.quadraticCurveTo(13, -18, 31, -25);
      ctx.quadraticCurveTo(20, -5, 5, -17);
      ctx.quadraticCurveTo(-15, -5, -30, -24); fill(colors.accent);
      dots([[-22,-3],[-5,-5],[15,-2],[-14,14],[6,15],[0,32]], colors.detail, 2.4);
      break;
    case 'orange':
      ctx.beginPath(); ctx.arc(0, 3, 37, 0, TAU); fill(colors.body);
      ctx.beginPath(); ctx.arc(-12, -8, 18, Math.PI, Math.PI * 1.42);
      stroke(colors.detail);
      ctx.beginPath(); ctx.moveTo(0, -35);
      ctx.quadraticCurveTo(17, -51, 30, -36);
      ctx.quadraticCurveTo(16, -29, 0, -35); fill(colors.accent);
      dots([[13,15],[-18,18],[23,-7]], colors.detail, 1.5);
      break;
    case 'lemon':
      ctx.beginPath(); ctx.moveTo(-42, 2);
      ctx.bezierCurveTo(-24, -40, 24, -39, 43, -2);
      ctx.quadraticCurveTo(49, 2, 43, 6);
      ctx.bezierCurveTo(23, 40, -25, 39, -42, 7);
      ctx.quadraticCurveTo(-48, 4, -42, 2); fill(colors.body);
      ctx.beginPath(); ctx.moveTo(-27, -7); ctx.quadraticCurveTo(-14, -26, 13, -25);
      stroke(colors.detail);
      break;
    case 'pear':
      ctx.beginPath(); ctx.moveTo(0, -32);
      ctx.bezierCurveTo(-18, -38, -25, -15, -24, -8);
      ctx.bezierCurveTo(-27, 2, -42, 7, -39, 25);
      ctx.bezierCurveTo(-37, 53, 37, 52, 39, 24);
      ctx.bezierCurveTo(42, 7, 25, 1, 24, -9);
      ctx.bezierCurveTo(24, -26, 15, -35, 0, -32); fill(colors.body);
      ctx.beginPath(); ctx.moveTo(1,-33); ctx.lineTo(7,-44);
      stroke(colors.accent, 3.4);
      ctx.beginPath(); ctx.moveTo(3,-42); ctx.quadraticCurveTo(24,-52,28,-34);
      ctx.quadraticCurveTo(14,-29,3,-42); fill(colors.accent);
      ctx.beginPath(); ctx.moveTo(-23,17); ctx.quadraticCurveTo(-25,34,-13,37);
      stroke(colors.detail);
      break;
    case 'grapes':
      ctx.beginPath(); ctx.moveTo(1,-37); ctx.quadraticCurveTo(14,-51,20,-43);
      stroke(colors.accent, 3);
      for (const [x,y] of [[-14,-23],[10,-24],[-25,-2],[0,-3],[24,-3],
        [-14,19],[11,19],[0,37]] as const) {
        ctx.beginPath(); ctx.arc(x,y,15,0,TAU); fill(colors.body);
      }
      dots([[-18,-29],[6,-29],[-29,-8],[7,-9]], colors.detail,2.3);
      break;
    case 'cherries':
      ctx.beginPath(); ctx.arc(-20,18,19,0,TAU); fill(colors.body);
      ctx.beginPath(); ctx.arc(20,18,19,0,TAU); fill(colors.body);
      ctx.beginPath(); ctx.moveTo(-20,-1);
      ctx.bezierCurveTo(-15,-31,4,-45,6,-43);
      ctx.bezierCurveTo(9,-35,18,-17,20,-1);
      stroke(colors.accent, 3);
      ctx.beginPath(); ctx.moveTo(5,-41);
      ctx.quadraticCurveTo(24,-52,31,-37);
      ctx.quadraticCurveTo(17,-30,5,-41); fill(colors.accent);
      dots([[-26,11],[15,11]], colors.detail,4.3);
      break;
    case 'watermelon':
      ctx.beginPath(); ctx.moveTo(-42,-18); ctx.lineTo(41,-18);
      ctx.quadraticCurveTo(2,58,-42,-18); ctx.closePath(); fill(colors.accent);
      ctx.beginPath(); ctx.moveTo(-35,-18); ctx.lineTo(34,-18);
      ctx.quadraticCurveTo(0,43,-35,-18); ctx.closePath(); fill(colors.body);
      dots([[-18,-1],[0,0],[17,-1],[-7,18],[8,17]], colors.detail,2.6);
      break;
    case 'pineapple':
      ctx.beginPath();
      ctx.moveTo(0,-25); ctx.bezierCurveTo(-43,-21,-39,31,-22,42);
      ctx.quadraticCurveTo(0,54,23,42);
      ctx.bezierCurveTo(43,25,43,-21,0,-25); fill(colors.body);
      ctx.beginPath(); ctx.moveTo(0,-24);
      ctx.lineTo(-18,-51); ctx.lineTo(-12,-27);
      ctx.lineTo(0,-60); ctx.lineTo(12,-28);
      ctx.lineTo(22,-52); ctx.lineTo(15,-24);
      ctx.closePath(); fill(colors.accent);
      for (let x = -18; x <= 18; x += 12) {
        ctx.beginPath(); ctx.moveTo(x-17,-14); ctx.lineTo(x+21,35);
        ctx.moveTo(x+21,-14); ctx.lineTo(x-17,35); stroke(colors.detail,1.7);
      }
      break;
    case 'kiwi':
      ctx.beginPath(); ctx.ellipse(0,2,36,40,0,0,TAU); fill(colors.accent);
      ctx.beginPath(); ctx.ellipse(0,2,29,33,0,0,TAU); fill(colors.body);
      ctx.beginPath(); ctx.ellipse(0,2,11,13,0,0,TAU); fill(colors.detail);
      ctx.fillStyle = neutral ? ink : '#5d5d38';
      ctx.globalAlpha = alpha * (neutral ? .135 : .8);
      for(let i=0;i<11;i++){
        const angle = i*TAU/11;
        ctx.beginPath();ctx.ellipse(Math.cos(angle)*20,2+Math.sin(angle)*23,
          1.7,3.2,angle,0,TAU);ctx.fill();
      }
      break;
  }
  ctx.restore();
}

export function drawFruitsBase(ctx: CanvasRenderingContext2D, ink: string): void {
  for (const fruit of fruits) drawFruit(ctx, fruit, ink, false);
}

/** Each click selects exactly one fruit; repeat clicks restart its paint animation. */
export function triggerFruitPaint(x: number, y: number, now: number, effects: FruitPaint[]): void {
  let target = -1;
  let nearestDistance = Infinity;
  for (let index = 0; index < fruits.length; index++) {
    const fruit = fruits[index];
    const distance = (fruit.x - x) ** 2 + (fruit.y - y) ** 2;
    if (distance < nearestDistance) { nearestDistance = distance; target = index; }
  }
  const fruit = fruits[target];
  if (!fruit) return;
  const dx = x - fruit.x, dy = y - fruit.y;
  const distance = Math.hypot(dx, dy);
  // A click directly on a fruit begins at that point. A click in the gap
  // begins slightly inside the nearest fruit so no color crosses empty space.
  const reach = fruit.scale * 45;
  const projection = distance > reach ? fruit.scale * 17 / distance : 1;
  const originX = fruit.x + dx * projection;
  const originY = fruit.y + dy * projection;
  const existing = effects.findIndex(effect => effect.target === target);
  if (existing >= 0) effects.splice(existing, 1);
  effects.push({ target, originX, originY, start: now });
  if (effects.length > 5) effects.shift();
}

const bottoms: Record<FruitKind, number> = {
  banana: 29, apple: 39, strawberry: 44, orange: 39, lemon: 33,
  pear: 47, grapes: 51, cherries: 36, watermelon: 31,
  pineapple: 47, kiwi: 41,
};

/** Two narrow wet trails form at the bottom of the painted fruit, with droplets. */
function drawPaintDrips(ctx: CanvasRenderingContext2D, fruit: Fruit,
  elapsed: number, opacity: number): void {
  const progress = clamp((elapsed - 590) / 490, 0, 1);
  if (progress <= 0) return;
  const fade = clamp((2200 - elapsed) / 600, 0, 1) * opacity;
  if (fade <= 0) return;
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle = palette[fruit.kind].body;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const length = 8 + hash(fruit.x * .31 + fruit.y * .12 + i) * 11;
    const delay = i * .19;
    const growth = clamp((progress - delay) / (1 - delay), 0, 1);
    if (!growth) continue;
    const x = fruit.x + (i - 1) * fruit.scale * 18;
    const y = fruit.y + fruit.scale * (bottoms[fruit.kind] - 3);
    const bend = (i - 1) * 3.3;
    const endY = y + length * growth;
    ctx.globalAlpha = fade * (i === 1 ? .80 : .58);
    ctx.lineWidth = i === 1 ? 2.8 : 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + bend, y + length * .6, x + bend, endY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + bend, endY, i === 1 ? 2.9 : 2.1, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** An uneven wet paint front advances from the click, but is only visible
 * wherever this ONE fruit has colored artwork. No map-wide rings or neighbors. */
function clipPaintFront(ctx: CanvasRenderingContext2D, x: number, y: number,
  radius: number): void {
  const steps = 48;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const angle = i / steps * TAU;
    const ripple = 1 + .055 * Math.sin(angle * 5 + .8) +
      .037 * Math.sin(angle * 9 - .6) + .025 * Math.cos(angle * 13 + .3);
    const px = x + Math.cos(angle) * radius * ripple;
    const py = y + Math.sin(angle) * radius * ripple;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.clip();
}

/** Only the clicked fruit paints in, holds briefly, then returns to grayscale. */
export function drawFruitsMotion(ctx: CanvasRenderingContext2D, now: number,
  effects: readonly FruitPaint[], ink: string): void {
  for (const effect of effects) {
    const fruit = fruits[effect.target];
    const elapsed = now - effect.start;
    if (!fruit || elapsed < 0 || elapsed >= FRUIT_PAINT_LIFETIME) continue;
    const progress = clamp(elapsed / 820, 0, 1);
    const ease = 1 - (1 - progress) ** 2.4;
    const radius = 2 + ease * fruit.scale * 148;
    const opacity = clamp((FRUIT_PAINT_LIFETIME - elapsed) / 1050, 0, 1);
    ctx.save();
    clipPaintFront(ctx, effect.originX, effect.originY, radius);
    drawFruit(ctx, fruit, ink, true, opacity);
    ctx.restore();
    // A few tiny runoffs emerge only after the fruit has substantially filled.
    drawPaintDrips(ctx, fruit, elapsed, opacity);
  }
}
