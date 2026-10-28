import type { AtlasLayer, AtlasShape } from './atlas-model.ts';
import { skeletalStructures } from './skeletal-bones.ts';

type Facing = 'anterior' | 'posterior';
type Side = 'left' | 'right';

// Orthographic teaching projections in a 320 × 700 view. Every adult bone is
// separately mapped and individually selectable in either view. Deep skull
// bones / middle-ear ossicles are deliberately schematic projections, NOT
// surface-visible anatomy. Author medically reviewed regional plates next.
export const skeletalLayers: readonly AtlasLayer[] = (['anterior', 'posterior'] as const).map(facing => ({
  id: 'skeletal.bones.' + facing, viewId: 'skeletal.whole-body.' + facing,
  name: 'Individual bones · illustrative projection', order: 0,
}));

function draw(facing: Facing): AtlasShape[] {
  const shapes: AtlasShape[] = [];
  const layerId = 'skeletal.bones.' + facing;
  // Anatomical right appears on the viewer's left when facing anterior.
  const reflected = (side: Side) => facing === 'anterior' ? side === 'left' : side === 'right';
  function shape(id: string, geometry: AtlasShape['geometry'], side?: Side,
    mode: AtlasShape['renderMode'] = 'filled') {
    shapes.push({
      id: facing + '.' + id + '.' + shapes.length,
      layerId,
      structureId: 'skeletal.' + (side ? side + '.' : '') + id,
      geometry, renderMode: mode, mirrorX: side ? reflected(side) : false,
    });
  }
  function path(id: string, d: string, side?: Side, mode: AtlasShape['renderMode'] = 'filled') {
    shape(id, { kind: 'path', d }, side, mode);
  }
  function ellipse(id: string, x: number, y: number, rx: number, ry: number, side?: Side,
    mode: AtlasShape['renderMode'] = 'filled') {
    shape(id, { kind: 'ellipse', cx: x, cy: y, rx, ry }, side, mode);
  }
  function both(id: string, d: string, mode: AtlasShape['renderMode'] = 'filled') {
    for (const side of ['left', 'right'] as const) path(id, d, side, mode);
  }
  function eachSide(id: string, x: number, y: number, rx: number, ry: number) {
    for (const side of ['left', 'right'] as const) ellipse(id, x, y, rx, ry, side);
  }
  // Smooth, tapered long-bone silhouette with a rounded joint at each end.
  function shaft(id: string, x1: number, y1: number, x2: number, y2: number,
    width: number, side?: Side) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    const a = width / 2, b = width * 0.38;
    const d = 'M' + (x1 + px * a) + ' ' + (y1 + py * a)
      + ' Q' + (x1 - dx * .06 + px * a * 1.2) + ' ' + (y1 - dy * .06 + py * a * 1.2)
      + ' ' + (x1 - px * a) + ' ' + (y1 - py * a)
      + ' L' + (x2 - px * b) + ' ' + (y2 - py * b)
      + ' Q' + (x2 + dx * .045) + ' ' + (y2 + dy * .045)
      + ' ' + (x2 + px * b) + ' ' + (y2 + py * b) + ' Z';
    path(id, d, side);
  }

  // The neurocranium: distinguish the unpaired bones and each paired bone.
  path('frontal', 'M139 29 Q160 19 181 29 L179 51 Q169 55 160 56 Q151 55 141 51 Z');
  path('occipital', facing === 'posterior'
    ? 'M135 50 Q160 57 185 50 L180 76 Q160 91 140 76 Z'
    : 'M155 78 Q160 82 165 78 L160 87 Z');
  path('sphenoid', 'M146 61 Q160 57 174 61 L170 70 L150 70 Z');
  path('ethmoid', 'M156 66 L164 66 L163 79 L160 82 L157 79 Z');
  both('parietal', 'M139 25 Q127 38 131 54 L145 59 L156 50 L157 25 Z');
  both('temporal', 'M132 57 L146 60 L149 79 L138 82 L128 69 Z');

  // Facial bones; tiny/deep elements are intentionally shown as close-up
  // projections within the head, not claimed to be externally exposed.
  path('mandible', 'M138 85 Q150 99 160 104 Q170 99 182 85 L178 100 Q160 118 142 100 Z');
  path('vomer', 'M158 81 L162 81 L160 91 Z');
  both('maxilla', 'M144 77 L158 79 L159 94 L148 94 L142 85 Z');
  both('zygomatic', 'M129 69 L144 73 L146 83 L138 87 L130 80 Z');
  both('nasal', 'M155 60 L159 61 L159 73 L154 72 Z');
  both('lacrimal', 'M148 64 L153 67 L151 72 L147 70 Z');
  both('palatine', 'M150 89 L157 90 L155 94 L148 94 Z');
  both('inferior-nasal-concha', 'M150 75 Q155 73 156 79 L152 83 Z');
  for (const side of ['left', 'right'] as const) {
    ellipse('malleus', 132, 72, 1.4, 2.2, side);
    ellipse('incus', 129.4, 75, 1.4, 1.8, side);
    ellipse('stapes', 127.5, 77.5, 1, 1.2, side);
  }
  path('hyoid', 'M150 116 Q160 112 170 116 L166 121 L154 121 Z');

  // Seven cervical, twelve thoracic, five lumbar vertebrae. Each is a
  // distinct selectable adult vertebra, not one combined spine region.
  for (const [letter, count, top, step, radius] of [
    ['c', 7, 123, 4.2, 5], ['t', 12, 153, 6.7, 6.2], ['l', 5, 242, 9.5, 7.6],
  ] as const) {
    for (let n = 1; n <= count; n++) {
      const y = top + (n - 1) * step;
      const id = letter + n;
      path(id, 'M' + (160 - radius) + ' ' + y
        + ' Q160 ' + (y - 3.2) + ' ' + (160 + radius) + ' ' + y
        + ' L' + (160 + radius + 1.2) + ' ' + (y + 4)
        + ' Q160 ' + (y + 7.8) + ' ' + (160 - radius - 1.2) + ' ' + (y + 4) + ' Z');
    }
  }
  path('sacrum', 'M150 292 Q160 285 170 292 L167 319 L160 331 L153 319 Z');
  path('coccyx', 'M157 333 L163 333 L161 344 L159 344 Z');
  path('sternum', 'M156 141 Q160 137 164 141 L165 152 L166 187 L160 204 L154 187 L155 152 Z');

  // Each of the twelve rib pairs has its own path and ID. First ribs short,
  // lower ribs taper inward; the last two remain floating.
  for (let n = 1; n <= 12; n++) {
    const y = 151 + (n - 1) * 7.7;
    const span = n <= 7 ? 33 + n * 3 : 58 - (n - 7) * 5;
    const x = 155 - span;
    const d = 'M155 ' + y + ' C139 ' + (y - 8) + ' ' + (x + 8) + ' ' + (y - 10)
      + ' ' + x + ' ' + (y + 9) + ' Q' + (x - 2) + ' ' + (y + 15)
      + ' ' + (x + 11) + ' ' + (y + 19);
    for (const side of ['left', 'right'] as const) path('rib-' + n, d, side, 'stroke');
  }

  // Shoulder girdle and pelvis. Each hip bone is counted once in the adult.
  both('clavicle', 'M155 140 Q135 135 121 138 Q111 138 103 150 L107 154 Q120 144 136 147 Q147 143 155 147 Z');
  both('scapula', 'M110 149 Q120 142 134 153 L143 174 L134 206 Q116 193 111 171 Z');
  both('hip-bone', 'M150 284 Q130 272 118 280 Q106 288 103 310 Q100 324 111 331 Q122 340 140 319 L157 310 L153 296 Z');
  // A small negative-space highlight demonstrates the obturator foramen but
  // belongs to the corresponding hip bone, not a fictional 207th structure.
  both('hip-bone', 'M114 311 Q123 303 138 311 L134 327 Q122 335 115 326 Z', 'cutout');

  // Arm shafts and the individual wrist/hand bones are proportioned to the
  // arm's total length; no enormous phalanges. Digit I has no middle phalanx.
  for (const side of ['left', 'right'] as const) {
    shaft('humerus', 107, 155, 92, 241, 10, side);
    shaft('ulna', 89, 250, 72, 319, 6, side);
    shaft('radius', 99, 250, 84, 319, 5.6, side);
    const wrist = [
      ['scaphoid', 78, 326], ['lunate', 73, 326], ['triquetrum', 68, 327],
      ['pisiform', 65, 331], ['trapezium', 83, 333], ['trapezoid', 78, 333],
      ['capitate', 73, 334], ['hamate', 68, 335],
    ] as const;
    for (const [id, x, y] of wrist) ellipse(id, x, y, 2.4, 3, side);
    for (let digit = 1; digit <= 5; digit++) {
      // Anatomical digit I (thumb) is the radial/lateral digit.
      const x = digit === 1 ? 86 : 78 - (digit - 2) * 5.5;
      const baseY = digit === 1 ? 339 : 341;
      const lateral = digit === 1 ? 7 : -(.4 * (digit - 2));
      shaft('metacarpal-' + digit, x, baseY, x + lateral, baseY + (digit === 1 ? 8 : 11), 2.3, side);
      const firstX = x + lateral, firstY = baseY + (digit === 1 ? 10 : 14);
      shaft('hand-proximal-' + digit, firstX, firstY, firstX + (digit === 1 ? 4 : -1),
        firstY + (digit === 1 ? 6 : 7), 1.7, side);
      if (digit !== 1) {
        shaft('hand-middle-' + digit, firstX - 1, firstY + 9, firstX - 1.5, firstY + 15, 1.5, side);
        shaft('hand-distal-' + digit, firstX - 1.5, firstY + 17, firstX - 2, firstY + 21, 1.3, side);
      } else {
        shaft('hand-distal-' + digit, firstX + 5, firstY + 8, firstX + 7, firstY + 13, 1.5, side);
      }
    }
  }

  for (const side of ['left', 'right'] as const) {
    shaft('femur', 141, 335, 130, 456, 14, side);
    ellipse('patella', 128, 465, 7, 9, side);
    shaft('tibia', 128, 480, 124, 597, 10.5, side);
    shaft('fibula', 113, 483, 109, 601, 5, side);

    // Talus/calcaneus lie behind other tarsals in this 2D projection.
    const ankle = [
      ['talus', 126, 608, 5, 6], ['calcaneus', 112, 616, 7, 7],
      ['navicular', 124, 619, 4, 4], ['cuboid', 106, 625, 4.5, 5],
      ['medial-cuneiform', 130, 625, 3.5, 4],
      ['intermediate-cuneiform', 124, 627, 3.2, 4],
      ['lateral-cuneiform', 118, 627, 3.2, 4],
    ] as const;
    for (const [id, x, y, rx, ry] of ankle) ellipse(id, x, y, rx, ry, side);
    for (let digit = 1; digit <= 5; digit++) {
      const x = 133 - (digit - 1) * 6.1;
      shaft('metatarsal-' + digit, x, 634, x - (digit - 1), 645, 2.6, side);
      const phX = x - (digit - 1);
      shaft('foot-proximal-' + digit, phX, 648, phX - .6, 654, 2, side);
      if (digit !== 1) {
        shaft('foot-middle-' + digit, phX - .6, 656, phX - .8, 659.2, 1.7, side);
        shaft('foot-distal-' + digit, phX - .8, 661, phX - 1, 665, 1.5, side);
      } else {
        shaft('foot-distal-' + digit, phX - .6, 656, phX - .8, 665, 2, side);
      }
    }
  }
  return shapes;
}

export const skeletalShapes: readonly AtlasShape[] = [
  ...draw('anterior'),
  ...draw('posterior'),
];

// A geometry completeness guard. Every one of the 206 records has its own
// selectable shape in *both* views; no shared group hitboxes.
for (const view of ['anterior', 'posterior'] as const) {
  const mapped = new Set(skeletalShapes.filter(shape => shape.layerId.endsWith(view) &&
    shape.renderMode !== 'etch' && shape.renderMode !== 'cutout').map(shape => shape.structureId));
  const missing = skeletalStructures.filter(bone => !mapped.has(bone.id));
  if (mapped.size !== 206 || missing.length) {
    throw new Error('Skeletal ' + view + ' diagram is missing individual bones: '
      + missing.map(bone => bone.name).join(', '));
  }
}
