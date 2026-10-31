import { MAP_CANVAS_HEIGHT as H, MAP_CANVAS_WIDTH as W } from './map-presentation.ts';

type Point = { x: number; y: number };
export interface PowerPulse { wire: number; position: number; direction: 1 | -1; start: number }
const TAU = Math.PI * 2;
const horizon = H * 0.375;
const vanishingX = W * 0.58;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** Exaggerated perspective keeps both poles and vehicles visible behind lesson stops. */
const project = (t: number, lateral: number): Point => ({
  x: vanishingX + (lateral - vanishingX) * t,
  y: horizon + (H + 90 - horizon) * t * t,
});
const poleLevels = [0.105, 0.15, 0.215, 0.302, 0.416, 0.57, 0.78, 1.02];
function pole(t: number) {
  const base = project(t, W * 0.83);
  const height = 42 + t * 230;
  const top = { x: base.x, y: base.y - height };
  return { base, top, arm: 17 + t * 51 };
}
function wirePoint(wire: number, index: number): Point {
  const p = pole(poleLevels[index]);
  return { x: p.top.x + (wire - 1) * p.arm * 0.78, y: p.top.y + 8 + wire * (4 + poleLevels[index] * 5) };
}
/** Three sagging wires meet each crossarm; moving sparks use this same geometry. */
function wireAt(wire: number, position: number): Point {
  const u = clamp(position, 0, 1) * (poleLevels.length - 1);
  const i = Math.min(poleLevels.length - 2, Math.floor(u));
  const t = u - i;
  const a = wirePoint(wire, i), b = wirePoint(wire, i + 1);
  const sag = (6 + poleLevels[i + 1] * 9) * 4 * t * (1 - t);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + sag };
}
function beginPath(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    if (i) ctx.lineTo(points[i].x, points[i].y);
    else ctx.moveTo(points[i].x, points[i].y);
  }
}
function strokeSegment(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

/** Theme-ink scenery, intentionally translucent. No hard-coded night/day backgrounds. */
export function drawPowerLinesBase(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  const ink = ctx.strokeStyle;
  ctx.fillStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Quiet desert mesas and a distant mountain ridge.
  ctx.globalAlpha = 0.085;
  ctx.lineWidth = 1.7;
  beginPath(ctx, [
    { x: 0, y: horizon + 22 }, { x: 90, y: horizon + 9 },
    { x: 128, y: horizon - 32 }, { x: 222, y: horizon - 32 },
    { x: 235, y: horizon + 12 }, { x: 365, y: horizon + 14 },
    { x: 402, y: horizon - 42 }, { x: 508, y: horizon - 42 },
    { x: 537, y: horizon + 11 }, { x: W, y: horizon + 23 },
  ]);
  ctx.stroke();
  for (let i = 0; i < 15; i++) {
    const x = i * 119, y = horizon + 58 + (i % 4) * 13;
    ctx.globalAlpha = 0.048;
    strokeSegment(ctx, { x, y }, { x: x + 47, y: y + 2 });
  }

  // Road shoulders and faded road-center markings fan out from the vanishing point.
  ctx.globalAlpha = 0.12;
  ctx.lineWidth = 2.0;
  for (const side of [W * 0.15, W * 0.48, W * 0.53]) {
    strokeSegment(ctx, { x: vanishingX, y: horizon }, project(1.08, side));
  }
  ctx.globalAlpha = 0.095;
  for (let i = 0; i < 16; i++) {
    const t = (i + 0.5) / 16;
    strokeSegment(ctx, project(t, W * 0.49), project(t + 0.024 + t * 0.015, W * 0.49));
  }

  // Railroad rails and ties recede convincingly into the distance.
  ctx.globalAlpha = 0.19;
  ctx.lineWidth = 2.2;
  for (const x of [W * 0.61, W * 0.72]) {
    strokeSegment(ctx, project(0.045, x), project(1.07, x));
  }
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) ** 1.9 * 1.07 + 0.045;
    const left = project(t, W * 0.593), right = project(t, W * 0.74);
    ctx.globalAlpha = 0.055 + t * 0.1;
    ctx.lineWidth = 0.6 + t * 2.0;
    strokeSegment(ctx, left, right);
  }

  // Weathered timber poles, crossarms, insulators and three actual sagging conductors.
  poleLevels.forEach(t => {
    const { base, top, arm } = pole(t);
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 1.2 + t * 4;
    strokeSegment(ctx, base, top);
    ctx.lineWidth = 1 + t * 2.3;
    strokeSegment(ctx, { x: top.x - arm, y: top.y + 9 }, { x: top.x + arm, y: top.y + 9 });
    strokeSegment(ctx, { x: top.x - arm * 0.8, y: top.y + 9 },
      { x: top.x - arm * 0.45, y: top.y + 20 + 7 * t });
    ctx.globalAlpha = 0.22;
    for (let wire = 0; wire < 3; wire++) {
      const p = { x: top.x + (wire - 1) * arm * 0.78, y: top.y + 8 + wire * (4 + t * 5) };
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.2, t * 3.1), 0, TAU); ctx.stroke();
    }
    // Tiny bolts and the characteristic double crossarm silhouette.
    if (t > 0.3) {
      ctx.globalAlpha = 0.09;
      strokeSegment(ctx, { x: top.x - arm * 0.85, y: top.y + 13 },
        { x: top.x + arm * 0.85, y: top.y + 13 });
    }
  });
  ctx.globalAlpha = 0.13;
  ctx.lineWidth = 1.15;
  for (let wire = 0; wire < 3; wire++) {
    const samples: Point[] = [];
    for (let i = 0; i <= 160; i++) samples.push(wireAt(wire, i / 160));
    beginPath(ctx, samples); ctx.stroke();
  }
  ctx.restore();
}

