import { MAP_CANVAS_HEIGHT as H, MAP_CANVAS_WIDTH as W } from './map-presentation.ts';
import { launchPowerLinesPulse, poleXs, post, railY, roadTop, skyLine, wireAt,
  type PowerPulse } from './map-power-lines.ts';

interface TrainPass { x: number; direction: 1 | -1; start: number }
interface RoadPass { x: number; lane: 0 | 1; start: number }
interface SkyFlash { x: number; y: number; body: 0 | 1 | null; start: number }
interface PoleFlash { index: number; y: number; start: number }

/** All transient effects are bounded and use the backdrop's pause-aware animation clock. */
export interface PowerLinesInteractions {
  trains: TrainPass[];
  cars: RoadPass[];
  skies: SkyFlash[];
  poles: PoleFlash[];
}
export function createPowerLinesInteractions(): PowerLinesInteractions {
  return { trains: [], cars: [], skies: [], poles: [] };
}
export function clearPowerLinesInteractions(effects: PowerLinesInteractions): void {
  effects.trains.length = 0;
  effects.cars.length = 0;
  effects.skies.length = 0;
  effects.poles.length = 0;
}
const TAU = Math.PI * 2;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const distanceSquared = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
function segmentDistanceSquared(x: number, y: number,
  a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? clamp(((x - a.x) * dx + (y - a.y) * dy) / length, 0, 1) : 0;
  return (x - a.x - dx * t) ** 2 + (y - a.y - dy * t) ** 2;
}
function bandDistance(y: number, top: number, bottom: number): number {
  return y < top ? top - y : y > bottom ? y - bottom : 0;
}

/** Hit-test the visible scenery, not a set of arbitrary left/right screen regions. */
export function triggerPowerLinesAt(x: number, y: number, now: number,
  state: PowerLinesInteractions, pulses: PowerPulse[]): void {
  // Each band has its natural visible extent; the wires and posts use exact paths.
  let kind: 'sky' | 'train' | 'car' | 'wire' | 'pole' = 'sky';
  let best = bandDistance(y, 0, skyLine + 20) ** 2;
  const railScore = bandDistance(y, railY - 51, railY + 71) ** 2;
  if (railScore < best) { best = railScore; kind = 'train'; }
  const roadScore = bandDistance(y, roadTop, H) ** 2;
  if (roadScore < best) { best = roadScore; kind = 'car'; }

  let nearestWire = 0;
  for (let wire = 0; wire < 3; wire++) {
    for (let step = 0; step < 128; step++) {
      const a = wireAt(wire, step / 128);
      const b = wireAt(wire, (step + 1) / 128);
      const distance = segmentDistanceSquared(x, y, a, b);
      if (distance < best) { best = distance; kind = 'wire'; nearestWire = wire; }
    }
  }
  let nearestPole = 0;
  for (let index = 0; index < poleXs.length; index++) {
    const p = post(index);
    const footToTop = segmentDistanceSquared(x, y, p.base, p.top);
    const crossarm = segmentDistanceSquared(x, y,
      { x: p.top.x - p.arm - 6, y: p.top.y + 17 },
      { x: p.top.x + p.arm + 6, y: p.top.y + 17 });
    const distance = Math.min(footToTop, crossarm);
    if (distance < best) { best = distance; kind = 'pole'; nearestPole = index; }
  }

  if (kind === 'wire') {
    // Pulse from the nearest conductor exactly where the user clicked.
    const position = clamp((x - poleXs[0]) / (poleXs[poleXs.length - 1] - poleXs[0]), 0, 1);
    const p = wireAt(nearestWire, position);
    launchPowerLinesPulse(p.x, p.y, now, pulses);
  } else if (kind === 'pole') {
    state.poles.push({ index: nearestPole, y, start: now });
    const p = post(nearestPole);
    // A brief spark climbs the timber and then energizes the attached conductors.
    launchPowerLinesPulse(p.top.x, p.top.y + 22, now + 340, pulses);
    if (state.poles.length > 8) state.poles.shift();
  } else if (kind === 'train') {
    state.trains.push({ x, direction: x > W / 2 ? -1 : 1, start: now });
    if (state.trains.length > 5) state.trains.shift();
  } else if (kind === 'car') {
    state.cars.push({ x, lane: y > roadTop + 130 ? 1 : 0, start: now });
    if (state.cars.length > 8) state.cars.shift();
  } else {
    const center = { x: W * 0.76, y: H * 0.18 };
    const angle = now / 1000 * 0.075;
    const sun = { x: center.x + Math.cos(angle) * 120,
      y: center.y + Math.sin(angle) * 56 };
    const moon = { x: center.x - Math.cos(angle) * 120,
      y: center.y - Math.sin(angle) * 56 };
    const dSun = distanceSquared({ x, y }, sun);
    const dMoon = distanceSquared({ x, y }, moon);
    state.skies.push({ x, y, body: Math.min(dSun, dMoon) < 42 ** 2
      ? dSun < dMoon ? 0 : 1 : null, start: now });
    if (state.skies.length > 8) state.skies.shift();
  }
}
function stroke(ctx: CanvasRenderingContext2D,
  ax: number, ay: number, bx: number, by: number) {
  ctx.beginPath();ctx.moveTo(ax, ay);ctx.lineTo(bx, by);ctx.stroke();
}

