import type { AtlasLayer, AtlasShape } from './atlas-model.ts';
import { neuralSpecs } from './nervous-structures.ts';

type Direction = 'anterior' | 'posterior';
type Side = 'left' | 'right';

export const nervousLayers: readonly AtlasLayer[] = (['anterior', 'posterior'] as const)
  .map(direction => ({
    id: 'nervous.network.' + direction,
    viewId: 'nervous.whole-body.' + direction,
    name: 'Major neural pathways · ' + direction,
    order: 0,
  }));

// Original teaching schematic: the courses show broad anatomical territories,
// not exact fascicle trajectories, skull penetrations, or nerve-root levels.
function draw(direction: Direction): AtlasShape[] {
  const shapes: AtlasShape[] = [];
  const layerId = 'nervous.network.' + direction;
  // x<160 denotes the reader's left. Mirror for anatomical left from front.
  const mirrored = (side: Side) => direction === 'anterior' ? side === 'left' : side === 'right';
  function path(id: string, d: string, side?: Side, mode: AtlasShape['renderMode'] = 'stroke') {
    shapes.push({
      id: 'nervous.' + direction + '.' + (side ? side + '.' : '') + id + '.' + shapes.length,
      layerId,
      structureId: 'nervous.' + (side ? side + '.' : '') + id,
      mirrorX: side ? mirrored(side) : false,
      renderMode: mode,
      geometry: { kind: 'path', d },
    });
  }
  function ellipse(id: string, cx: number, cy: number, rx: number, ry: number, side?: Side) {
    shapes.push({
      id: 'nervous.' + direction + '.' + (side ? side + '.' : '') + id + '.' + shapes.length,
      layerId,
      structureId: 'nervous.' + (side ? side + '.' : '') + id,
      mirrorX: side ? mirrored(side) : false,
      renderMode: 'filled',
      geometry: { kind: 'ellipse', cx, cy, rx, ry },
    });
  }
  function bilateral(id: string, d: string, mode: AtlasShape['renderMode'] = 'stroke') {
    for (const side of ['left', 'right'] as const) path(id, d, side, mode);
  }
  // Cerebral hemispheres, with shallow stylized sulci as *nonselectable*
  // anatomical texture, not separate fictional structures.
  bilateral('cerebral-hemisphere',
    'M157 28 C146 18 132 27 128 41 Q123 62 136 76 L158 80 L158 32 Z', 'filled');
  if (direction === 'posterior') {
    bilateral('cerebellar-hemisphere',
      'M158 76 Q147 70 135 80 Q129 88 139 96 Q151 104 158 93 Z', 'filled');
  }
  path('midbrain', 'M156 83 Q160 80 164 83 L164 92 L156 92 Z', undefined, 'filled');
  path('pons', 'M152 92 Q160 88 168 92 L168 102 Q160 107 152 102 Z', undefined, 'filled');
  path('medulla', 'M157 104 Q160 101 163 104 L164 115 L160 121 L156 115 Z', undefined, 'filled');

  // Cord ends around the upper lumbar vertebrae; below it descend roots,
  // never an unbroken spinal cord drawn to the sacrum.
  path('cervical-cord', 'M157 119 Q160 116 163 119 L163 152 L157 152 Z', undefined, 'filled');
  path('thoracic-cord', 'M157 153 L163 153 L164 231 L156 231 Z', undefined, 'filled');
  path('lumbosacral-cord', 'M156 231 L164 231 L163 250 Q160 259 157 250 Z', undefined, 'filled');
  path('cauda-equina', 'M158 251 Q160 270 153 299 M160 251 L160 313 M162 252 Q164 280 169 305', undefined, 'stroke');

  if (direction === 'anterior') {
    bilateral('optic-nerve', 'M151 65 Q146 61 142 64 L137 68');
    bilateral('trigeminal-nerve',
      'M155 84 Q143 79 132 78 M140 80 L128 69 M140 80 L130 89 M140 81 L137 99');
    bilateral('facial-nerve',
      'M151 95 Q141 95 132 92 M139 94 L128 101 M139 94 L137 108');
    bilateral('vagus-nerve',
      'M157 105 Q144 114 145 133 Q149 157 146 184 Q140 210 143 232 L138 254');
  } else {
    bilateral('accessory-nerve',
      'M157 111 Q145 119 134 141 L114 156');
  }

  bilateral('cervical-plexus',
    'M157 128 Q146 125 138 134 L132 147 M141 133 L127 140 M137 139 L122 153');
  if (direction === 'anterior') {
    bilateral('phrenic-nerve',
      'M153 136 Q150 163 152 183 Q150 203 146 228');
  }
  bilateral('brachial-plexus',
    'M157 144 Q145 143 135 150 L120 157 M145 147 L125 167 M139 151 L116 176');
  bilateral('axillary-nerve',
    'M130 159 Q119 165 108 181 L98 194');

  if (direction === 'anterior') {
    bilateral('musculocutaneous-nerve',
      'M126 161 Q112 177 107 197 L94 229 L86 254');
    bilateral('median-nerve',
      'M122 166 L111 193 Q102 215 98 243 L88 271 Q82 294 75 316 L71 344');
    bilateral('ulnar-nerve',
      'M126 169 Q115 189 110 216 L99 247 Q99 271 92 293 L85 320 L81 343');
  } else {
    bilateral('radial-nerve',
      'M125 169 Q114 188 103 201 Q98 219 91 239 L79 267 L72 304 L66 326');
  }

  // Adjacent thoracic spinal nerves. One grouped structure per side in this
  // overview; their root identities require a magnified regional diagram.
  for (let n = 0; n < 10; n++) {
    const y = 156 + n * 8.1;
    const x = n < 6 ? 116 - n * 1.6 : 107 + (n - 6) * 3.4;
    bilateral('intercostal-nerves',
      'M157 ' + y + ' Q135 ' + (y - 9) + ' ' + x + ' ' + (y + 7), 'stroke');
  }
  bilateral('sympathetic-trunk',
    'M154 132 Q150 168 152 203 L153 261 Q153 288 147 326');
  // Ganglion swellings visually mark the sympathetic chain; they are not
  // separately numbered objects in this initial atlas.
  for (const side of ['left', 'right'] as const) {
    for (let y = 159; y <= 281; y += 20) ellipse('sympathetic-trunk', 152, y, 2.3, 3.1, side);
  }

  if (direction === 'anterior') {
    bilateral('lumbar-plexus',
      'M156 259 Q146 262 141 278 L136 300 M147 271 L127 308');
    bilateral('femoral-nerve',
      'M144 285 Q125 314 125 347 L124 390 L129 436');
    bilateral('obturator-nerve',
      'M146 296 Q143 316 146 342 L137 382');
    bilateral('saphenous-nerve',
      'M127 423 Q129 459 134 494 L130 546 Q129 575 132 607');
    bilateral('deep-fibular-nerve',
      'M129 486 Q127 530 125 565 L126 603 L131 641');
    bilateral('superficial-fibular-nerve',
      'M119 494 Q115 529 114 557 L111 595 Q106 617 110 636');
  } else {
    bilateral('sacral-plexus',
      'M156 282 Q144 294 135 316 M152 298 L127 332 M146 308 L120 339');
    bilateral('sciatic-nerve',
      'M133 323 Q124 349 125 376 L124 420 Q120 444 123 467');
    bilateral('tibial-nerve',
      'M123 464 Q128 485 127 513 L128 564 Q124 591 124 613 L120 633');
    bilateral('common-fibular-nerve',
      'M123 457 Q111 467 109 482 L109 504');
    bilateral('sural-nerve',
      'M111 511 Q109 541 113 564 L112 598 Q109 619 104 629');
  }
  return shapes;
}

export const nervousShapes: readonly AtlasShape[] = [
  ...draw('anterior'), ...draw('posterior'),
];

// Verify every claimed visible nerve has its own geometry in its matching
// surface. No catalog entries which cannot be selected from their view.
for (const surface of ['front', 'back'] as const) {
  const layer = 'nervous.network.' + (surface === 'front' ? 'anterior' : 'posterior');
  const mapped = new Set(nervousShapes.filter(item => item.layerId === layer).map(item => item.structureId));
  for (const spec of neuralSpecs.filter(item => item.surfaces.includes(surface))) {
    for (const side of spec.paired ? ['left', 'right'] as const : [null]) {
      const id = 'nervous.' + (side ? side + '.' : '') + spec.id;
      if (!mapped.has(id)) throw new Error('Missing ' + surface + ' nerve illustration: ' + id);
    }
  }
}
