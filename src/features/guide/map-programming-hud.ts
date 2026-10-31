import { MAP_CANVAS_HEIGHT as H, MAP_CANVAS_WIDTH as W } from './map-presentation.ts';

type Point = { x: number; y: number };
const TAU=Math.PI*2;
const hash=(n:number)=>{const v=Math.sin(n*117.13+51.7)*43758.54;return v-Math.floor(v);};
const hex=(n:number)=>Math.floor(hash(n)*0xffff).toString(16).toUpperCase().padStart(4,'0');
const nodes:Point[]=Array.from({length:36},(_,i)=>({
  x:135+(i%6)*68+(i%2)*11,
  y:H*0.58+Math.floor(i/6)*53,
}));
const font='11px ui-monospace, SFMono-Regular, Consolas, monospace';
function segment(ctx:CanvasRenderingContext2D,a:Point,b:Point) {
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
}

/** Circuit paths, memory views and vector HUDs complement the terminal text. */
export function drawProgrammingHudBase(ctx:CanvasRenderingContext2D):void {
  ctx.save();ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=1;ctx.font=font;
  // CPU / memory-bank windows in three places with real grid structure.
  for(let k=0;k<3;k++){
    const x=k===0?W*0.1:k===1?W*0.56:W*0.68;
    const y=k===0?H*0.15:k===1?H*0.12:H*0.68;
    const columns=k===2?5:7,rows=k===2?6:4,cell=20;
    ctx.globalAlpha=0.14;
    ctx.strokeRect(x-13,y-21,columns*cell+26,rows*cell+54);
    ctx.globalAlpha=0.09;
    ctx.fillRect(x-13,y-21,columns*cell+26,16);
    ctx.globalAlpha=0.22;
    ctx.fillText(k===0?'HEAP 0x0000':k===1?'PACKET 0xBEEF':'MEMORY DUMP',x-5,y-9);
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const idx=k*311+row*columns+col;
      ctx.globalAlpha=0.095;
      ctx.strokeRect(x+col*cell,y+row*cell,cell-2,cell-2);
      if(hash(idx)>.64){ctx.globalAlpha=0.14;ctx.fillRect(x+col*cell+3,y+row*cell+3,cell-8,cell-8);}
      ctx.globalAlpha=0.23;
      ctx.fillText(Math.floor(hash(idx+31)*16).toString(16).toUpperCase(),
        x+col*cell+6,y+row*cell+13);
    }
    ctx.globalAlpha=0.19;
    ctx.fillText('0x'+hex(k+98)+' : '+hex(k+38)+' '+hex(k+53),x,y+rows*cell+16);
  }
  // Topology / buses: node-to-node visual rather than a stack of text columns.
  ctx.globalAlpha=0.11;
  ctx.lineWidth=1.2;
  for(let i=0;i<nodes.length;i++){
    const p=nodes[i];
    if(i%6!==5)segment(ctx,p,nodes[i+1]);
    if(i<30&&i%3!==1)segment(ctx,p,nodes[i+6]);
  }
  for(let i=0;i<nodes.length;i++){
    const p=nodes[i];
    ctx.globalAlpha=0.16;
    ctx.beginPath();ctx.arc(p.x,p.y,4,0,TAU);ctx.stroke();
    if(i%7===0){ctx.globalAlpha=.09;ctx.strokeRect(p.x-12,p.y-12,24,24);}
  }
  // Persistent hexadecimal address lanes and binary stripes.
  ctx.font='12px ui-monospace, SFMono-Regular, Consolas, monospace';
  for(let i=0;i<16;i++){
    const y=H*0.08+i*32;
    const x=W*0.38+((i%2)*22);
    ctx.globalAlpha=.09;
    ctx.fillText('0x'+hex(i+43),x,y);
    ctx.globalAlpha=.1;
    ctx.fillText(Array.from({length:8},(_,j)=>hash(i*23+j)>.5?'1':'0').join(''),x+68,y);
  }
  // Oscilloscope trace and scan marks.
  const left=W*0.06,right=W*0.32,base=H*0.87;
  ctx.globalAlpha=.11;
  ctx.strokeRect(left,base-36,right-left,79);
  ctx.beginPath();
  for(let i=0;i<95;i++){
    const x=left+(right-left)*i/94;
    const y=base-6+Math.sin(i*.24)*13+Math.sin(i*.9)*5;
    if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
  }
  ctx.globalAlpha=.26;ctx.stroke();
  ctx.restore();
}

export function drawProgrammingHudMotion(ctx:CanvasRenderingContext2D,seconds:number):void{
  ctx.save();ctx.strokeStyle=ctx.strokeStyle;ctx.fillStyle=ctx.strokeStyle;
  ctx.font='12px ui-monospace, SFMono-Regular, Consolas, monospace';
  ctx.lineWidth=1.3;
  // CPU activity indicators pulse inside boxes, not just changing letters.
  for(let k=0;k<3;k++){
    const x=k===0?W*.1:k===1?W*.56:W*.68;
    const y=k===0?H*.15:k===1?H*.12:H*.68;
    const count=k===2?5:7,rows=k===2?6:4;
    const active=Math.floor(seconds*(2.8+k*.5)+k*11)%(count*rows);
    ctx.globalAlpha=.34;
    ctx.fillRect(x+(active%count)*20+3,y+Math.floor(active/count)*20+3,12,12);
    // Hex status counters and blinking packet labels.
    ctx.globalAlpha=.19;
    ctx.fillText('0x'+(Math.floor(seconds*37+k*101)%65536).toString(16).toUpperCase().padStart(4,'0'),
      x+4,y+rows*20+30);
  }
  // Animated routing packets travel along a real, fixed node graph.
  for(let k=0;k<9;k++){
    const index=(k*7)%nodes.length;
    const next=index%6!==5?index+1:Math.max(0,index-6);
    const t=(seconds*(.34+hash(k+31)*.6)+hash(k+22))%1;
    const a=nodes[index],b=nodes[next];
    const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
    ctx.globalAlpha=.32;
    ctx.beginPath();ctx.arc(x,y,2.6,0,TAU);ctx.fill();
  }
  // Moving binary register (not an opaque 'Matrix' backdrop).
  for(let i=0;i<11;i++){
    const x=W*.37+(i%3)*62,y=H*.56+(i*39)%290;
    const value=(Math.floor(seconds*4)+i*29)>>>0;
    ctx.globalAlpha=.11+hash(i+72)*.1;
    ctx.fillText((value%256).toString(2).padStart(8,'0'),x,y);
  }
  // Radial scan HUD at right middle; its sweep rotates without changing brightness.
  const x=W*.84,y=H*.47,r=52;
  ctx.globalAlpha=.11;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();
  ctx.beginPath();ctx.arc(x,y,r*.68,0,TAU);ctx.stroke();
  for(let i=0;i<12;i++){
    const a=i*TAU/12;
    ctx.globalAlpha=.09;
    segment(ctx,{x:x+Math.cos(a)*r*.87,y:y+Math.sin(a)*r*.87},
      {x:x+Math.cos(a)*r,y:y+Math.sin(a)*r});
  }
  const angle=seconds*.72;
  ctx.globalAlpha=.28;
  segment(ctx,{x,y},{x:x+Math.cos(angle)*r,y:y+Math.sin(angle)*r});
  ctx.beginPath();ctx.arc(x,y,3,0,TAU);ctx.fill();
  ctx.restore();
}
