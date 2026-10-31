import { MAP_CANVAS_HEIGHT as H, MAP_CANVAS_WIDTH as W } from './map-presentation.ts';

type Point = { x: number; y: number };
export interface PowerPulse { wire: number; position: number; direction: 1 | -1; start: number }
const TAU = Math.PI * 2;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const hash = (n: number) => {
  const value = Math.sin(n * 117.13 + 51.7) * 43758.54;
  return value - Math.floor(value);
};

// Side-on desert panorama, composed as horizontal bands rather than a road-to-horizon view.
// Back to front: sky, railroad, power poles, then the road.
const skyLine = H * 0.385;
const railY = H * 0.485;
const poleGround = H * 0.755;
const roadTop = H * 0.775;
const poleXs = [-48, 172, 395, 620, 845, 1070, 1295, 1520, W + 110];

function post(index: number) {
  const x = poleXs[index];
  const size = 0.94 + 0.075 * Math.sin(index * 1.8);
  const base = { x, y: poleGround + (hash(index + 61) - 0.5) * 12 };
  const top = { x: x + 4 * Math.sin(index), y: base.y - 155 * size };
  return { base, top, arm: 33 * size, size };
}
function wirePoint(wire: number, index: number): Point {
  const p = post(index);
  return { x: p.top.x + (wire - 1) * p.arm * 0.84,
    y: p.top.y + 11 + wire * 11 };
}
/** All electrical animation and static line work share these hanging conductor paths. */
function wireAt(wire: number, position: number): Point {
  const u = clamp(position, 0, 1) * (poleXs.length - 1);
  const i = Math.min(poleXs.length - 2, Math.floor(u));
  const t = u - i;
  const a = wirePoint(wire, i), b = wirePoint(wire, i + 1);
  const sag = (10 + hash(i + wire * 29) * 6) * 4 * t * (1 - t);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + sag };
}
function segment(ctx: CanvasRenderingContext2D, a: Point, b: Point) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}
function polyline(ctx: CanvasRenderingContext2D, points: readonly Point[]) {
  ctx.beginPath();
  points.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
  ctx.stroke();
}
function mesa(ctx: CanvasRenderingContext2D, x: number, width: number, height: number) {
  const base = skyLine + 18;
  polyline(ctx, [
    { x: x - 27, y: base }, { x, y: base - 12 },
    { x: x + width * 0.18, y: base - height },
    { x: x + width * 0.77, y: base - height },
    { x: x + width * 0.89, y: base - 12 }, { x: x + width + 32, y: base },
  ]);
}

