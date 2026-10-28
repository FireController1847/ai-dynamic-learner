import type { AtlasLayer, AtlasShape, AtlasStructure } from './atlas-model.ts';

// Original vector teaching artwork, not a photographic or clinically reviewed plate.
// Preserve bone-group IDs when adding future individual-bone regional views.
const groups = [
  ['cranium', 'Cranium', 'Axial skeleton', 'head-neck', 'The skull vault protects the brain and forms the upper portion of the head.'],
  ['mandible', 'Mandible', 'Axial skeleton', 'head-neck', 'The movable lower jaw.'],
  ['maxillae', 'Maxillae', 'Axial skeleton', 'head-neck', 'The paired upper-jaw bones below the orbits.'],
  ['zygomatic-bones', 'Zygomatic bones', 'Axial skeleton', 'head-neck', 'The cheekbones, forming part of the lateral orbital walls.'],
  ['nasal-bones', 'Nasal bones', 'Axial skeleton', 'head-neck', 'The small paired bones that form the bridge of the nose.'],
  ['clavicles', 'Clavicles', 'Appendicular skeleton', 'thorax', 'Collarbones that connect the sternum with the shoulder girdle.'],
  ['scapulae', 'Scapulae', 'Appendicular skeleton', 'back', 'The broad shoulder blades on the posterior thoracic wall.'],
  ['sternum', 'Sternum', 'Axial skeleton', 'thorax', 'The breastbone, providing an anterior attachment for the ribs.'],
  ['ribs', 'Ribs', 'Axial skeleton', 'thorax', 'Twelve pairs form the thoracic cage and protect organs of the chest.'],
  ['vertebral-column', 'Vertebral column', 'Axial skeleton', 'back', 'The spinal column supports the trunk and protects the spinal cord.'],
  ['cervical-vertebrae', 'Cervical vertebrae', 'Axial skeleton', 'head-neck', 'Seven vertebrae form the neck portion of the spine.'],
  ['thoracic-vertebrae', 'Thoracic vertebrae', 'Axial skeleton', 'thorax', 'Twelve vertebrae in the upper and mid-back articulate with the ribs.'],
  ['lumbar-vertebrae', 'Lumbar vertebrae', 'Axial skeleton', 'back', 'Five large vertebrae in the lower back bear much of the trunk’s weight.'],
  ['sacrum', 'Sacrum', 'Axial skeleton', 'pelvis', 'Fused vertebrae at the base of the spine, between the hip bones.'],
  ['pelvis', 'Bony pelvis', 'Axial and appendicular skeleton', 'pelvis', 'The pelvic ring includes the paired hip bones and sacrum.'],
  ['humeri', 'Humeri', 'Appendicular skeleton', 'upper-limb', 'The paired upper-arm bones, between shoulder and elbow.'],
  ['radii', 'Radii', 'Appendicular skeleton', 'upper-limb', 'The forearm bones on the thumb side in anatomical position.'],
  ['ulnae', 'Ulnae', 'Appendicular skeleton', 'upper-limb', 'The forearm bones on the little-finger side in anatomical position.'],
  ['carpals', 'Carpals', 'Appendicular skeleton', 'upper-limb', 'Small wrist bones arranged in two rows.'],
  ['metacarpals', 'Metacarpals', 'Appendicular skeleton', 'upper-limb', 'Five bones form the palm of each hand.'],
  ['hand-phalanges', 'Finger phalanges', 'Appendicular skeleton', 'upper-limb', 'The bones of the fingers and thumbs.'],
  ['femora', 'Femora', 'Appendicular skeleton', 'lower-limb', 'The thigh bones, from the hip to the knee.'],
  ['patellae', 'Patellae', 'Appendicular skeleton', 'lower-limb', 'The kneecaps, embedded in the quadriceps tendon.'],
  ['tibiae', 'Tibiae', 'Appendicular skeleton', 'lower-limb', 'The larger medial shinbones that carry most of the load.'],
  ['fibulae', 'Fibulae', 'Appendicular skeleton', 'lower-limb', 'The slender lateral bones of the lower legs.'],
  ['tarsals', 'Tarsals', 'Appendicular skeleton', 'lower-limb', 'The ankle and rear-foot bones.'],
  ['metatarsals', 'Metatarsals', 'Appendicular skeleton', 'lower-limb', 'Five long bones in each forefoot.'],
  ['toe-phalanges', 'Toe phalanges', 'Appendicular skeleton', 'lower-limb', 'The small bones of the toes.'],
] as const;

export const skeletalStructures: readonly AtlasStructure[] = groups.map(([id, name, classification, regionId, description]) => ({
  id: 'skeletal.' + id, systemId: 'skeletal', name, classification,
  regionIds: [regionId], description,
}));

type Direction = 'anterior' | 'posterior';
export const skeletalLayers: readonly AtlasLayer[] = (['anterior', 'posterior'] as const).map(direction => ({
  id: 'skeletal.outline.' + direction,
  viewId: 'skeletal.whole-body.' + direction,
  name: 'Major bones — illustrative',
  order: 0,
}));