/** One event per period, making a brief distant-to-near pass without random timers. */
function drawTrain(ctx: CanvasRenderingContext2D, seconds: number) {
  const cycle = (seconds + 7) % 35;
  if (cycle >= 8.5) return;
  const front = 0.075 + (cycle / 8.5) * 1.03;
  for (let car = 4; car >= 0; car--) {
    const t = front - car * 0.087;
    if (t < 0.05 || t > 1.1) continue;
    const center = project(t, W * 0.665);
    const width = 10 + t * 82, height = 12 + t * 105;
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = Math.max(0.9, t * 2.7);
    ctx.strokeRect(center.x - width / 2, center.y - height, width, height);
    ctx.globalAlpha = 0.095;
    ctx.fillRect(center.x - width / 2, center.y - height, width, height);
    ctx.clearRect; // No scenery erasure: cars remain a translucent line drawing.
    ctx.globalAlpha = 0.26;
    ctx.strokeRect(center.x - width * 0.34, center.y - height * 0.82,
      width * 0.68, height * 0.33);
    ctx.globalAlpha = 0.22;
    for (const side of [-0.32, 0.32]) {
      ctx.beginPath();
      ctx.arc(center.x + width * side, center.y - height * 0.13,
        Math.max(1, t * 5), 0, TAU); ctx.stroke();
    }
    if (car === 0) {
      ctx.globalAlpha = 0.29;
      for (const side of [-0.25, 0.25]) {
        ctx.beginPath();ctx.arc(center.x + width * side, center.y - height * 0.16,
          Math.max(1, width * 0.045), 0, TAU);ctx.fill();
      }
    }
  }
}
function drawCar(ctx: CanvasRenderingContext2D, seconds: number, phase: number) {
  const cycle = (seconds + phase) % 25;
  if (cycle > 6.5) return;
  const t = 0.1 + cycle / 6.5 * 0.95;
  const p = project(t, phase === 0 ? W * 0.34 : W * 0.24);
  const width = 8 + t * 53, height = 6 + t * 34;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1 + t;
  ctx.beginPath();
  ctx.moveTo(p.x - width / 2, p.y);
  ctx.lineTo(p.x - width / 2, p.y - height * 0.56);
  ctx.lineTo(p.x - width * 0.28, p.y - height);
  ctx.lineTo(p.x + width * 0.28, p.y - height);
  ctx.lineTo(p.x + width / 2, p.y - height * 0.56);
  ctx.lineTo(p.x + width / 2, p.y);
  ctx.closePath();ctx.stroke();
  ctx.globalAlpha = 0.12;
  ctx.fillRect(p.x - width * 0.27, p.y - height * 0.84, width * 0.54, height * 0.25);
  ctx.globalAlpha = 0.27;
  for (const side of [-0.3, 0.3]) {
    ctx.beginPath();ctx.arc(p.x + width * side, p.y, Math.max(1,t * 4),0,TAU);ctx.fill();
  }
}

