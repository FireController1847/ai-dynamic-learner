import type { AtlasLayer, AtlasShape } from './atlas-model.ts';
import { cardiovascularSpecs } from './cardiovascular-structures.ts';

type Direction = 'anterior' | 'posterior';
type Side = 'left' | 'right';
export const cardiovascularLayers: readonly AtlasLayer[] = (['anterior', 'posterior'] as const)
  .map(direction => ({
    id: 'cardiovascular.vessels.' + direction,
    viewId: 'cardiovascular.whole-body.' + direction,
    name: 'Heart and major vessels · ' + direction,
    order: 0,
  }));

// Original adult whole-body teaching projection on the 320 × 700 shared
// atlas plane. Line paths are named arteries/veins; chamber polygons are
// an explanatory cardiac cutaway (not all four exposed on the surface).
// No capillary beds, microvessels, or exact coronary dominance are asserted.
function draw(direction: Direction): AtlasShape[] {
  const shapes: AtlasShape[] = [];
  const layerId = 'cardiovascular.vessels.' + direction;
  const mirror = (side: Side) => direction === 'anterior' ? side === 'left' : side === 'right';
  function path(id: string, d: string, side?: Side, mode: AtlasShape['renderMode'] = 'stroke') {
    shapes.push({
      id: 'cardiovascular.' + direction + '.' + (side ? side + '.' : '') + id + '.' + shapes.length,
      layerId, structureId: 'cardiovascular.' + (side ? side + '.' : '') + id,
      geometry: { kind: 'path', d }, renderMode: mode,
      // Anatomical left/right reverses on posterior projection, even for
      // unpaired structures with lateral positions (e.g. aorta, vena cava
      // and the named right/left heart chambers).
      mirrorX: side ? mirror(side) : direction === 'posterior',
    });
  }
  function pair(id: string, d: string) {
    for (const side of ['left', 'right'] as const) path(id, d, side);
  }
  function chamber(id: string, d: string) { path(id, d, undefined, 'filled'); }

  // Anatomical right appears viewer-left in anterior mode. The heart is
  // offset to the patient's left (viewer-right); its apex is inferior-left
  // anatomically, i.e. toward the viewer's right in this front cutaway.
  chamber('right-atrium',
    'M150 174 Q141 170 138 183 Q137 193 146 198 L158 191 L158 180 Z');
  chamber('right-ventricle',
    'M145 199 Q152 192 161 193 L166 211 L161 219 Q148 214 145 199 Z');
  chamber('left-atrium',
    'M161 177 Q175 170 183 181 L179 194 L168 195 L161 189 Z');
  chamber('left-ventricle',
    'M166 195 L180 193 Q187 207 181 220 L177 228 Q170 219 165 212 Z');

  // Aortic segments and superior branches. The arch curves toward
  // anatomical left; the first branch (brachiocephalic) goes right.
  path('ascending-aorta', 'M174 193 Q180 181 176 167 L171 157');
  path('aortic-arch', 'M171 157 Q166 144 177 143 Q191 144 186 165');
  path('abdominal-aorta', 'M172 229 L172 313 Q172 326 169 337');
  pair('common-carotid-artery', 'M152 157 Q150 136 147 109 L146 76');
  pair('subclavian-artery', 'M149 154 Q133 151 121 155 L111 162');
  pair('renal-artery', 'M171 271 Q152 272 131 282');
  pair('common-iliac-artery', 'M169 334 Q157 339 145 360');
  // The right/left external iliac artery runs beneath the inguinal ligament.
  if (direction === 'anterior') {
    path('brachiocephalic-trunk', 'M169 151 Q157 151 151 158');
    pair('internal-carotid-artery', 'M146 76 L147 43 Q147 36 154 33');
    pair('external-carotid-artery', 'M146 78 Q139 64 134 48 L132 41');
    pair('axillary-artery', 'M111 162 Q105 172 101 194');
    pair('brachial-artery', 'M101 194 Q96 220 91 250');
    pair('radial-artery', 'M91 250 Q81 279 74 319 L68 345');
    pair('ulnar-artery', 'M91 250 Q92 282 84 318 L80 342');
    path('celiac-trunk', 'M172 260 Q163 257 152 259 L146 263');
    path('superior-mesenteric-artery', 'M172 274 Q163 279 161 293 L156 310');
    path('inferior-mesenteric-artery', 'M172 306 Q161 311 157 324');
    pair('external-iliac-artery', 'M145 360 Q139 369 134 385');
    pair('femoral-artery', 'M134 385 Q130 422 130 451');
    pair('deep-femoral-artery', 'M132 403 Q120 420 119 445');
    pair('anterior-tibial-artery', 'M128 484 Q124 525 125 571 L124 603');
    pair('dorsalis-pedis-artery', 'M124 603 Q127 628 129 641');
  } else {
    path('thoracic-aorta', 'M186 165 Q175 187 171 229');
    pair('posterior-intercostal-arteries',
      'M172 186 Q148 187 122 193 M173 201 Q145 199 117 208 '
      + 'M172 216 Q147 215 123 224');
    pair('popliteal-artery', 'M130 449 Q129 469 126 488');
    pair('posterior-tibial-artery', 'M126 488 Q124 537 119 577 L120 608');
  }

  // Pulmonary circuit (arteries carry O2-poor blood; veins carry O2-rich).
  if (direction === 'anterior') {
    path('pulmonary-trunk', 'M158 197 Q152 175 161 165 L169 161');
    pair('pulmonary-artery', 'M163 165 Q141 157 120 175 L106 185');
  }
  pair('superior-pulmonary-vein', 'M117 185 Q136 180 166 184 L173 182');
  pair('inferior-pulmonary-vein', 'M117 213 Q141 207 168 193 L174 189');

  // Coronary circulation is magnifiable rather than expanded to overwhelm
  // the whole-body illustration.
  path('right-coronary-artery', 'M172 176 Q156 174 148 183 Q143 188 146 196');
  if (direction === 'anterior') {
    path('left-main-coronary-artery', 'M172 171 Q183 174 179 183');
    path('anterior-interventricular-artery', 'M179 183 Q169 198 174 220 L177 225');
    path('circumflex-artery', 'M179 183 Q191 181 184 194');
    path('great-cardiac-vein', 'M183 185 Q174 202 180 222');
  } else {
    path('posterior-interventricular-artery', 'M166 190 Q170 208 177 224');
    path('coronary-sinus', 'M143 190 Q160 181 182 190');
  }

  // Central systemic veins have their own offset from the aorta to keep
  // small zoom-level crossings visible. True vessels may overlap in 3D.
  path('superior-vena-cava', 'M147 157 L147 181 Q146 187 146 190');
  path('inferior-vena-cava', 'M154 330 Q156 298 155 268 L153 231 L151 202');
  pair('internal-jugular-vein', 'M142 43 Q141 98 139 134 L140 150');
  pair('subclavian-vein', 'M112 166 Q131 161 145 163');
  pair('renal-vein', 'M155 274 Q143 275 131 286');
  pair('common-iliac-vein', 'M155 328 Q148 340 145 358');
  if (direction === 'anterior') {
    pair('external-jugular-vein', 'M126 60 Q125 103 129 137 L139 158');
    pair('brachiocephalic-vein', 'M140 151 Q149 160 151 163');
    pair('axillary-vein', 'M112 168 Q108 180 103 198');
    pair('cephalic-vein', 'M101 193 Q94 231 76 282 L68 324');
    pair('basilic-vein', 'M104 207 Q104 232 96 258 L88 320');
    pair('median-cubital-vein', 'M85 254 L98 268');
    path('hepatic-veins', 'M141 261 Q149 258 155 251');
    path('hepatic-portal-vein', 'M151 282 Q140 286 138 272 L127 263');
    pair('external-iliac-vein', 'M145 358 Q142 369 139 384');
    pair('femoral-vein', 'M139 384 Q139 422 135 454');
    pair('great-saphenous-vein', 'M141 384 Q147 427 140 472 L136 536 L135 606');
  } else {
    pair('popliteal-vein', 'M134 450 Q135 469 132 491');
    pair('small-saphenous-vein', 'M113 607 Q114 578 118 552 L123 508 L132 491');
  }
  return shapes;
}
export const cardiovascularShapes: readonly AtlasShape[] = [
  ...draw('anterior'), ...draw('posterior'),
];

// Every published directional entry has independent selectable geometry.
// Decorative strokes may be added later without inflating the count.
for (const direction of ['anterior', 'posterior'] as const) {
  const layer = 'cardiovascular.vessels.' + direction;
  const surface = direction === 'anterior' ? 'front' : 'back';
  const present = new Set(cardiovascularShapes.filter(shape =>
    shape.layerId === layer && shape.renderMode !== 'etch'
    && shape.renderMode !== 'cutout').map(shape => shape.structureId));
  const missing = cardiovascularSpecs.filter(spec => spec.surfaces.includes(surface))
    .flatMap(spec => (spec.paired ? ['left', 'right'] as const : [null])
      .map(side => 'cardiovascular.' + (side ? side + '.' : '') + spec.id))
    .filter(id => !present.has(id));
  if (missing.length) throw new Error('Missing cardiovascular ' + surface
    + ' geometry: ' + missing.join(', '));
}
