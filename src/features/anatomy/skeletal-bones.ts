import type { AtlasStructure } from './atlas-model.ts';

// Standard adult skeleton: 80 axial + 126 appendicular = 206 bones.
// Fused sacrum, coccyx, and each os coxae count as ONE adult bone.
// Variable sesamoids, sutural bones and teeth are not in the conventional 206.
// References: NCI SEER Divisions of the Skeleton; OpenStax A&P 2e §7.1–8.4.
export type BoneSide = 'left' | 'right';
const sides: readonly BoneSide[] = ['left', 'right'];
type Division = 'Axial' | 'Appendicular';
const bones: AtlasStructure[] = [];

function add(id: string, name: string, division: Division, group: string,
  regionId: string, side?: BoneSide, detail?: string) {
  bones.push({
    id: 'skeletal.' + (side ? side + '.' : '') + id,
    systemId: 'skeletal',
    name: (side ? side === 'left' ? 'Left ' : 'Right ' : '') + name,
    classification: division + ' skeleton · ' + group,
    regionIds: [regionId],
    description: detail ?? (name + ' is a bone of the ' + group.toLowerCase() + '.'),
  });
}
function bilateral(id: string, name: string, division: Division, group: string, region: string, detail?: string) {
  for (const side of sides) add(id, name, division, group, region, side, detail);
}

add('frontal', 'Frontal bone', 'Axial', 'Cranium', 'head-neck');
add('occipital', 'Occipital bone', 'Axial', 'Cranium', 'head-neck');
add('sphenoid', 'Sphenoid bone', 'Axial', 'Cranium', 'head-neck');
add('ethmoid', 'Ethmoid bone', 'Axial', 'Cranium', 'head-neck');
bilateral('parietal', 'parietal bone', 'Axial', 'Cranium', 'head-neck');
bilateral('temporal', 'temporal bone', 'Axial', 'Cranium', 'head-neck');

add('mandible', 'Mandible', 'Axial', 'Facial bones', 'head-neck');
add('vomer', 'Vomer', 'Axial', 'Facial bones', 'head-neck');
for (const [id, name] of [
  ['maxilla', 'maxilla'], ['zygomatic', 'zygomatic bone'], ['nasal', 'nasal bone'],
  ['lacrimal', 'lacrimal bone'], ['palatine', 'palatine bone'],
  ['inferior-nasal-concha', 'inferior nasal concha'],
] as const) bilateral(id, name, 'Axial', 'Facial bones', 'head-neck');

for (const [id, name] of [['malleus', 'malleus'], ['incus', 'incus'], ['stapes', 'stapes']] as const) {
  bilateral(id, name, 'Axial', 'Auditory ossicles', 'head-neck',
    'One of the three tiny auditory ossicles in the middle ear; its precise location needs a magnified or sectional view.');
}
add('hyoid', 'Hyoid bone', 'Axial', 'Hyoid', 'head-neck');

for (const [letter, count, group, region] of [
  ['C', 7, 'Cervical vertebrae', 'head-neck'],
  ['T', 12, 'Thoracic vertebrae', 'thorax'],
  ['L', 5, 'Lumbar vertebrae', 'back'],
] as const) {
  for (let n = 1; n <= count; n++) {
    add(letter.toLowerCase() + n, letter + n + ' vertebra', 'Axial', group, region);
  }
}
add('sacrum', 'Sacrum', 'Axial', 'Vertebral column', 'pelvis');
add('coccyx', 'Coccyx', 'Axial', 'Vertebral column', 'pelvis');
add('sternum', 'Sternum', 'Axial', 'Thoracic cage', 'thorax');
for (const side of sides) {
  for (let n = 1; n <= 12; n++) {
    add('rib-' + n, 'rib ' + n, 'Axial', 'Thoracic cage', 'thorax', side);
  }
}

