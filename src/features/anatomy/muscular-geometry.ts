import type { AtlasLayer, AtlasShape } from './atlas-model.ts';
import { muscleSpecs } from './muscular-structures.ts';

type Surface = 'anterior' | 'posterior';
type Side = 'left' | 'right';

export const muscularLayers: readonly AtlasLayer[] = (['anterior', 'posterior'] as const)
  .map(direction => ({
    id: 'muscular.surface.' + direction,
    viewId: 'muscular.whole-body.' + direction,
    name: 'Superficial muscles · ' + direction,
    order: 0,
  }));

// Hand-authored superficial muscle *regions* (not medical plates). Anatomical
// right appears on the reader's left in anterior views. Every polygon is an
// individual structure with the same stable ID regardless of orientation.
function draw(direction: Surface): AtlasShape[] {
  const shapes: AtlasShape[] = [];
  const leftIsMirrored = direction === 'anterior';
  const layerId = 'muscular.surface.' + direction;
  function path(id: string, d: string, side?: Side, mode: AtlasShape['renderMode'] = 'filled') {
    shapes.push({
      id: 'muscular.' + direction + '.' + (side ? side + '.' : '') + id + '.' + shapes.length,
      layerId, structureId: 'muscular.' + (side ? side + '.' : '') + id,
      mirrorX: side ? (side === 'left' ? leftIsMirrored : !leftIsMirrored) : false,
      renderMode: mode, geometry: { kind: 'path', d },
    });
  }
  function ellipse(id: string, cx: number, cy: number, rx: number, ry: number, side: Side) {
    shapes.push({
      id: 'muscular.' + direction + '.' + side + '.' + id + '.' + shapes.length,
      layerId, structureId: 'muscular.' + side + '.' + id,
      mirrorX: side === 'left' ? leftIsMirrored : !leftIsMirrored,
      geometry: { kind: 'ellipse', cx, cy, rx, ry },
    });
  }
  function pair(id: string, d: string) {
    path(id, d, 'left');
    path(id, d, 'right');
  }
  function ovals(id: string, x: number, y: number, rx: number, ry: number) {
    ellipse(id, x, y, rx, ry, 'left');
    ellipse(id, x, y, rx, ry, 'right');
  }
  // Narrow fusiform muscle belly with tapered tendinous ends.
  function fusiform(id: string, x1: number, y1: number, x2: number, y2: number,
    belly: number, side: Side) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
    const w = belly / 2;
    const d = 'M' + x1 + ' ' + y1
      + ' Q' + (midX + px * w * 1.45) + ' ' + (midY + py * w * 1.45)
      + ' ' + x2 + ' ' + y2
      + ' Q' + (midX - px * w * 1.45) + ' ' + (midY - py * w * 1.45)
      + ' ' + x1 + ' ' + y1 + ' Z';
    path(id, d, side);
  }
  function muscle(id: string, x1: number, y1: number, x2: number, y2: number, belly: number) {
    fusiform(id, x1, y1, x2, y2, belly, 'left');
    fusiform(id, x1, y1, x2, y2, belly, 'right');
  }

  if (direction === 'anterior') {
    pair('frontal-belly', 'M136 28 Q141 23 157 27 L155 51 Q147 54 140 49 Z');
    pair('temporalis', 'M132 44 Q135 47 137 58 L130 68 Q126 58 128 50 Z');
    ovals('orbicularis-oculi', 146, 65, 7.8, 4);
    pair('masseter', 'M129 76 L139 74 L145 90 L136 97 Q130 90 129 76 Z');
    pair('zygomaticus-major', 'M138 77 Q148 79 155 89 L152 92 Q145 84 135 83 Z');
    path('orbicularis-oris', 'M148 93 Q160 88 172 93 Q166 104 160 103 Q154 104 148 93 Z');
    pair('sternocleidomastoid', 'M139 95 L144 96 L158 133 L153 137 L141 116 Z');
    pair('trapezius', 'M149 115 Q133 132 119 137 L107 152 L128 149 Q148 144 157 135 L155 123 Z');
    pair('deltoid', 'M112 142 Q98 145 92 167 Q89 182 98 202 Q105 188 117 163 L125 148 Z');
    pair('pectoralis-major', 'M155 149 Q135 143 122 151 Q117 159 112 179 Q125 197 148 205 L155 184 Z');
    pair('serratus-anterior', 'M116 185 L126 193 L119 201 L130 207 L118 215 L128 223 L112 235 L106 224 Z');
    pair('rectus-abdominis', 'M151 206 L157 211 L156 280 L149 290 L143 273 L144 213 Z');

    pair('external-oblique', 'M116 218 Q128 221 141 225 L143 272 L152 296 Q130 288 111 270 L109 237 Z');
    muscle('biceps-brachii', 101, 183, 90, 232, 16);
    muscle('brachialis', 95, 218, 89, 251, 8);
    muscle('brachioradialis', 90, 245, 73, 310, 9);
    muscle('pronator-teres', 94, 250, 79, 280, 8);
    muscle('flexor-carpi-radialis', 84, 265, 76, 320, 7);
    muscle('flexor-carpi-ulnaris', 99, 260, 85, 319, 8);
    pair('tensor-fasciae-latae', 'M117 311 L129 321 L123 362 L111 361 L108 336 Z');
    pair('sartorius', 'M120 322 Q139 349 143 383 Q137 417 129 453 L124 450 Q134 388 116 329 Z');
    pair('adductor-longus', 'M149 337 Q143 356 134 393 L129 402 L129 378 L139 340 Z');
    pair('gracilis', 'M149 343 L146 380 L138 450 L134 453 L139 375 Z');
    pair('rectus-femoris', 'M128 348 Q143 354 139 385 L133 449 L127 453 L123 391 Z');
    pair('vastus-lateralis', 'M118 353 Q111 369 113 405 L121 452 L129 458 L126 416 L123 370 Z');
    pair('vastus-medialis', 'M139 392 Q150 420 141 446 L133 455 L131 441 Z');
    muscle('tibialis-anterior', 130, 483, 125, 601, 13);
    muscle('extensor-digitorum-longus', 116, 487, 117, 600, 9);
    muscle('fibularis-longus', 108, 486, 109, 586, 9);
  } else {
    pair('occipital-belly', 'M136 58 Q145 66 156 66 L156 84 Q145 80 134 74 Z');
    pair('splenius-capitis', 'M138 98 L147 104 L159 130 L155 135 L141 119 Z');
    pair('trapezius', 'M156 116 L157 129 L129 158 L158 233 L145 227 L113 163 L103 151 Z');
    pair('deltoid', 'M114 143 Q99 145 91 171 Q90 188 100 207 Q110 187 120 162 Z');
    pair('infraspinatus', 'M121 162 L146 172 L141 206 Q125 201 115 186 Z');
    pair('teres-major', 'M115 191 Q130 198 149 202 L148 213 Q128 211 114 203 Z');
    pair('latissimus-dorsi', 'M144 207 Q129 217 108 231 L113 258 Q123 282 146 297 L155 281 L154 226 Z');
    pair('erector-spinae', 'M147 207 L154 205 L154 301 L146 302 Z');
    pair('external-oblique', 'M115 258 Q125 273 144 276 L151 304 Q130 298 116 281 Z');
    muscle('triceps-brachii', 102, 181, 92, 242, 18);
    muscle('brachioradialis', 88, 245, 72, 311, 9);
    muscle('extensor-carpi-radialis-longus', 94, 250, 75, 315, 7);
    muscle('extensor-digitorum', 88, 263, 80, 323, 9);
    muscle('extensor-carpi-ulnaris', 100, 263, 89, 318, 7);
    pair('gluteus-medius', 'M120 288 Q109 295 105 322 L112 337 Q128 326 136 313 L140 296 Z');
    pair('gluteus-maximus', 'M112 317 Q105 331 111 353 Q130 375 153 355 L157 327 Q133 310 112 317 Z');
    muscle('biceps-femoris', 119, 360, 123, 449, 21);
    muscle('semitendinosus', 138, 361, 132, 449, 12);
    muscle('semimembranosus', 145, 372, 138, 439, 10);
    pair('gastrocnemius', 'M129 478 Q116 477 113 511 Q113 541 125 554 Q140 544 138 510 Q137 486 129 478 Z');
    pair('soleus', 'M118 532 Q108 543 111 564 L118 587 L128 594 L129 546 Z');
    muscle('fibularis-longus', 108, 483, 106, 583, 8);
  }
  return shapes;
}

export const muscularShapes: readonly AtlasShape[] = [
  ...draw('anterior'), ...draw('posterior'),
];

// A muscle is only "implemented" when its expected surface has actual
// independently selectable geometry; catch omissions when new specs are added.
for (const surface of ['front', 'back'] as const) {
  const layer = 'muscular.surface.' + (surface === 'front' ? 'anterior' : 'posterior');
  const pictured = new Set(muscularShapes.filter(shape => shape.layerId === layer &&
    shape.renderMode !== 'etch' && shape.renderMode !== 'cutout').map(shape => shape.structureId));
  for (const muscle of muscleSpecs.filter(item => item.surfaces.includes(surface))) {
    for (const side of muscle.unpaired ? [null] : ['left', 'right'] as const) {
      const id = 'muscular.' + (side ? side + '.' : '') + muscle.id;
      if (!pictured.has(id)) throw new Error('Missing muscular illustration: ' + id + ' (' + surface + ')');
    }
  }
}
