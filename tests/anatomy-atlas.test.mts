import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildAtlasIndex } from '../src/features/anatomy/atlas-index.ts';
import { foundationAtlas } from '../src/features/anatomy/atlas-catalog.ts';
import { skeletalShapes, SOURCE_MAPPED_BONE_IDS,
  SOURCE_UNMAPPED_BONE_IDS } from '../src/features/anatomy/source-skeletal-geometry.ts';
import { skeletalStructures } from '../src/features/anatomy/skeletal-bones.ts';

test('source-backed clinical paths reference valid canonical bones', () => {
 const index = buildAtlasIndex(foundationAtlas);
 for (const shape of skeletalShapes) {
  assert.equal(shape.sourceBacked, true);
  assert.ok(index.structures.has(shape.structureId), shape.structureId);
  assert.ok(index.layers.has(shape.layerId), shape.layerId);
  assert.match(shape.geometry.kind === 'path' ? shape.geometry.d : '', /[Mm]/);
 }
});
test('206 existing IDs are preserved; missing source geometry is not fabricated', () => {
 assert.equal(skeletalStructures.length, 206);
 assert.ok(SOURCE_MAPPED_BONE_IDS.size >= 170);
 assert.equal(SOURCE_UNMAPPED_BONE_IDS.length, 206 - SOURCE_MAPPED_BONE_IDS.size);
 for (const face of ['anterior','posterior'])
  assert.ok(new Set(skeletalShapes.filter(s => s.layerId.endsWith(face)).map(s => s.structureId)).size >= 165);
});
test('attributed anterior and posterior SVG assets ship offline', () => {
 for (const face of ['anterior','posterior']) {
  const svg = readFileSync(new URL('../src/assets/anatomy/clinical-' + face + '.svg', import.meta.url),'utf8');
  assert.ok(svg.length>100000);
  assert.match(svg, /<g id="bones-(ant|pos)"/);
  assert.doesNotMatch(svg, /<script\b/i);
 }
});
