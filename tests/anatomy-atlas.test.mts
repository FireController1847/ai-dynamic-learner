import assert from 'node:assert/strict';
import test from 'node:test';
import { foundationAtlas } from '../src/features/anatomy/atlas-catalog.ts';
import { buildAtlasIndex } from '../src/features/anatomy/atlas-index.ts';
import { SKELETAL_ADULT_BONE_COUNT } from '../src/features/anatomy/skeletal-bones.ts';

test('every bundled anatomy shape references a valid structure and layer', () => {
  // This is a runtime content check. TypeScript and webpack cannot detect
  // authored SVGs that refer to missing bone IDs during module initialization.
  const index = buildAtlasIndex(foundationAtlas);
  for (const shape of foundationAtlas.shapes) {
    assert.ok(index.structures.has(shape.structureId),
      `Shape ${shape.id} references missing structure ${shape.structureId}`);
    assert.ok(index.layers.has(shape.layerId),
      `Shape ${shape.id} references missing layer ${shape.layerId}`);
  }
});

test('both skeletal projections preserve all 206 individually identifiable bones', () => {
  const index = buildAtlasIndex(foundationAtlas);
  const ids = [...index.structures.values()]
    .filter(structure => structure.systemId === 'skeletal').map(structure => structure.id);
  assert.equal(ids.length, SKELETAL_ADULT_BONE_COUNT);
  for (const orientation of ['anterior', 'posterior']) {
    const shapes = index.shapesByView.get(`skeletal.whole-body.${orientation}`) ?? [];
    const drawable = new Set(shapes
      .filter(shape => shape.renderMode !== 'etch' && shape.renderMode !== 'cutout')
      .map(shape => shape.structureId));
    for (const id of ids) {
      assert.ok(drawable.has(id), `Missing ${orientation} selectable shape for ${id}`);
    }
  }
});
