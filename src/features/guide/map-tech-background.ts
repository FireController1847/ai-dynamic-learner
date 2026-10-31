import { MAP_CANVAS_HEIGHT as H, MAP_CANVAS_WIDTH as W } from './map-presentation.ts';

interface Point { x: number; y: number }
interface Trace { points: Point[]; distances: number[]; length: number }
export interface CircuitSignal { trace: number; distance: number; direction: 1 | -1; start: number }
interface ClickEffect { x: number; y: number; start: number }
const TAU = Math.PI * 2;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const hash = (seed: number) => {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};

function trace(points: Point[]): Trace {
  const distances = [0];
  for (let i = 1; i < points.length; i++)
    distances.push(distances[i - 1] + Math.hypot(
      points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return { points, distances, length: distances[distances.length - 1] };
}

/** Deterministic orthogonal PCB runs. Each short branch meets a main wire. */
const traces: Trace[] = [];
for (let row = 0; row < Math.ceil(H / 108); row++) {
  for (let col = 0; col < Math.ceil(W / 440); col++) {
    const seed = row * 79 + col * 19;
    const y = 52 + row * 108;
    const x = 24 + col * 440 + hash(seed + 1) * 32;
    const end = Math.min(W - 12, x + 292 + hash(seed + 2) * 115);
    if (end - x < 100 || y > H - 14) continue;
    const corner = x + 75 + hash(seed + 3) * 54;
    const bend = (hash(seed + 4) > 0.5 ? 1 : -1) * (21 + hash(seed + 5) * 13);
    const returnX = end - 49;
    traces.push(trace([
      { x, y }, { x: corner, y }, { x: corner, y: y + bend },
      { x: returnX, y: y + bend }, { x: returnX, y }, { x: end, y },
    ]));
    if (hash(seed + 6) > 0.28) {
      const side = hash(seed + 7) > 0.5 ? 1 : -1;
      const branchY = clamp(y + bend + side * (31 + hash(seed + 8) * 18), 8, H - 8);
      const branchX = corner + 42 + hash(seed + 9) * 55;
      traces.push(trace([
        { x: corner, y: y + bend }, { x: corner, y: branchY },
        { x: branchX, y: branchY }, { x: branchX, y: branchY + side * 18 },
      ]));
    }
  }
}

function pointAt(route: Trace, distance: number): Point {
  const d = clamp(distance, 0, route.length);
  for (let j = 1; j < route.points.length; j++) {
    if (d > route.distances[j]) continue;
    const span = route.distances[j] - route.distances[j - 1];
    const t = span ? (d - route.distances[j - 1]) / span : 0;
    const a = route.points[j - 1], b = route.points[j];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  return route.points[route.points.length - 1];
}

/** Light follows vertices in the trace (no diagonal shortcuts around bends). */
function drawSignal(ctx: CanvasRenderingContext2D, route: Trace,
  distance: number, direction: 1 | -1, alpha: number) {
  const tail = distance - direction * 41;
  const lo = clamp(Math.min(distance, tail), 0, route.length);
  const hi = clamp(Math.max(distance, tail), 0, route.length);
  if (hi - lo < 1) return;
  const a = pointAt(route, lo), b = pointAt(route, hi);
  ctx.globalAlpha = alpha * 0.52;
  ctx.lineWidth = 2.7;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  for (let i = 1; i < route.points.length - 1; i++)
    if (route.distances[i] > lo && route.distances[i] < hi)
      ctx.lineTo(route.points[i].x, route.points[i].y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  if (distance < 0 || distance > route.length) return;
  const head = pointAt(route, distance);
  ctx.globalAlpha = alpha * 0.86;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 2.5, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = alpha * 0.18;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 5.2, 0, TAU);
  ctx.fill();
}

export function drawCircuitBase(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = ctx.strokeStyle;
  for (let i = 0; i < traces.length; i++) {
    const route = traces[i];
    ctx.globalAlpha = 0.095 + hash(i + 8) * 0.065;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    route.points.forEach((p, j) => { if (j) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.stroke();
    ctx.globalAlpha = 0.12;
    for (const pad of [route.points[0], route.points[route.points.length - 1]]) {
      ctx.beginPath(); ctx.arc(pad.x, pad.y, 3, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(pad.x, pad.y, 1.15, 0, TAU); ctx.fill();
    }
    if (route.points.length === 6 && i % 8 === 0) {
      const p = route.points[0];
      ctx.globalAlpha = 0.085;
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - 24, p.y - 17, 48, 34);
      ctx.strokeRect(p.x - 19, p.y - 12, 38, 24);
      for (let pin = -1; pin <= 1; pin++) {
        ctx.beginPath();
        ctx.moveTo(p.x + pin * 13, p.y - 17); ctx.lineTo(p.x + pin * 13, p.y - 24);
        ctx.moveTo(p.x + pin * 13, p.y + 17); ctx.lineTo(p.x + pin * 13, p.y + 24);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export function drawCircuitMotion(ctx: CanvasRenderingContext2D, seconds: number,
  signals: readonly CircuitSignal[]): void {
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < traces.length; i += 3) {
    const route = traces[i];
    const direction: 1 | -1 = i % 2 ? -1 : 1;
    const offset = (seconds * (61 + hash(i + 16) * 48) +
      hash(i + 21) * (route.length + 190)) % (route.length + 190) - 95;
    drawSignal(ctx, route, direction === 1 ? offset : route.length - offset, direction, 0.34);
  }
  for (const signal of signals) {
    const route = traces[signal.trace];
    if (!route) continue;
    const age = seconds * 1000 - signal.start;
    if (age < 0 || age > 3600) continue;
    const distance = signal.distance + signal.direction * (age / 1000) * 180;
    drawSignal(ctx, route, distance, signal.direction,
      0.85 * Math.min(1, (3600 - age) / 650));
  }
  ctx.restore();
}

/** A click launches two opposing electrical pulses from the nearest trace segment. */
export function launchCircuitSignals(x: number, y: number,
  start: number, signals: CircuitSignal[]): void {
  let bestRoute = 0, bestDistance = 0, bestScore = Infinity;
  for (let i = 0; i < traces.length; i++) {
    const route = traces[i];
    for (let j = 1; j < route.points.length; j++) {
      const a = route.points[j - 1], b = route.points[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
      const px = a.x + dx * t, py = a.y + dy * t;
      const score = (x - px) ** 2 + (y - py) ** 2;
      if (score < bestScore) {
        bestScore = score; bestRoute = i;
        bestDistance = route.distances[j - 1] + Math.hypot(dx, dy) * t;
      }
    }
  }
  signals.push(
    { trace: bestRoute, distance: bestDistance, direction: 1, start },
    { trace: bestRoute, distance: bestDistance, direction: -1, start },
  );
  if (signals.length > 16) signals.splice(0, signals.length - 16);
}

const snippets = [
  ['// build a new idea', 'const idea = await learn();', 'return idea.explore();'],
  ['function discover(input) {', '  return input.map(x => x + 1);', '}'],
  ['> initializing workspace', '> compiling curiosity...', '> status: ready'],
  ['if (question) {', '  investigate(question);', '  // keep exploring'],
  ['git status --short', 'npm run build', '✓ 0 errors'],
  ['for (const concept of topics) {', '  connect(concept);', '}'],
];
const glyphs = ['01', '10', '{}', '[]', '=>', 'fn', 'let', '0x', '++', '&&', '</>', 'if', '::', 'async', 'const'];

export function drawProgrammingBase(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.font = '12px ui-monospace, SFMono-Regular, Consolas, monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = ctx.strokeStyle;
  for (let row = 0; row < Math.ceil(H / 195); row++)
    for (let col = 0; col < Math.ceil(W / 370); col++) {
      const seed = row * 37 + col * 11;
      const x = 22 + col * 370 + hash(seed + 4) * 19;
      const y = 34 + row * 195 + hash(seed + 5) * 30;
      const snippet = snippets[Math.floor(hash(seed + 6) * snippets.length)];
      ctx.globalAlpha = 0.065;
      for (let j = 0; j < 3; j++)
        ctx.fillText(String(row * 3 + j + 1).padStart(2, '0'), x, y + j * 20);
      ctx.globalAlpha = 0.095;
      snippet.forEach((line, index) => ctx.fillText(line, x + 27, y + index * 20));
      ctx.globalAlpha = 0.055;
      ctx.fillRect(x, y + 66, 95 + hash(seed + 8) * 110, 1);
    }
  ctx.restore();
}

export function drawProgrammingMotion(ctx: CanvasRenderingContext2D,
  seconds: number, effects: readonly ClickEffect[]): void {
  ctx.save();
  ctx.font = '12px ui-monospace, SFMono-Regular, Consolas, monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ctx.strokeStyle;
  // Hacker-terminal code streams: subtle trailing symbols, bright leading cursor.
  for (let i = 0; i < Math.ceil(W / 83); i++) {
    const x = 28 + i * 83 + hash(i + 3) * 13;
    const speed = 41 + hash(i + 4) * 67;
    const head = ((seconds * speed + hash(i + 6) * H) % (H + 280)) - 130;
    for (let j = 0; j < 7; j++) {
      const y = head - j * 19;
      if (y < 0 || y > H) continue;
      ctx.globalAlpha = (1 - j / 7) ** 1.9 * 0.26;
      ctx.fillText(glyphs[Math.floor(hash(i * 101 + j * 17 + Math.floor(seconds * 1.7)) *
        glyphs.length)], x, y);
    }
    if (head >= 0 && head <= H) {
      ctx.globalAlpha = 0.26;
      ctx.fillRect(x - 2, head + 10, 21, 1);
    }
  }
  // Background interactions briefly display a little mock compiler activity.
  for (const effect of effects) {
    const age = seconds * 1000 - effect.start;
    if (age < 0 || age > 2300) continue;
    const opacity = Math.min(1, age / 180, (2300 - age) / 490);
    const x = clamp(effect.x, 14, W - 184), y = clamp(effect.y, 16, H - 65);
    ctx.globalAlpha = opacity * 0.32;
    ctx.fillText('> compile --interactive', x, y);
    if (age > 320) ctx.fillText('> linking modules...', x, y + 18);
    if (age > 840) ctx.fillText('> build: SUCCESS  ✓', x, y + 36);
    if (age < 840 && Math.floor(age / 310) % 2 === 0)
      ctx.fillRect(x + 157, y + 9, 6, 2);
  }
  ctx.restore();
}
