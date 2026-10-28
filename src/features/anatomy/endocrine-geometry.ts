import type { AtlasLayer, AtlasShape } from './atlas-model.ts';
import { endocrineSpecs } from './endocrine-structures.ts';

type Direction = 'anterior' | 'posterior';
type Side = 'left' | 'right';

// All coordinates share the other anatomy packs' 320 × 700 body frame.
// The diagram is an organ-location teaching projection. Deep and microscopic
// tissues are enlarged for selection and are never claimed surface-visible.
export const endocrineLayers: readonly AtlasLayer[] = (['anterior', 'posterior'] as const)
  .map(direction => ({
    id: 'endocrine.glands.' + direction,
    viewId: 'endocrine.whole-body.' + direction,
    name: 'Endocrine glands · ' + direction,
    order: 0,
  }));

function draw(direction: Direction): AtlasShape[] {
  const layerId = 'endocrine.glands.' + direction;
  const shapes: AtlasShape[] = [];
  const mirrored = (side: Side) => direction === 'anterior' ? side === 'left' : side === 'right';
  function shape(id: string, geometry: AtlasShape['geometry'], side?: Side,
    renderMode: AtlasShape['renderMode'] = 'filled') {
    shapes.push({
      id: 'endocrine.' + direction + '.' + (side ? side + '.' : '') + id + '.' + shapes.length,
      structureId: 'endocrine.' + (side ? side + '.' : '') + id,
      layerId, geometry, renderMode,
      mirrorX: side ? mirrored(side) : false,
    });
  }
  function path(id: string, d: string, side?: Side, mode: AtlasShape['renderMode'] = 'filled') {
    shape(id, { kind: 'path', d }, side, mode);
  }
  function oval(id: string, cx: number, cy: number, rx: number, ry: number,
    side?: Side, mode: AtlasShape['renderMode'] = 'filled') {
    shape(id, { kind: 'ellipse', cx, cy, rx, ry }, side, mode);
  }
  function pair(id: string, d: string, mode: AtlasShape['renderMode'] = 'filled') {
    for (const side of ['left', 'right'] as const) path(id, d, side, mode);
  }

  // The brain region uses a transparent cutaway, NOT a surface projection.
  path('hypothalamus',
    'M150 69 Q154 65 160 65 Q166 65 170 69 L166 76 L160 79 L154 76 Z');
  if (direction === 'anterior') {
    path('pituitary-stalk', 'M157 79 L163 79 L163 86 L157 86 Z');
    path('anterior-pituitary',
      'M149 90 Q151 85 158 85 L160 88 L160 99 Q152 100 149 96 Z');
  }
  path('posterior-pituitary',
    'M161 87 Q171 84 172 92 Q171 100 161 99 Z');
  if (direction === 'posterior') {
    path('pineal-gland',
      'M157 57 Q160 49 163 57 L162 65 Q160 68 158 65 Z');
  }

  // Thyroid anterior to trachea; the posterior view displays it as a
  // transparently exposed landmark, enabling the four parathyroids to be
  // individually selected on the back of its lobes.
  path('thyroid-gland',
    'M145 119 Q137 124 141 135 Q144 143 153 140 L156 134 '
    + 'Q160 130 164 134 L167 140 Q176 143 179 135 '
    + 'Q183 124 175 119 L166 120 Q160 125 154 120 Z');
  if (direction === 'posterior') {
    pair('parathyroid-superior',
      'M148 123 Q151 121 154 124 L154 129 Q151 131 148 128 Z');
    pair('parathyroid-inferior',
      'M149 134 Q152 132 155 135 L155 141 Q152 143 149 139 Z');
  }

  // Thymus occupies the anterior superior mediastinum. Small in most adults
  // owing to physiological involution; the diagram intentionally exaggerates
  // its footprint to remain useful as a selection target.
  if (direction === 'anterior') {
    path('thymus',
      'M160 151 Q151 147 149 157 Q142 158 144 169 '
      + 'L151 185 Q156 192 160 190 Q164 192 169 185 '
      + 'L176 169 Q178 158 171 157 Q169 147 160 151 Z');
  }

  // Retroperitoneal adrenal glands sit superior to the kidneys. The right
  // gland is pyramidal, left more crescent-like. Each cortex encloses its
  // medulla; outlines are only broad educational projections.
  pair('adrenal-cortex',
    'M121 250 Q123 240 128 241 L140 254 Q141 261 134 265 '
    + 'L125 263 Q119 260 121 250 Z');
  pair('adrenal-medulla',
    'M128 252 Q131 248 134 253 Q135 257 130 260 Q126 258 128 252 Z');
  // Kidney contours clarify adrenal position, but kidneys aren't counted
  // as adrenal glands and the guide remains nonselectable.
  pair('adrenal-cortex',
    'M133 267 Q119 267 119 284 Q119 298 133 301 '
    + 'Q142 300 143 285 Q138 275 133 267', 'etch');

  // The pancreas has both exocrine and endocrine tissue. Outline the organ
  // as a guide; several dots illustrate the *distribution* of pancreatic
  // islets, not the literal size or count of islets.
  path('pancreatic-islets',
    'M130 281 Q142 273 155 278 Q170 282 183 273 '
    + 'Q191 271 197 276 Q192 286 178 290 '
    + 'Q158 296 143 289 Q135 288 130 281', undefined, 'etch');
  for (const [x, y, rx, ry] of [
    [141, 281, 2.4, 2.2], [152, 283, 2.1, 2.3],
    [164, 286, 2.5, 2.3], [176, 283, 2, 2.1], [187, 279, 2.2, 2.2],
  ] as const) oval('pancreatic-islets', x, y, rx, ry);

  // Gonadal configurations are *mutually exclusive* in the UI.
  // Ovaries are internal pelvic organs; testes project below the pelvis.
  pair('ovary',
    'M134 336 Q137 331 144 332 Q150 334 150 341 '
    + 'Q146 346 139 345 Q133 344 134 336 Z');
  pair('testis',
    'M143 366 Q149 363 153 369 Q157 377 151 388 '
    + 'Q144 392 141 383 Q139 373 143 366 Z');

  return shapes;
}

export const endocrineShapes: readonly AtlasShape[] = [
  ...draw('anterior'), ...draw('posterior'),
];

// Every declared endocrine structure must have interactive geometry in each
// explicitly supported view. Decorative outlines are excluded from the check.
for (const direction of ['anterior', 'posterior'] as const) {
  const layer = 'endocrine.glands.' + direction;
  const surface = direction === 'anterior' ? 'front' : 'back';
  const mapped = new Set(endocrineShapes.filter(item => item.layerId === layer
    && item.renderMode !== 'etch' && item.renderMode !== 'cutout')
    .map(item => item.structureId));
  for (const spec of endocrineSpecs.filter(item => item.surfaces.includes(surface))) {
    for (const side of spec.paired ? ['left', 'right'] as const : [null]) {
      const id = 'endocrine.' + (side ? side + '.' : '') + spec.id;
      if (!mapped.has(id)) throw new Error('Missing endocrine ' + surface + ' shape: ' + id);
    }
  }
}
