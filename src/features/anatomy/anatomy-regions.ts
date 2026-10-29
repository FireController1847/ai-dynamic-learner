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
  // Keep the entire widened silhouette and the distal phalanges inside Fit.
  { id: 'whole-body', name: 'Whole body', x: 13, y: 12, width: 294, height: 660 },
  { id: 'head-neck', name: 'Head & neck', x: 112, y: 15, width: 96, height: 152 },
  { id: 'thorax', name: 'Chest & shoulders', x: 59, y: 128, width: 202, height: 148 },
  { id: 'spine', name: 'Spine', x: 125, y: 109, width: 70, height: 245 },
  { id: 'abdomen', name: 'Lower torso', x: 100, y: 233, width: 120, height: 110 },
  { id: 'pelvis', name: 'Pelvis', x: 83, y: 278, width: 154, height: 102 },
  { id: 'upper-limb', name: 'Arms', x: 14, y: 139, width: 292, height: 198 },
  { id: 'hands-wrists', name: 'Hands & wrists', x: 11, y: 303, width: 298, height: 86 },
  { id: 'lower-limb', name: 'Legs', x: 76, y: 326, width: 168, height: 285 },
  { id: 'feet-ankles', name: 'Feet & ankles', x: 72, y: 585, width: 176, height: 89 },
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


// CNS/PNS regional focus windows in the same 320 × 700 coordinate plane.
// A region never creates a duplicate or a new anatomical structure ID.
export const nervousRegions: readonly AnatomyRegion[] = [
  { id: 'whole-body', name: 'Whole body', x: 53, y: 12, width: 214, height: 657 },
  { id: 'head-neck', name: 'Brain & head', x: 112, y: 17, width: 96, height: 171 },
  { id: 'spine', name: 'Spinal cord', x: 137, y: 111, width: 46, height: 221 },
  { id: 'thorax', name: 'Chest nerves', x: 92, y: 128, width: 136, height: 144 },
  { id: 'abdomen', name: 'Abdomen', x: 102, y: 216, width: 116, height: 111 },
  { id: 'pelvis', name: 'Pelvis', x: 101, y: 271, width: 118, height: 104 },
  { id: 'upper-limb', name: 'Arms & hands', x: 48, y: 140, width: 224, height: 222 },
  { id: 'lower-limb', name: 'Legs & feet', x: 98, y: 310, width: 124, height: 344 },
];
export function nerveInRegion(structure: AtlasStructure, region: string): boolean {
  if (region === 'whole-body') return true;
  if (region === 'spine') {
    const id = structure.id.split('.').pop() ?? '';
    return ['cervical-cord', 'thoracic-cord', 'lumbosacral-cord',
      'cauda-equina'].includes(id);
  }
  return structure.regionIds.includes(region);
}


// Endocrine regions focus the deep-organ teaching projection at useful scales.
// The cervical and cranial structures intentionally have separate close-ups.
export const endocrineRegions: readonly AnatomyRegion[] = [
  { id: 'whole-body', name: 'Whole body', x: 53, y: 12, width: 214, height: 657 },
  { id: 'brain', name: 'Brain glands', x: 126, y: 37, width: 68, height: 72 },
  { id: 'neck', name: 'Thyroid & parathyroids', x: 133, y: 108, width: 54, height: 44 },
  { id: 'thorax', name: 'Chest', x: 129, y: 141, width: 62, height: 64 },
  { id: 'abdomen', name: 'Abdominal glands', x: 106, y: 232, width: 108, height: 84 },
  { id: 'pelvis', name: 'Gonads', x: 112, y: 307, width: 96, height: 99 },
];
export function endocrineInRegion(structure: AtlasStructure, region: string): boolean {
  return region === 'whole-body' || structure.regionIds.includes(region);
}


// Cardiovascular close-ups crop the shared whole-body teaching projection;
// each vascular record retains its canonical ID and orientation.
export const cardiovascularRegions: readonly AnatomyRegion[] = [
  { id: 'whole-body', name: 'Whole body', x: 53, y: 12, width: 214, height: 657 },
  { id: 'heart', name: 'Heart & coronary vessels', x: 131, y: 135, width: 71, height: 104 },
  { id: 'head-neck', name: 'Head & neck', x: 113, y: 28, width: 94, height: 142 },
  { id: 'thorax', name: 'Chest circulation', x: 89, y: 133, width: 142, height: 115 },
  { id: 'abdomen', name: 'Abdominal circulation', x: 105, y: 226, width: 110, height: 110 },
  { id: 'pelvis', name: 'Pelvic vessels', x: 104, y: 316, width: 112, height: 82 },
  { id: 'upper-limb', name: 'Arms & hands', x: 53, y: 148, width: 214, height: 207 },
  { id: 'lower-limb', name: 'Legs & feet', x: 98, y: 372, width: 124, height: 282 },
];
export function cardiovascularInRegion(structure: AtlasStructure, region: string): boolean {
  if (region === 'whole-body') return true;
  if (region === 'heart') {
    const id = structure.id.split('.').pop() ?? '';
    return structure.classification === 'Heart chamber'
      || structure.classification.startsWith('Coronary')
      || ['ascending-aorta', 'aortic-arch', 'pulmonary-trunk',
        'pulmonary-artery', 'superior-pulmonary-vein',
        'inferior-pulmonary-vein', 'superior-vena-cava',
        'coronary-sinus'].includes(id);
  }
  return structure.regionIds.includes(region);
}