function drawTriggeredTrain(ctx: CanvasRenderingContext2D, event: TrainPass, age: number) {
  if (age > 12500) return;
  const direction = event.direction;
  const front = event.x + direction * age / 1000 * 145;
  const base = railY + 30;
  for (let car = 4; car >= 0; car--) {
    const x = front - direction * car * 129;
    if (x < -145 || x > W + 145) continue;
    const engine = car === 0;
    const width = engine ? 116 : 119;
    const left = x - width / 2;
    const height = engine ? 56 : 42;
    ctx.globalAlpha = engine ? .31 : .24;
    ctx.lineWidth = 1.9;
    ctx.strokeRect(left, base - height, width - 7, height - 4);
    ctx.globalAlpha = .085;
    ctx.fillRect(left, base - height, width - 7, height - 4);
    ctx.globalAlpha = .27;
    for (let w = 0; w < 3; w++)
      ctx.strokeRect(left + 12 + w * 31, base - height + 8, 20, 14);
    ctx.globalAlpha = .27;
    for (const dx of [22, width - 25]) {
      ctx.beginPath();ctx.arc(left + dx, base, 5, 0, TAU);ctx.stroke();
    }
    if (engine) {
      ctx.globalAlpha = .42;
      ctx.beginPath();ctx.arc(x + direction * 44, base - 18, 3, 0, TAU);ctx.fill();
    }
  }
}
function drawTriggeredCar(ctx: CanvasRenderingContext2D, event: RoadPass, age: number) {
  if (age > 13500) return;
  const direction = event.lane === 0 ? 1 : -1;
  const width = event.lane === 0 ? 80 : 68;
  const height = event.lane === 0 ? 33 : 29;
  const x = event.x + direction * age / 1000 * (event.lane === 0 ? 130 : 118);
  if (x < -width || x > W + width) return;
  const y = event.lane === 0 ? roadTop + 91 : roadTop + 168;
  ctx.globalAlpha = .29;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x - width / 2, y);
  ctx.lineTo(x - width / 2, y - height * .48);
  ctx.lineTo(x - width * .27, y - height);
  ctx.lineTo(x + width * .23, y - height);
  ctx.lineTo(x + width / 2, y - height * .45);
  ctx.lineTo(x + width / 2, y);
  ctx.closePath();ctx.stroke();
  ctx.globalAlpha = .09;
  ctx.fillRect(x - width * .25, y - height * .82, width * .5, height * .25);
  ctx.globalAlpha = .28;
  for (const offset of [-width * .31, width * .3]) {
    ctx.beginPath();ctx.arc(x + offset, y, 5, 0, TAU);ctx.stroke();
  }
  if (age < 850) {
    ctx.globalAlpha = .16 * (1 - age / 850);
    for (let i = 0; i < 3; i++)
      stroke(ctx, x - direction * (width * .55 + i * 10), y - 4 - i * 4,
        x - direction * (width * .6 + i * 12), y - 7 - i * 4);
  }
}
function drawSkyFlash(ctx: CanvasRenderingContext2D, event: SkyFlash,
  age: number, seconds: number) {
  if (age >= 2350) return;
  const progress = age / 2350, fade = (1 - progress) ** 1.5;
  let x = event.x, y = event.y;
  if (event.body !== null) {
    const angle = seconds * .075 + (event.body === 0 ? 0 : Math.PI);
    x = W * .76 + Math.cos(angle) * 120;
    y = H * .18 + Math.sin(angle) * 56;
    ctx.globalAlpha = .25 * fade;
    ctx.lineWidth = 1.5;
    ctx.beginPath();ctx.arc(x, y, 16 + age * .013, 0, TAU);ctx.stroke();
  } else {
    // Shooting-star glint travels gently near the click; it never changes the sky color.
    x += age * .045;
    y -= age * .014;
    ctx.globalAlpha = .25 * fade;
    ctx.lineWidth = 1.4;
    stroke(ctx, x - 30 * Math.sin(Math.PI * progress), y + 9, x, y);
  }
  ctx.globalAlpha = .36 * fade;
  ctx.lineWidth = 1.3;
  stroke(ctx, x - 7, y, x + 7, y);
  stroke(ctx, x, y - 7, x, y + 7);
  ctx.beginPath();ctx.arc(x, y, 2, 0, TAU);ctx.fill();
}
function drawPoleSpark(ctx: CanvasRenderingContext2D, event: PoleFlash, age: number) {
  if (age >= 950) return;
  const p = post(event.index);
  const t = Math.min(1, age / 390);
  const startY = clamp(event.y, p.top.y + 10, p.base.y);
  const x = p.base.x + (p.top.x - p.base.x) * ((p.base.y - startY) / (p.base.y - p.top.y));
  const px = x + (p.top.x - x) * t, py = startY + (p.top.y + 22 - startY) * t;
  const fade = age < 400 ? 1 : (950 - age) / 550;
  ctx.globalAlpha = .48 * fade;
  ctx.lineWidth = 2;
  stroke(ctx, px, py + 10, px, py);
  ctx.beginPath();ctx.arc(px, py, 3, 0, TAU);ctx.fill();
}

/** Only the relevant user-triggered event is added; ambient motion stays unchanged. */
export function drawPowerLinesInteractions(ctx: CanvasRenderingContext2D,
  seconds: number, state: PowerLinesInteractions): void {
  const now = seconds * 1000;
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const e of state.trains) {
    const age = now - e.start;
    if (age >= 0 && age < 12500) drawTriggeredTrain(ctx, e, age);
  }
  for (const e of state.cars) {
    const age = now - e.start;
    if (age >= 0 && age < 13500) drawTriggeredCar(ctx, e, age);
  }
  for (const e of state.skies) {
    const age = now - e.start;
    if (age >= 0 && age < 2350) drawSkyFlash(ctx, e, age, seconds);
  }
  for (const e of state.poles) {
    const age = now - e.start;
    if (age >= 0 && age < 950) drawPoleSpark(ctx, e, age);
  }
  ctx.restore();
}
