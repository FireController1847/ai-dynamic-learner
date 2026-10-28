import type { AtlasLayer, AtlasShape, AtlasStructure } from './atlas-model.ts';

// An intentionally schematic, hand-authored teaching outline. This is NOT
// a complete 206-bone atlas or a medically validated anatomical illustration.
// Stable IDs represent named bone groups; individual bones and regional
// drawings can be added independently without replacing these identifiers.
const groups = [
  ['cranium', 'Cranium', 'Axial skeleton', 'head-neck', 'The part of the skull that encloses and protects the brain.'],
  ['mandible', 'Mandible', 'Axial skeleton', 'head-neck', 'The lower jaw bone.'],
  ['clavicles', 'Clavicles', 'Appendicular skeleton', 'thorax', 'The paired collarbones connecting the sternum and shoulder girdles.'],
  ['scapulae', 'Scapulae', 'Appendicular skeleton', 'back', 'The paired shoulder blades on the posterior thorax.'],
  ['sternum', 'Sternum', 'Axial skeleton', 'thorax', 'The breastbone in the front center of the thorax.'],
  ['ribs', 'Ribs', 'Axial skeleton', 'thorax', 'The curved bones forming the protective rib cage.'],
  ['vertebral-column', 'Vertebral column', 'Axial skeleton', 'back', 'The spinal column, composed of vertebrae and associated structures.'],
  ['pelvis', 'Bony pelvis', 'Axial and appendicular skeleton', 'pelvis', 'The pelvic framework includes the paired hip bones, sacrum, and coccyx.'],
  ['humeri', 'Humeri', 'Appendicular skeleton', 'upper-limb', 'The two upper-arm bones between shoulder and elbow.'],
  ['radii', 'Radii', 'Appendicular skeleton', 'upper-limb', 'The forearm bones on the thumb side in anatomical position.'],
  ['ulnae', 'Ulnae', 'Appendicular skeleton', 'upper-limb', 'The forearm bones on the little-finger side in anatomical position.'],
  ['femora', 'Femora', 'Appendicular skeleton', 'lower-limb', 'The two thigh bones, extending from hip to knee.'],
  ['patellae', 'Patellae', 'Appendicular skeleton', 'lower-limb', 'The kneecaps, located in front of the knee joints.'],
  ['tibiae', 'Tibiae', 'Appendicular skeleton', 'lower-limb', 'The larger, medial shinbones that bear most lower-leg weight.'],
  ['fibulae', 'Fibulae', 'Appendicular skeleton', 'lower-limb', 'The smaller, lateral bones of the lower legs.'],
] as const;

export const skeletalStructures: readonly AtlasStructure[] = groups.map(([id, name, classification, regionId, description]) => ({
  id: 'skeletal.' + id,
  systemId: 'skeletal',
  name,
  classification,
  regionIds: [regionId],
  description,
}));

const anterior = 'skeletal.whole-body.anterior';
const posterior = 'skeletal.whole-body.posterior';
export const skeletalLayers: readonly AtlasLayer[] = [
  { id: 'skeletal.outline.anterior', viewId: anterior, name: 'Major bones (schematic)', order: 0 },
  { id: 'skeletal.outline.posterior', viewId: posterior, name: 'Major bones (schematic)', order: 0 },
];

type Direction = 'anterior' | 'posterior';

function makePath(direction: Direction, id: string, d: string, outline = true): AtlasShape {
  return {
    id: 'skeletal.' + direction + '.' + id,
    layerId: 'skeletal.outline.' + direction,
    structureId: 'skeletal.' + id,
    renderMode: outline ? 'stroke' : 'filled',
    geometry: { kind: 'path', d },
  };
}

function makeEllipse(direction: Direction, id: string, cx: number, cy: number, rx: number, ry: number): AtlasShape {
  return {
    id: 'skeletal.' + direction + '.' + id,
    layerId: 'skeletal.outline.' + direction,
    structureId: 'skeletal.' + id,
    renderMode: 'filled',
    geometry: { kind: 'ellipse', cx, cy, rx, ry },
  };
}

function ribPaths() {
  const ribs: string[] = [];
  for (let index = 0; index < 6; index++) {
    const y = 128 + index * 12;
    const spread = 28 + index * 2;
    ribs.push('M158 ' + y + ' Q' + (158 - spread) + ' ' + (y - 15) + ' ' + (111 + index) + ' ' + (y + 4));
    ribs.push('M162 ' + y + ' Q' + (162 + spread) + ' ' + (y - 15) + ' ' + (209 - index) + ' ' + (y + 4));
  }
  return ribs.join(' ');
}

// Geometry is in the same 320 × 560 coordinate system as the placeholder.
// Front/back differ in which central and shoulder structures are depicted.
function outline(direction: Direction): AtlasShape[] {
  const paths: AtlasShape[] = [
    makeEllipse(direction, 'cranium', 160, 56, 24, 29),
    makePath(direction, 'vertebral-column',
      'M160 98 L160 271 M155 115h10 M155 130h10 M155 145h10 M155 160h10 M155 175h10 M155 190h10 M155 205h10 M155 220h10 M155 235h10 M155 250h10', true),
    makePath(direction, 'ribs', ribPaths(), true),
    makePath(direction, 'pelvis',
      'M152 274 Q132 257 118 274 L112 298 Q124 317 143 310 L160 298 L177 310 Q196 317 208 298 L202 274 Q188 257 168 274 M143 310 Q152 324 160 328 Q168 324 177 310', false),
    makePath(direction, 'humeri', 'M113 123 L91 217 M207 123 L229 217'),
    makePath(direction, 'radii', 'M87 228 L65 291 M233 228 L255 291'),
    makePath(direction, 'ulnae', 'M97 228 L82 289 M223 228 L238 289'),
    makePath(direction, 'femora', 'M138 314 L121 400 M182 314 L199 400'),
    makeEllipse(direction, 'patellae', 118, 416, 7, 10),
    makeEllipse(direction, 'patellae', 202, 416, 7, 10),
    makePath(direction, 'tibiae', 'M121 431 L119 519 M199 431 L201 519'),
    makePath(direction, 'fibulae', 'M108 432 L100 511 M212 432 L220 511'),
  ];
  if (direction === 'anterior') {
    paths.push(
      makePath(direction, 'mandible', 'M144 78 Q160 101 176 78 L176 85 Q160 110 144 85', false),
      makePath(direction, 'clavicles', 'M158 111 Q143 103 116 113 M162 111 Q177 103 204 113'),
      makePath(direction, 'sternum', 'M160 115 L160 174'),
    );
  } else {
    paths.push(makePath(direction, 'scapulae',
      'M112 118 L99 155 Q106 172 127 180 L136 133 Z M208 118 L221 155 Q214 172 193 180 L184 133 Z', false));
  }
  return paths;
}

// Multiple shapes may intentionally point to the same bone-group ID.
// Unique shape IDs are required by the atlas index, including bilateral ellipses.
export const skeletalShapes: readonly AtlasShape[] = [
  ...outline('anterior'),
  ...outline('posterior'),
].map((shape, index) => ({ ...shape, id: shape.id + '.' + index }));