/** Theme-aware, gently translucent panorama. No simulated night dimming. */
export function drawPowerLinesBase(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Desert horizon: mesas, distant dunes, scattered low shrubs.
  ctx.globalAlpha = 0.075;
  ctx.lineWidth = 1.6;
  mesa(ctx, -26, 270, 55);
  mesa(ctx, 310, 350, 40);
  mesa(ctx, 760, 270, 72);
  mesa(ctx, 1160, 355, 50);
  segment(ctx, { x: 0, y: skyLine + 19 }, { x: W, y: skyLine + 19 });
  for (let i = 0; i < 22; i++) {
    const x = hash(i * 13 + 9) * W;
    const y = skyLine + 35 + hash(i * 17 + 8) * 71;
    ctx.globalAlpha = 0.035 + hash(i + 11) * 0.035;
    segment(ctx, { x, y }, { x: x + 19 + hash(i + 6) * 40, y: y + 1.5 });
  }

  // Railway stays horizontally behind the pole line; train moves laterally.
  const upper = railY + 30, lower = railY + 64;
  ctx.globalAlpha = 0.17;
  ctx.lineWidth = 2.1;
  segment(ctx, { x: 0, y: upper }, { x: W, y: upper });
  segment(ctx, { x: 0, y: lower }, { x: W, y: lower });
  ctx.lineWidth = 0.8;
  for (let x = 0; x <= W + 10; x += 27) {
    ctx.globalAlpha = 0.075 + hash(x) * 0.035;
    segment(ctx, { x: x - 5, y: upper - 7 }, { x: x + 6, y: lower + 7 });
  }

  // Wooden posts with pairs of arms, braces and ceramic insulators.
  for (let i = 0; i < poleXs.length; i++) {
    const { base, top, arm, size } = post(i);
    ctx.globalAlpha = 0.17;
    ctx.lineWidth = 3.6 * size;
    segment(ctx, base, top);
    ctx.lineWidth = 1.9;
    segment(ctx, { x: top.x - arm - 6, y: top.y + 17 },
      { x: top.x + arm + 6, y: top.y + 17 });
    ctx.globalAlpha = 0.11;
    segment(ctx, { x: top.x - arm * 0.8, y: top.y + 20 },
      { x: top.x - arm * 0.37, y: top.y + 42 });
    segment(ctx, { x: top.x + arm * 0.8, y: top.y + 20 },
      { x: top.x + arm * 0.37, y: top.y + 42 });
    ctx.globalAlpha = 0.18;
    for (let wire = 0; wire < 3; wire++) {
      const p = wirePoint(wire, i);
      ctx.beginPath();ctx.arc(p.x, p.y, 2.15, 0, TAU);ctx.stroke();
      segment(ctx, { x: p.x, y: p.y + 2 }, { x: p.x, y: top.y + 17 });
    }
    // Slight knots make the poles read as timber rather than circuit-board bars.
    ctx.globalAlpha = 0.065;
    segment(ctx, { x: base.x - 2, y: base.y - 40 }, { x: base.x + 1, y: base.y - 30 });
    segment(ctx, { x: base.x + 2, y: base.y - 85 }, { x: base.x - 1, y: base.y - 74 });
  }
  for (let wire = 0; wire < 3; wire++) {
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 1.2;
    const path: Point[] = [];
    for (let i = 0; i <= 180; i++) path.push(wireAt(wire, i / 180));
    polyline(ctx, path);
  }

  // Lower roadway: side-on traffic lanes with sparse dashed paint and roadside gravel.
  ctx.globalAlpha = 0.115;
  ctx.lineWidth = 1.7;
  segment(ctx, { x: 0, y: roadTop }, { x: W, y: roadTop });
  segment(ctx, { x: 0, y: H - 45 }, { x: W, y: H - 45 });
  ctx.globalAlpha = 0.075;
  ctx.lineWidth = 1.5;
  for (let x = 13; x < W; x += 88)
    segment(ctx, { x, y: roadTop + 103 }, { x: x + 47, y: roadTop + 103 });
  for (let i = 0; i < 36; i++) {
    const x = hash(i * 12 + 31) * W;
    const y = poleGround + 7 + hash(i * 17 + 2) * 16;
    ctx.globalAlpha = 0.052;
    segment(ctx, { x, y }, { x: x + 4 + hash(i * 2) * 10, y: y - 2 });
  }
  ctx.restore();
}