/** Celestial orbit is visual only: never changes scenery alpha, contrast or page brightness. */
function drawSkyOrbit(ctx: CanvasRenderingContext2D, seconds: number) {
  const center = { x: W * 0.2, y: H * 0.23 };
  const radiusX = 118, radiusY = 62;
  ctx.globalAlpha = 0.07;
  ctx.lineWidth = 1.1;
  ctx.beginPath();ctx.ellipse(center.x,center.y,radiusX,radiusY,-0.13,0,TAU);ctx.stroke();
  for (const [body,angle] of [[0, seconds * 0.075], [1, seconds * 0.075 + Math.PI]] as const) {
    const x=center.x+Math.cos(angle)*radiusX;
    const y=center.y+Math.sin(angle)*radiusY;
    const r=body===0?14:11;
    ctx.globalAlpha=0.19;
    ctx.lineWidth=1.25;
    ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();
    if (body===0) {
      for(let i=0;i<8;i++) {
        const a=i*TAU/8;
        strokeSegment(ctx,{x:x+Math.cos(a)*18,y:y+Math.sin(a)*18},
          {x:x+Math.cos(a)*23,y:y+Math.sin(a)*23});
      }
    } else {
      ctx.globalAlpha=0.1;
      ctx.beginPath();ctx.arc(x+4,y-3,r*0.72,0,TAU);ctx.stroke();
    }
  }
}

/** Spark heads and their translucent tails follow the precise hanging-wire geometry. */
function drawPulse(ctx: CanvasRenderingContext2D, wire: number, position: number,
  direction: 1 | -1, alpha: number) {
  if (position < 0 || position > 1) return;
  const tail = clamp(position - direction * 0.075,0,1);
  const steps=9;
  const points:Point[]=[];
  for(let i=0;i<=steps;i++)points.push(wireAt(wire,tail+(position-tail)*i/steps));
  ctx.globalAlpha=alpha*0.58;
  ctx.lineWidth=2.1;
  beginPath(ctx,points);ctx.stroke();
  const p=wireAt(wire,position);
  ctx.globalAlpha=alpha;
  ctx.beginPath();ctx.arc(p.x,p.y,2.7,0,TAU);ctx.fill();
  ctx.globalAlpha=alpha*0.2;
  ctx.beginPath();ctx.arc(p.x,p.y,5.4,0,TAU);ctx.fill();
}

export function drawPowerLinesMotion(ctx: CanvasRenderingContext2D,
  seconds: number, pulses: readonly PowerPulse[]): void {
  ctx.save();
  ctx.fillStyle=ctx.strokeStyle;
  ctx.lineCap='round';
  ctx.lineJoin='round';
  drawSkyOrbit(ctx,seconds);
  drawTrain(ctx,seconds);
  drawCar(ctx,seconds,0);
  drawCar(ctx,seconds,13);
  for(let wire=0;wire<3;wire++){
    const position=(seconds*(0.045+wire*0.016)+wire*0.33)%1.18-0.09;
    drawPulse(ctx,wire,position,1,0.24);
  }
  for(const pulse of pulses){
    const age=seconds*1000-pulse.start;
    if(age<0||age>4300)continue;
    const p=pulse.position+pulse.direction*age/4300*1.22;
    drawPulse(ctx,pulse.wire,p,pulse.direction,0.83*Math.min(1,(4300-age)/500));
  }
  ctx.restore();
}
export function launchPowerLinesPulse(x:number,y:number,start:number,pulses:PowerPulse[]):void {
  let bestWire=0,bestPosition=0,bestDistance=Infinity;
  for(let wire=0;wire<3;wire++) {
    for(let i=0;i<=175;i++){
      const position=i/175;
      const p=wireAt(wire,position);
      const dist=(p.x-x)**2+(p.y-y)**2;
      if(dist<bestDistance){bestDistance=dist;bestWire=wire;bestPosition=position;}
    }
  }
  pulses.push({wire:bestWire,position:bestPosition,direction:1,start},
    {wire:bestWire,position:bestPosition,direction:-1,start});
  if(pulses.length>18)pulses.splice(0,pulses.length-18);
}
