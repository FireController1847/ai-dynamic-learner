import type { AtlasStructure } from './atlas-model.ts';

export type AnatomyFacing = 'both' | 'front' | 'back';

export interface AnatomyRegion {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const skeletalRegions: readonly AnatomyRegion[] = [
  { id: 'whole-body', name: 'Whole body', x: 56, y: 12, width: 208, height: 660 },
  { id: 'head-neck', name: 'Head & neck', x: 119, y: 15, width: 82, height: 152 },
  { id: 'thorax', name: 'Chest & shoulders', x: 88, y: 128, width: 144, height: 143 },
  { id: 'spine', name: 'Spine', x: 128, y: 109, width: 64, height: 245 },
  { id: 'abdomen', name: 'Lower torso', x: 105, y: 233, width: 110, height: 109 },
  { id: 'pelvis', name: 'Pelvis', x: 98, y: 278, width: 124, height: 92 },
  { id: 'upper-limb', name: 'Arms', x: 47, y: 139, width: 226, height: 193 },
  { id: 'hands-wrists', name: 'Hands & wrists', x: 44, y: 301, width: 232, height: 83 },
  { id: 'lower-limb', name: 'Legs', x: 98, y: 322, width: 124, height: 287 },
  { id: 'feet-ankles', name: 'Feet & ankles', x: 95, y: 587, width: 130, height: 87 },
];

// A bone may be relevant to several regional scopes; IDs are not duplicated.
// Regional viewports are focused crops of the canonical whole-body drawings,
// not transformed duplicates of the skeleton.
export function boneInRegion(bone: AtlasStructure, region: string): boolean {
  if (region === 'whole-body') return true;
  const code = bone.id.split('.').pop() ?? '';
  const group = bone.classification;
  if (region === 'spine') {
    return /^([ctl]\d+|sacrum|coccyx)$/.test(code);
  }
  if (region === 'hands-wrists') {
    return /Carpal bones|Metacarpals|Hand phalanges/.test(group);
  }
  if (region === 'feet-ankles') {
    return /Tarsal bones|Metatarsals|Toe phalanges/.test(group);
  }
  if (region === 'upper-limb') return ['humerus', 'radius', 'ulna'].includes(code);
  if (region === 'lower-limb') return ['femur', 'patella', 'tibia', 'fibula'].includes(code);
  if (region === 'thorax') {
    return bone.regionIds.includes('thorax')
      || code === 'scapula' || /^t\d+$/.test(code);
  }
  if (region === 'abdomen') return /^l\d+$/.test(code)
    || /^rib-(10|11|12)$/.test(code);
  if (region === 'pelvis') return bone.regionIds.includes('pelvis');
  return bone.regionIds.includes(region);
}

// Whole-body "Both" is an atlas/X-ray teaching overlay. Front and Back
// are surface-oriented diagrams: remove outlines that would ordinarily be
// hidden from that direction instead of pretending every deep bone is visible.
// These rules deliberately err toward concealing inaccessible deep structures;
// detailed cutaway views will be required for medical-grade fidelity.
export function boneVisibleFrom(bone: AtlasStructure, facing: AnatomyFacing): boolean {
  if (facing === 'both') return true;
  const code = bone.id.split('.').pop() ?? '';
  const group = bone.classification;
  if (/Auditory ossicles/.test(group)) return false;
  if (facing === 'front') {
    if (['occipital', 'scapula', 'calcaneus', 'palatine', 'sphenoid', 'ethmoid',
      'vomer', 'coccyx'].includes(code)) return false;
    if (/^([ctl]\d+)$/.test(code)) return false;
    if (['sacrum', 'triquetrum'].includes(code)) return false;
    // Palatine bones and other deep cranial structures are not exposed
    // by a simple anterior orthographic projection.
    return true;
  }
  if (['frontal', 'mandible', 'vomer', 'hyoid', 'sternum', 'clavicle',
    'patella', 'sphenoid', 'ethmoid'].includes(code)) return false;
  if (/Facial bones/.test(group)) return false;
  if (code === 'pisiform') return false;
  return true;
}

// Major superficial-muscle regional views use the same 320 × 700 artwork as
// Skeletal. Detailed intrinsic hand/foot musculature will need dedicated plates.
export const muscularRegions: readonly AnatomyRegion[] = [
  { id: 'whole-body', name: 'Whole body', x: 53, y: 12, width: 214, height: 657 },
  { id: 'head-neck', name: 'Head & neck', x: 113, y: 18, width: 94, height: 127 },
  { id: 'thorax', name: 'Chest & shoulders', x: 88, y: 132, width: 144, height: 132 },
  { id: 'spine', name: 'Back', x: 99, y: 115, width: 122, height: 198 },
  { id: 'abdomen', name: 'Abdomen', x: 101, y: 208, width: 118, height: 112 },
  { id: 'pelvis', name: 'Hips & glutes', x: 102, y: 286, width: 116, height: 92 },
  { id: 'upper-limb', name: 'Arms & forearms', x: 50, y: 141, width: 220, height: 191 },
  { id: 'lower-limb', name: 'Thighs & lower legs', x: 98, y: 317, width: 124, height: 293 },
];

// Only include muscles with artwork that can plausibly appear within the crop;
// a whole-body muscle may belong to several regions but never duplicates IDs.
export function muscleInRegion(muscle: AtlasStructure, region: string): boolean {
  if (region === 'whole-body') return true;
  if (region === 'spine') {
    return muscle.regionIds.includes('back') || muscle.id.endsWith('trapezius');
  }
  return muscle.regionIds.includes(region);
}