bilateral('clavicle', 'clavicle', 'Appendicular', 'Pectoral girdle', 'thorax');
bilateral('scapula', 'scapula', 'Appendicular', 'Pectoral girdle', 'back');
bilateral('hip-bone', 'hip bone (os coxae)', 'Appendicular', 'Pelvic girdle', 'pelvis');
for (const [id, name] of [
  ['humerus', 'humerus'], ['radius', 'radius'], ['ulna', 'ulna'],
] as const) bilateral(id, name, 'Appendicular', 'Upper limb', 'upper-limb');

const carpals = ['scaphoid', 'lunate', 'triquetrum', 'pisiform',
  'trapezium', 'trapezoid', 'capitate', 'hamate'] as const;
const tarsals = ['talus', 'calcaneus', 'navicular', 'cuboid',
  'medial-cuneiform', 'intermediate-cuneiform', 'lateral-cuneiform'] as const;
const carpalNames = ['scaphoid', 'lunate', 'triquetrum', 'pisiform',
  'trapezium', 'trapezoid', 'capitate', 'hamate'] as const;
const tarsalNames = ['talus', 'calcaneus', 'navicular', 'cuboid',
  'medial cuneiform', 'intermediate cuneiform', 'lateral cuneiform'] as const;

for (const side of sides) {
  carpals.forEach((id, index) => add(id, carpalNames[index], 'Appendicular', 'Carpal bones', 'upper-limb', side));
  for (let digit = 1; digit <= 5; digit++) {
    add('metacarpal-' + digit, 'metacarpal ' + digit, 'Appendicular', 'Metacarpals', 'upper-limb', side);
    add('hand-proximal-' + digit, 'proximal phalanx of hand digit ' + digit,
      'Appendicular', 'Hand phalanges', 'upper-limb', side);
    if (digit !== 1) add('hand-middle-' + digit, 'middle phalanx of hand digit ' + digit,
      'Appendicular', 'Hand phalanges', 'upper-limb', side);
    add('hand-distal-' + digit, 'distal phalanx of hand digit ' + digit,
      'Appendicular', 'Hand phalanges', 'upper-limb', side);
  }
  for (const [id, name] of [['femur', 'femur'], ['patella', 'patella'],
    ['tibia', 'tibia'], ['fibula', 'fibula']] as const) {
    add(id, name, 'Appendicular', 'Lower limb', 'lower-limb', side);
  }
  tarsals.forEach((id, index) => add(id, tarsalNames[index], 'Appendicular', 'Tarsal bones', 'lower-limb', side));
  for (let digit = 1; digit <= 5; digit++) {
    add('metatarsal-' + digit, 'metatarsal ' + digit, 'Appendicular', 'Metatarsals', 'lower-limb', side);
    add('foot-proximal-' + digit, 'proximal phalanx of foot digit ' + digit,
      'Appendicular', 'Toe phalanges', 'lower-limb', side);
    if (digit !== 1) add('foot-middle-' + digit, 'middle phalanx of foot digit ' + digit,
      'Appendicular', 'Toe phalanges', 'lower-limb', side);
    add('foot-distal-' + digit, 'distal phalanx of foot digit ' + digit,
      'Appendicular', 'Toe phalanges', 'lower-limb', side);
  }
}

export const skeletalStructures: readonly AtlasStructure[] = bones;
export const SKELETAL_ADULT_BONE_COUNT = 206;
export const SKELETAL_AXIAL_BONE_COUNT = 80;
export const SKELETAL_APPENDICULAR_BONE_COUNT = 126;

// Enforce catalog completeness independently of the diagram: even deeply
// positioned bones have an individual entry and must not be counted twice.
const unique = new Set(bones.map(bone => bone.id));
const axialCount = bones.filter(bone => bone.classification.startsWith('Axial')).length;
if (unique.size !== SKELETAL_ADULT_BONE_COUNT || bones.length !== SKELETAL_ADULT_BONE_COUNT
  || axialCount !== SKELETAL_AXIAL_BONE_COUNT
  || bones.length - axialCount !== SKELETAL_APPENDICULAR_BONE_COUNT) {
  throw new Error('Anatomy adult bone inventory is incomplete or has duplicate IDs.');
}
