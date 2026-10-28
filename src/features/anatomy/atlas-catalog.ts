import type { AtlasDataset, AtlasOrientation, AtlasSystem, AtlasRegion } from './atlas-model.ts';
import { skeletalLayers, skeletalShapes, skeletalStructures } from './skeletal-outline.ts';

// These are navigational categories, not claims that their anatomical content
// is complete. Structure data and diagram paths are added in separate, reviewed packs.
export const atlasSystems: readonly AtlasSystem[] = [
  { id: 'integumentary', name: 'Integumentary', description: 'Skin and its associated structures.' },
  { id: 'skeletal', name: 'Skeletal', description: 'Bones, cartilage, joints, and ligaments.' },
  { id: 'muscular', name: 'Muscular', description: 'Skeletal muscles and associated tendons.' },
  { id: 'nervous', name: 'Nervous', description: 'The brain, spinal cord, and peripheral nerves.' },
  { id: 'endocrine', name: 'Endocrine', description: 'Glands and hormone-producing tissues.' },
  { id: 'cardiovascular', name: 'Cardiovascular', description: 'The heart and blood vessels.' },
  { id: 'lymphatic', name: 'Lymphatic and immune', description: 'Lymphatic vessels, nodes, and immune organs.' },
  { id: 'respiratory', name: 'Respiratory', description: 'Airways and organs of gas exchange.' },
  { id: 'digestive', name: 'Digestive', description: 'The gastrointestinal tract and accessory organs.' },
  { id: 'urinary', name: 'Urinary', description: 'Kidneys and urinary drainage structures.' },
  { id: 'reproductive', name: 'Reproductive', description: 'Reproductive organs and associated structures.' },
];

export const atlasRegions: readonly AtlasRegion[] = [
  { id: 'whole-body', name: 'Whole body' },
  { id: 'head-neck', name: 'Head and neck', parentId: 'whole-body' },
  { id: 'thorax', name: 'Thorax', parentId: 'whole-body' },
  { id: 'abdomen', name: 'Abdomen', parentId: 'whole-body' },
  { id: 'pelvis', name: 'Pelvis', parentId: 'whole-body' },
  { id: 'back', name: 'Back', parentId: 'whole-body' },
  { id: 'upper-limb', name: 'Upper limb', parentId: 'whole-body' },
  { id: 'lower-limb', name: 'Lower limb', parentId: 'whole-body' },
];

const orientations: readonly { id: AtlasOrientation; name: string }[] = [
  { id: 'anterior', name: 'Front' },
  { id: 'posterior', name: 'Back' },
];

// Bundled, versioned reference material. The skeletal view is a deliberately
// simplified original outline, not a medically validated full-body diagram.
export const foundationAtlas: AtlasDataset = {
  schemaVersion: 1,
  systems: atlasSystems,
  regions: atlasRegions,
  sources: [],
  structures: skeletalStructures,
  views: atlasSystems.flatMap(system => orientations.map(orientation => ({
    id: system.id + '.whole-body.' + orientation.id,
    systemId: system.id,
    regionId: 'whole-body',
    orientation: orientation.id,
    name: system.name + ' — ' + orientation.name,
    width: 320,
    // The skeletal artwork now extends through anatomically longer lower limbs.
    // Keep unillustrated system placeholders at their existing proportions.
    height: system.id === 'skeletal' ? 660 : 560,
  }))),
  layers: skeletalLayers,
  shapes: skeletalShapes,
};