function drawSkyOrbit(ctx: CanvasRenderingContext2D, seconds: number) {
  const center = { x: W * 0.76, y: H * 0.18 };
  const rx = 120, ry = 56;
  ctx.globalAlpha = 0.062;
  ctx.lineWidth = 1;
  ctx.beginPath();ctx.ellipse(center.x,center.y,rx,ry,-0.11,0,TAU);ctx.stroke();
  for (const [body,angle] of [[0,seconds * 0.075],[1,seconds * 0.075 + Math.PI]] as const) {
    const x=center.x+Math.cos(angle)*rx, y=center.y+Math.sin(angle)*ry;
    const r=body===0?14:10;
    ctx.globalAlpha=0.18;
    ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();
    if (body===0) for (let i=0;i<8;i++) {
      const a=i*TAU/8;
      segment(ctx,{x:x+Math.cos(a)*18,y:y+Math.sin(a)*18},
        {x:x+Math.cos(a)*23,y:y+Math.sin(a)*23});
    } else {
      ctx.globalAlpha=0.08;
      ctx.beginPath();ctx.arc(x+4,y-3,r*0.65,0,TAU);ctx.stroke();
    }
  }
}
/** The passing consist is an outlined locomotive and cars, along the rear railway. */
function drawTrain(ctx: CanvasRenderingContext2D, seconds: number) {
  const cycle = (seconds + 5) % 37;
  if (cycle >= 10.8) return;
  const front = -55 + (W + 650) * (cycle / 10.8);
  const y = railY + 30;
  for (let car = 4; car >= 0; car--) {
    const x = front - car * 129;
    if (x < -135 || x > W + 35) continue;
    const engine = car === 0;
    const width = engine ? 116 : 119;
    const height = engine ? 56 : 42;
    ctx.globalAlpha = engine ? 0.2 : 0.145;
    ctx.lineWidth = 1.7;
    ctx.strokeRect(x - width, y - height, width - 7, height - 4);
    ctx.globalAlpha = 0.07;
    ctx.fillRect(x - width, y - height, width - 7, height - 4);
    ctx.globalAlpha = 0.19;
    for (let w = 0; w < 3; w++) {
      const wx = x - width + 15 + w * 32;
      ctx.strokeRect(wx, y - height + 8, 20, 14);
    }
    ctx.globalAlpha = 0.18;
    for (const wx of [x - width + 25, x - 23]) {
      ctx.beginPath();ctx.arc(wx,y,5.5,0,TAU);ctx.stroke();
    }
    if (engine) {
      ctx.globalAlpha = 0.22;
      segment(ctx,{x:x-7,y:y-31},{x:x+8,y:y-31});
      ctx.beginPath();ctx.arc(x-8,y-22,3,0,TAU);ctx.fill();
    }
  }
}
function drawCar(ctx: CanvasRenderingContext2D, seconds: number, phase: number) {
  const cycle = (seconds + phase) % 31;
  if (cycle > 8.3) return;
  const rightward = phase === 0;
  const progress = cycle / 8.3;
  const width = rightward ? 80 : 68;
  const x = rightward ? -width + progress * (W + 2*width) : W + width - progress * (W + 2*width);
  const y = rightward ? roadTop + 91 : roadTop + 168;
  const height = rightward ? 33 : 29;
  ctx.globalAlpha = 0.20;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(x,y);ctx.lineTo(x,y-height*0.48);
  ctx.lineTo(x+width*0.23,y-height);ctx.lineTo(x+width*0.73,y-height);
  ctx.lineTo(x+width,y-height*0.45);ctx.lineTo(x+width,y);
  ctx.closePath();ctx.stroke();
  ctx.globalAlpha = 0.075;
  ctx.fillRect(x + width * .24, y-height*.82, width*.48, height*.25);
  ctx.globalAlpha = 0.23;
  for (const dx of [width*.19,width*.8]) {
    ctx.beginPath();ctx.arc(x+dx,y,5,0,TAU);ctx.stroke();
  }
}
function drawPulse(ctx: CanvasRenderingContext2D, wire: number, position: number,
  direction: 1 | -1, opacity: number) {
  if (position < 0 || position > 1) return;
  const tail = clamp(position - direction * 0.06,0,1);
  const points:Point[]=[];
  for(let i=0;i<=10;i++)points.push(wireAt(wire,tail+(position-tail)*i/10));
  ctx.globalAlpha=opacity*.55;
  ctx.lineWidth=2.2;
  polyline(ctx,points);
  const p=wireAt(wire,position);
  ctx.globalAlpha=opacity;
  ctx.beginPath();ctx.arc(p.x,p.y,2.7,0,TAU);ctx.fill();
  ctx.globalAlpha=opacity*.18;
  ctx.beginPath();ctx.arc(p.x,p.y,5.2,0,TAU);ctx.fill();
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
  drawCar(ctx,seconds,14);
  for(let wire=0;wire<3;wire++)
    drawPulse(ctx,wire,(seconds*(.038+wire*.012)+wire*.27)%1.17-.085,1,.25);
  for(const pulse of pulses){
    const age=seconds*1000-pulse.start;
    if(age<0||age>4300)continue;
    const position=pulse.position+pulse.direction*age/4300*1.2;
    drawPulse(ctx,pulse.wire,position,pulse.direction,.85*Math.min(1,(4300-age)/550));
  }
  ctx.restore();
}
export function launchPowerLinesPulse(x:number,y:number,start:number,pulses:PowerPulse[]):void {
  let bestWire=0,bestPosition=0,bestDist=Infinity;
  for(let wire=0;wire<3;wire++){
    for(let i=0;i<=180;i++){
      const position=i/180,p=wireAt(wire,position);
      const d=(p.x-x)**2+(p.y-y)**2;
      if(d<bestDist){bestDist=d;bestWire=wire;bestPosition=position;}
    }
  }
  pulses.push({wire:bestWire,position:bestPosition,direction:1,start},
    {wire:bestWire,position:bestPosition,direction:-1,start});
  if(pulses.length>18)pulses.splice(0,pulses.length-18);
}
