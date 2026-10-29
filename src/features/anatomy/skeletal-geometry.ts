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

  // The original drawing put the shoulders, arms, thorax and legs too close
  // to the midline. Adjust their whole anatomical assemblies about x=160
  // instead of moving one bone at a time and breaking articulations.
  // Left/right mirror remains an outer transform in the SVG renderer.
  function widthTransform(id: string): string | undefined {
    const shoulder = /^(clavicle|scapula)$/.test(id);
    const thorax = id === 'sternum' || /^rib-\d+$/.test(id);
    const pelvic = id === 'hip-bone';
    const arm = /^(humerus|radius|ulna|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal-\d+|hand-)/.test(id);
    const leg = /^(femur|patella|tibia|fibula|talus|calcaneus|navicular|cuboid|medial-cuneiform|intermediate-cuneiform|lateral-cuneiform|metatarsal-\d+|foot-)/.test(id);
    const factor = shoulder ? 1.4 : thorax ? 1.4 : pelvic ? 1.05
      : arm ? 1.12 : leg ? 1.1 : 1;
    return factor === 1 ? undefined
      : 'translate(160 0) scale(' + factor + ' 1) translate(-160 0)';
  }
  function shape(id: string, geometry: AtlasShape['geometry'], side?: Side,
    mode: AtlasShape['renderMode'] = 'filled') {
    shapes.push({
      id: facing + '.' + id + '.' + shapes.length,
      layerId,
      structureId: 'skeletal.' + (side ? side + '.' : '') + id,
      geometry, renderMode: mode, mirrorX: side ? reflected(side) : false,
      transform: widthTransform(id),
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
  // Curved tapered diaphyses with expanded articular ends, rather than
  // rectangular sticks. The same helper scales to metacarpals/phalanges.
  function shaft(id: string, x1: number, y1: number, x2: number, y2: number,
    width: number, side?: Side) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    const point = (t: number, lateral: number) => {
      const x = x1 + dx * t + px * lateral;
      const y = y1 + dy * t + py * lateral;
      return x.toFixed(2) + ' ' + y.toFixed(2);
    };
    const head = width * .57, waist = width * .30, condyle = width * .50;
    const d = 'M' + point(0, head)
      + ' C' + point(-.035, head * .85) + ' ' + point(-.035, -head * .85)
      + ' ' + point(0, -head)
      + ' C' + point(.14, -waist) + ' ' + point(.69, -waist)
      + ' ' + point(.95, -condyle)
      + ' Q' + point(1.045, 0) + ' ' + point(.95, condyle)
      + ' C' + point(.69, waist) + ' ' + point(.14, waist)
      + ' ' + point(0, head) + ' Z';
    path(id, d, side);
  }

  // Skull (OpenStax A&P 2e §7.2). A broad cranial vault, paired lateral
  // plates, orbital rims, nasal aperture, upper jaw and mandibular arch.
  // Deep bones are retained for atlas/FitB identity but are simplified
  // projections; a dedicated cutaway is needed for their true 3-D locations.
  path('frontal', facing === 'anterior'
    ? 'M135 38 C136 26 148 22 160 22 C172 22 184 26 185 38 '
      + 'L184 54 Q178 58 169 57 L160 53 Q151 57 142 58 L136 54 Z'
    : 'M144 28 Q160 22 176 28 L171 38 Q160 34 149 38 Z');
  path('occipital', facing === 'posterior'
    ? 'M134 51 C142 60 150 61 160 60 C170 61 178 60 186 51 '
      + 'L182 73 Q175 90 160 92 Q145 90 138 73 Z'
    : 'M153 93 Q160 95 167 93 L163 97 L157 97 Z');
  // Sphenoid and ethmoid contribute to the posterior orbital wall and nasal
  // septum, not separate exterior plates covering the entire upper face.
  path('sphenoid', 'M146 64 Q150 61 153 66 L154 74 L147 73 Z');
  path('ethmoid', 'M156 65 L164 65 L162 81 L160 86 L158 81 Z');
  both('parietal', facing === 'posterior'
    ? 'M135 31 Q141 21 157 24 L157 57 Q151 62 143 58 L133 51 Z'
    : 'M137 31 Q142 25 155 25 L156 53 Q148 57 141 55 L134 49 Z');
  both('temporal', facing === 'posterior'
    ? 'M136 54 Q142 58 149 62 L148 77 Q141 85 136 77 L131 66 Z'
    : 'M132 54 Q141 56 147 61 L146 78 Q138 85 131 76 L128 65 Z');

  // Face. The left/right bones are independent selection targets; the
  // negative spaces beneath the orbital rims are decorative and never scored.
  path('mandible', facing === 'anterior'
    ? 'M132 83 Q134 80 138 83 L142 94 Q149 105 160 107 '
      + 'Q171 105 178 94 L182 83 Q186 80 188 83 '
      + 'L184 99 Q177 114 160 117 Q143 114 136 99 Z'
    : 'M137 88 Q140 105 160 111 Q180 105 183 88 '
      + 'L185 96 Q176 116 160 119 Q144 116 135 96 Z');
  path('vomer', 'M159 77 L161 77 L161 88 L160 91 L159 88 Z');
  both('maxilla', 'M143 83 L154 84 L158 89 L159 101 '
    + 'Q149 101 143 97 L140 90 Z');
  both('zygomatic', 'M130 67 Q134 66 140 70 L148 78 '
    + 'Q144 85 139 88 L130 82 Q126 77 130 67 Z');
  both('nasal', 'M156 60 Q158 60 159 63 L159 74 L156 77 L153 72 Z');
  both('lacrimal', 'M149 67 L153 68 L152 76 L149 78 Z');
  both('palatine', 'M150 96 L158 96 L157 101 L150 100 Z');
  both('inferior-nasal-concha', 'M151 80 Q156 79 156 85 L152 89 Z');

  // Visually identify paired orbit openings and the pear-shaped nasal
  // aperture; teeth are not part of the standard 206-bone inventory.
  // These are painted at the end of the skull block, above all facial bones.
  if (facing === 'anterior') {
    for (const side of ['left', 'right'] as const) {
      path('zygomatic', 'M137 65 C142 62 149 64 152 69 '
        + 'Q153 76 148 81 Q141 82 136 77 Q133 71 137 65 Z', side, 'cutout');
    }
    path('frontal', 'M156 77 Q160 72 164 77 L168 86 Q160 92 152 86 Z', undefined, 'cutout');
    path('mandible', 'M144 100 Q160 106 176 100', undefined, 'etch');
  }
  if (facing === 'anterior') {
    // Tooth crowns are non-selectable dental landmarks rather than bones.
    // The dental arch is intentionally delicate so bone labels remain clear.
    for (const x of [145, 149, 153, 157, 161, 165, 169, 173, 177]) {
      // Each maxilla is a paired bone: keep dental etching attached to an
      // existing side-specific structure ID (the lines are not selectable).
      const side: Side = x < 160 ? 'right' : 'left';
      const localX = side === 'left' ? 320 - x : x;
      path('maxilla', 'M' + localX + ' 98 L' + localX + ' 102', side, 'etch');
      path('mandible', 'M' + x + ' 105 L' + x + ' 108', undefined, 'etch');
    }
    path('frontal', 'M137 63 Q145 60 153 65', undefined, 'etch');
    path('frontal', 'M167 65 Q175 60 183 63', undefined, 'etch');
  } else {
    // Posterior cranial sutures are visible landmarks on the skull vault.
    // The sagittal suture belongs to a side-specific parietal record.
    path('parietal', 'M160 25 L160 53', 'right', 'etch');
    path('occipital', 'M136 55 Q148 61 160 53 Q172 61 184 55',
      undefined, 'etch');
  }
  for (const side of ['left', 'right'] as const) {
    // Deep middle-ear ossicles shown as enlarged markers in this teaching
    // projection; anatomical location is behind the temporal bone.
    ellipse('malleus', 133, 72, 1.3, 1.7, side);
    ellipse('incus', 131.3, 74.6, 1.3, 1.6, side);
    ellipse('stapes', 129.8, 77, 1, 1.1, side);
  }
  path('hyoid', 'M151 121 Q160 117 169 121 L166 125 L154 125 Z');

  // Seven cervical, twelve thoracic and five lumbar vertebrae. Widths and
  // contour sizes increase toward the lumbar spine; C1 has a wider arch.
  for (const [letter, count, top, step, radius] of [
    ['c', 7, 129, 4, 4.6], ['t', 12, 158, 7.1, 5.7], ['l', 5, 246, 9.2, 7.2],
  ] as const) {
    for (let n = 1; n <= count; n++) {
      const y = top + (n - 1) * step;
      const widening = letter === 'l' ? n * 0.32 : 0;
      const r = radius + widening + (letter === 'c' && n === 1 ? 1.7 : 0);
      const d = 'M' + (160 - r) + ' ' + y
        + ' Q160 ' + (y - 2.5) + ' ' + (160 + r) + ' ' + y
        + ' L' + (160 + r + 1.5) + ' ' + (y + 3)
        + ' Q' + (160 + r) + ' ' + (y + 6.4) + ' 160 ' + (y + 7)
        + ' Q' + (160 - r) + ' ' + (y + 6.4) + ' ' + (160 - r - 1.5)
        + ' ' + (y + 3) + ' Z';
      path(letter + n, d);
    }
  }
  path('sacrum', 'M148 291 Q160 285 172 291 L169 309 '
    + 'Q167 323 160 333 Q153 323 151 309 Z');
  path('coccyx', 'M158 333 Q160 336 162 333 L162 341 L160 346 L158 341 Z');
  path('sternum', 'M155 147 Q160 142 165 147 L166 158 L165 176 '
    + 'L164 190 L160 204 L156 190 L155 176 Z');

  // Anatomical rib cage: paired arcs emerge from the thoracic vertebrae
  // and sweep laterally/forward. The first seven pairs reach the anterior
  // cartilage; pairs 8–10 join the costal margin, and 11–12 float.
  // Cartilage is *not* counted as bone or falsely given a selection ID.
  for (let n = 1; n <= 12; n++) {
    const rootY = 153 + (n - 1) * 7.15;
    const breadth = n <= 7 ? 25 + n * 3.35
      : n <= 10 ? 48 - (n - 7) * 3.5 : 34 - (n - 10) * 3;
    const lateralX = 157 - breadth;
    const dip = n < 3 ? 6 : Math.min(24, 7 + n * 1.65);
    // Mineralized rib ends stop before the sternum; intervening costal
    // cartilage is shown separately and is not a bone.
    const endX = n <= 7 ? 130 + n * 1.9
      : n <= 10 ? 143 - (n - 7) * 5 : lateralX + 7;
    const endY = rootY + (n <= 10 ? dip + 4 : dip * 0.7);
    const d = facing === 'anterior'
      ? 'M155 ' + rootY
        + ' C' + (145 - breadth * 0.18) + ' ' + (rootY - 8)
        + ' ' + (lateralX + 1) + ' ' + (rootY - 7)
        + ' ' + lateralX + ' ' + (rootY + dip * 0.45)
        + ' Q' + (lateralX - 2) + ' ' + (rootY + dip)
        + ' ' + (endX < lateralX + 8 ? lateralX + 8 : endX)
        + ' ' + endY
      : 'M155 ' + rootY
        + ' C' + (144 - breadth * 0.12) + ' ' + (rootY - 6)
        + ' ' + (lateralX + 3) + ' ' + (rootY - 3)
        + ' ' + lateralX + ' ' + (rootY + dip * 0.5)
        + ' Q' + (lateralX + 1) + ' ' + (rootY + dip)
        + ' ' + (lateralX + 14) + ' ' + (rootY + dip + 4);
    for (const side of ['left', 'right'] as const) path('rib-' + n, d, side, 'stroke');
    if (facing === 'anterior' && n <= 7) {
      // Costal cartilages are connective tissue; decorative etching only.
      const cartilageY = 149 + n * 6.7;
      for (const side of ['left', 'right'] as const) {
        path('rib-' + n, 'M' + endX + ' ' + endY
          + ' Q' + ((endX + 153) / 2) + ' ' + (cartilageY + 4)
          + ' 154 ' + cartilageY, side, 'etch');
      }
    }
  }

  // Shoulder/pelvic girdles: clavicles are slender S-curves on the front;
  // scapulae are broad triangular plates with a spine in the back. Each
  // adult os coxae is one fused bone with a real obturator opening.
  both('clavicle', 'M157 147 Q146 141 137 141 Q125 138 114 149 '
    + 'L107 156 Q119 147 132 148 Q146 148 156 153 Z');
  both('scapula', facing === 'posterior'
    ? 'M111 151 Q120 143 135 151 L144 168 Q139 188 129 212 '
      + 'Q115 201 109 179 Z'
    : 'M111 152 Q125 145 138 161 L141 182 L128 204 '
      + 'Q113 189 111 171 Z');
  if (facing === 'posterior') {
    both('scapula', 'M111 167 Q127 164 141 174', 'etch');
  }
  // Each hip bone is a continuous ilium/ischium/pubis complex. Keep the
  // iliac crest broad but curved, taper toward the hip socket where the femur
  // begins, and form a small pubic arch beside the sacrum. The older wide
  // triangular plates hid the acetabula and made the pelvis look like a skirt.
  both('hip-bone', 'M154 293 C144 287 137 285 128 286 '
    + 'C116 284 110 290 111 301 Q112 309 121 316 '
    + 'Q128 322 128 330 Q123 335 128 343 '
    + 'Q132 349 140 339 L147 332 '
    + 'Q151 329 155 338 L158 342 L158 328 '
    + 'Q151 320 149 311 Q152 303 154 293 Z');
  // Obturator foramina remain separate openings in the fused hip bones.
  both('hip-bone', 'M132 324 Q139 320 145 327 '
    + 'Q145 334 136 341 Q131 339 130 333 Z', 'cutout');
  both('hip-bone', 'M115 301 Q127 289 144 297', 'etch');
  both('hip-bone', 'M124 335 Q128 330 134 334', 'etch');

  // Arm shafts and the individual wrist/hand bones are proportioned to the
  // arm's total length; no enormous phalanges. Digit I has no middle phalanx.
  for (const side of ['left', 'right'] as const) {
    shaft('humerus', 94, 154, 84, 244, 11.5, side);
    // In anatomical position the radius is lateral (thumb side) and
    // the ulna medial. Canonical left-screen coordinates are mirrored
    // for the anatomically left limb in the anterior projection.
    shaft('radius', 84, 249, 72, 319, 5.4, side);
    shaft('ulna', 91, 249, 84, 319, 5.8, side);
    const wrist = [
      // Proximal row from radial to ulnar, then distal row.
      ['scaphoid', 68, 326], ['lunate', 73, 326], ['triquetrum', 78, 327],
      ['pisiform', 83, 331], ['trapezium', 66, 333], ['trapezoid', 71, 333],
      ['capitate', 76, 334], ['hamate', 81, 335],
    ] as const;
    for (const [id, x, y] of wrist) ellipse(id, x, y, 2.4, 3, side);
    // Digits 2–5 descend nearly parallel from one compact palm. The thumb
    // angles away at the radial edge, not between the other fingers.
    // Different phalanx lengths give a natural, gently rounded fingertip row.
    const fingerLengths = [7.5, 9.4, 8.6, 6.7];
    for (let digit = 1; digit <= 5; digit++) {
      if (digit === 1) {
        shaft('metacarpal-1', 67.5, 338, 63.5, 347, 2.4, side);
        shaft('hand-proximal-1', 63.5, 347.5, 60.7, 353.3, 1.9, side);
        shaft('hand-distal-1', 60.5, 354, 59, 359, 1.6, side);
        continue;
      }
      const index = digit - 2;
      const x = 72.5 + index * 3.05;
      const tilt = [-0.4, -0.15, 0.15, 0.45][index]!;
      const proximalLength = fingerLengths[index]!;
      shaft('metacarpal-' + digit, x, 341, x + tilt, 351.8, 2.3, side);
      const jointX = x + tilt;
      const baseY = 353;
      shaft('hand-proximal-' + digit, jointX, baseY,
        jointX + tilt * 0.4, baseY + proximalLength, 1.75, side);
      const middleY = baseY + proximalLength + 0.5;
      const midX = jointX + tilt * 0.4;
      const middleLength = proximalLength * 0.70;
      shaft('hand-middle-' + digit, midX, middleY,
        midX + tilt * 0.25, middleY + middleLength, 1.55, side);
      const distalY = middleY + middleLength + 0.4;
      const distalX = midX + tilt * 0.25;
      shaft('hand-distal-' + digit, distalX, distalY,
        distalX + tilt * 0.2, distalY + proximalLength * 0.48, 1.35, side);
    }
  }

  for (const side of ['left', 'right'] as const) {
    shaft('femur', 131, 341, 128, 456, 14.8, side);
    ellipse('patella', 127, 464, 6.3, 8, side);
    shaft('tibia', 129, 480, 124, 597, 10.2, side);
    shaft('fibula', 113, 485, 109, 601, 4.7, side);

    // Talus/calcaneus lie behind other tarsals in this 2D projection.
    const ankle = [
      ['talus', 126, 608, 5, 6], ['calcaneus', 112, 616, 7, 7],
      ['navicular', 124, 619, 4, 4], ['cuboid', 106, 625, 4.5, 5],
      ['medial-cuneiform', 130, 625, 3.5, 4],
      ['intermediate-cuneiform', 124, 627, 3.2, 4],
      ['lateral-cuneiform', 118, 627, 3.2, 4],
    ] as const;
    for (const [id, x, y, rx, ry] of ankle) ellipse(id, x, y, rx, ry, side);
    // Keep the metatarsals and toes together as a foot instead of a fan.
    // Toe lengths taper toward digit V and the great toe has two phalanges.
    const toeLengths = [7.5, 8.2, 7.1, 6, 5.2];
    for (let digit = 1; digit <= 5; digit++) {
      const index = digit - 1;
      const x = 132 - index * 3.05;
      const tilt = index * 0.22;
      const tipX = x - tilt;
      shaft('metatarsal-' + digit, x, 634, tipX, 645 - index * 0.45, 2.7, side);
      const startY = 646 - index * 0.45;
      const proximalLength = toeLengths[index]!;
      shaft('foot-proximal-' + digit, tipX, startY,
        tipX - 0.2, startY + proximalLength, digit === 1 ? 2.5 : 2, side);
      if (digit === 1) {
        shaft('foot-distal-1', tipX - 0.2, startY + proximalLength + 0.5,
          tipX - 0.45, startY + proximalLength + 6.4, 2.25, side);
      } else {
        const middleY = startY + proximalLength + 0.4;
        const middleLength = proximalLength * 0.48;
        shaft('foot-middle-' + digit, tipX - 0.2, middleY,
          tipX - 0.35, middleY + middleLength, 1.65, side);
        shaft('foot-distal-' + digit, tipX - 0.35, middleY + middleLength + 0.35,
          tipX - 0.5, middleY + middleLength + 2.6, 1.45, side);
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