function draw(direction: Direction): AtlasShape[] {
  const shapes: AtlasShape[] = [];
  const add = (id: string, d: string, renderMode: AtlasShape['renderMode'] = 'filled', mirrorX = false) => {
    shapes.push({
      id: 'skeletal.' + direction + '.' + id + '.' + shapes.length,
      layerId: 'skeletal.outline.' + direction,
      structureId: 'skeletal.' + id,
      geometry: { kind: 'path', d }, renderMode, mirrorX,
    });
  };
  const ellipse = (id: string, cx: number, cy: number, rx: number, ry: number,
    renderMode: AtlasShape['renderMode'] = 'filled', mirrorX = false) => {
    shapes.push({
      id: 'skeletal.' + direction + '.' + id + '.' + shapes.length,
      layerId: 'skeletal.outline.' + direction,
      structureId: 'skeletal.' + id,
      geometry: { kind: 'ellipse', cx, cy, rx, ry }, renderMode, mirrorX,
    });
  };
  const paired = (id: string, d: string, renderMode: AtlasShape['renderMode'] = 'filled') => {
    add(id, d, renderMode);
    add(id, d, renderMode, true);
  };

  // Skull: characteristic rounded vault, separated cheek / upper jaw / mandible.
  add('cranium', 'M160 19 C141 18 131 31 130 50 C129 64 137 74 142 80 L178 80 C183 74 191 64 190 50 C189 31 179 18 160 19 Z');
  add('cranium', 'M135 49 Q160 38 185 49 M141 37 Q160 28 179 37', 'etch');
  ellipse('cranium', 146, 61, 9, 10, 'cutout');
  ellipse('cranium', 174, 61, 9, 10, 'cutout');
  add('cranium', 'M158 69 L154 77 L160 80 L166 77 L162 69 Z', 'cutout');
  paired('zygomatic-bones', 'M135 67 L145 74 L150 81 L142 83 L133 76 Z');
  paired('maxillae', 'M144 80 L158 81 L158 92 Q150 92 143 87 Z');
  add('nasal-bones', 'M156 58 Q160 55 164 58 L163 67 L160 70 L157 67 Z');
  add('mandible', 'M139 85 L145 88 L150 94 Q160 101 170 94 L175 88 L181 85 L179 96 Q170 109 160 111 Q150 109 141 96 Z');
  add('mandible', 'M150 96 Q160 99 170 96', 'etch');

  // Cervical / thoracic / lumbar vertebral bodies and small transverse processes.
  const vertebrae = [
    ['cervical-vertebrae', 115, 7, 5],
    ['thoracic-vertebrae', 151, 12, 5.2],
    ['lumbar-vertebrae', 236, 5, 7.3],
  ] as const;
  for (const [id, start, count, radius] of vertebrae) {
    const step = id === 'cervical-vertebrae' ? 4.5 : id === 'thoracic-vertebrae' ? 6.7 : 9.3;
    for (let i = 0; i < count; i++) {
      const y = start + i * step;
      add(id, 'M' + (160 - radius) + ' ' + y
        + ' Q160 ' + (y - 2.8) + ' ' + (160 + radius) + ' ' + y
        + ' L' + (160 + radius + 1) + ' ' + (y + 4)
        + ' Q160 ' + (y + 7) + ' ' + (160 - radius - 1) + ' ' + (y + 4) + ' Z');
      if (id !== 'cervical-vertebrae') {
        add(id, 'M' + (158 - radius) + ' ' + (y + 2) + ' l-4 -2 M' + (162 + radius) + ' ' + (y + 2) + ' l4 -2', 'etch');
      }
    }
  }

  // Sternum and clavicles, with broad shoulder blades in the posterior view.
  if (direction === 'anterior') {
    add('sternum', 'M157 141 Q160 136 163 141 L167 153 L165 187 L161 203 L159 203 L155 187 L153 153 Z');
    add('sternum', 'M155 174 L165 174 M155 187 L164 187', 'etch');
    paired('clavicles', 'M158 143 Q142 136 130 139 Q119 137 109 147 L106 151 Q120 143 132 145 Q145 140 158 147 Z');
  } else {
    paired('scapulae', 'M112 149 Q115 143 124 146 L147 168 L139 205 Q121 203 117 188 L108 166 Z');
    paired('scapulae', 'M112 157 L139 197 M122 151 L132 178', 'etch');
    paired('clavicles', 'M158 143 Q142 136 130 139 Q119 137 109 147 L106 151 Q120 143 132 145 Q145 140 158 147 Z');
  }

  // Ribs gently arc around the spine. Their even line weight is deliberate.
  for (let i = 0; i < 10; i++) {
    const y = 153 + i * 7.0;
    const spread = i < 5 ? 46 + i * 2 : 54 - (i - 5) * 4;
    const reach = 156 - spread;
    paired('ribs', 'M155 ' + y + ' C141 ' + (y - 8) + ' ' + (reach + 4) + ' ' + (y - 8)
      + ' ' + reach + ' ' + (y + 7) + ' Q' + (reach - 3) + ' ' + (y + 14)
      + ' ' + (reach + 10) + ' ' + (y + 18), 'stroke');
  }
  // Floating lower ribs.
  paired('ribs', 'M156 223 Q138 222 127 236', 'stroke');
  paired('ribs', 'M156 231 Q141 230 132 244', 'stroke');

  // Broad bilateral iliac wings, obturator openings, sacral wedge.
  paired('pelvis', 'M151 281 Q135 272 120 281 Q109 294 105 311 Q103 325 115 329 Q130 332 142 319 L159 313 L154 301 Z');
  paired('pelvis', 'M115 315 Q125 301 141 309 L137 326 Q123 338 115 325 Z', 'cutout');
  paired('pelvis', 'M123 286 Q110 301 114 316 M142 307 L137 321', 'etch');
  add('sacrum', 'M151 290 Q160 285 169 290 L167 313 L160 329 L153 313 Z');
  add('sacrum', 'M155 296 L165 296 M156 303 L164 303 M157 310 L163 310', 'etch');

  // Anatomically shaped long bones: articular heads and tapered shafts rather
  // than the old uniform thick blue lines. Right side mirrors the left geometry.
  paired('humeri',
    'M109 149 C100 143 95 154 99 162 Q101 168 106 168 L89 235 Q86 240 91 243 L97 242 Q103 237 99 232 L116 165 Q123 158 116 152 Z');
  paired('humeri', 'M105 174 L95 222', 'etch');
  paired('ulnae',
    'M88 246 Q83 245 81 253 L65 310 Q64 317 69 321 Q75 324 77 318 L92 258 Q96 252 93 248 Z');
  paired('radii',
    'M95 247 Q98 244 102 250 L94 264 L85 314 Q85 321 78 321 L75 319 Q76 313 81 306 L90 263 Z');

  // Proportioned wrists and hands: the fingertip-to-wrist span is much
  // shorter than the forearm, and individual phalanges have small gaps.
  for (let i = 0; i < 4; i++) {
    ellipse('carpals', 67 + i * 5, 326 + (i % 2) * 2, 3, 3.6);
    ellipse('carpals', 67 + i * 5, 332 + (i % 2), 3, 3);
    ellipse('carpals', 67 + i * 5, 326 + (i % 2) * 2, 3, 3.6, 'filled', true);
    ellipse('carpals', 67 + i * 5, 332 + (i % 2), 3, 3, 'filled', true);
  }
  for (let i = 0; i < 4; i++) {
    const x = 68 + i * 5.3;
    paired('metacarpals', 'M' + x + ' 335 Q' + (x - 2) + ' 341 ' + (x - 4) + ' 348', 'stroke');
    // Finger segments and visible knuckle gaps.
    paired('hand-phalanges', 'M' + (x - 4) + ' 350 L' + (x - 5 - i) + ' ' + (357 + (i % 2) * 3)
      + ' M' + (x - 5 - i) + ' ' + (360 + (i % 2) * 3) + ' l-1 7', 'stroke');
  }
  paired('metacarpals', 'M83 335 L91 343', 'stroke');
  paired('hand-phalanges', 'M92 346 L96 352', 'stroke');

  // Longer thigh and shin bones balance the pelvis-to-ground distance with
  // the head-to-hip distance. The knee stays near the midpoint of the leg.
  paired('femora',
    'M139 329 Q132 326 128 333 Q125 339 132 343 L125 372 L121 447 Q118 454 124 460 L136 460 Q141 454 137 447 L141 370 L149 343 Q156 339 154 334 Q150 326 145 331 Z');
  paired('femora', 'M135 372 L128 440', 'etch');
  if (direction === 'anterior') {
    ellipse('patellae', 129, 465, 7.2, 9.4);
    ellipse('patellae', 129, 432, 7.2, 9.4, 'filled', true);
    paired('patellae', 'M126 465 L133 465 M129 460 L129 470', 'etch');
  }
  paired('tibiae',
    'M122 478 Q130 474 137 480 L134 491 L130 590 Q131 596 125 602 L121 601 Q116 596 119 590 L119 492 Z');
  paired('fibulae',
    'M116 478 Q112 475 109 482 L108 501 L105 594 Q105 601 110 602 L114 599 L114 590 L117 491 Z');

  // Small ankle, forefoot and toe groups complete the longer lower limbs.
  paired('tarsals', 'M110 602 Q117 596 126 603 L132 612 L130 622 L119 624 L109 615 Z');
  for (let i = 0; i < 5; i++) {
    const origin = 118 + i * 3;
    const end = 105 + i * 8;
    paired('metatarsals', 'M' + origin + ' 620 L' + end + ' 633', 'stroke');
    paired('toe-phalanges', 'M' + end + ' 638 l' + (i - 2) + ' 6', 'stroke');
  }

  return shapes;
}
export const skeletalShapes: readonly AtlasShape[] = [
  ...draw('anterior'),
  ...draw('posterior'),
];
