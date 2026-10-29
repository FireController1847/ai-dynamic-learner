import assert from 'node:assert/strict';
import test from 'node:test';
import { skeletalStructures } from '../src/features/anatomy/skeletal-bones.ts';
import { validateSkeletalMeshManifest, type SkeletalMeshManifest } from
  '../src/features/anatomy/skeletal-mesh-contract.ts';

// Synthetic data verifies the importer contract only. It is NOT an anatomy
// model, a source asset, or an indication that morphology has been reviewed.
const example = (): SkeletalMeshManifest => ({
  schemaVersion: 1,
  assetPath: 'assets/anatomy/source-backed-skeleton.glb',
  sha256: '0'.repeat(64),
  axisConvention: 'y-up-anterior-positive-z',
  sources: [{
    id: 'example', title: 'Synthetic test fixture', version: '0', creator: 'Test',
    license: 'Testing only', licenseUrl: 'https://example.org/license',
    sourceUrl: 'https://example.org/source', modifications: 'None; tests only',
  }],
  bones: skeletalStructures.map(bone => ({
    boneId: bone.id, sourceId: 'example', meshNames: ['mesh-' + bone.id],
  })),
});

test('a complete mapping preserves all 206 stable Anatomy bone identifiers', () => {
  assert.equal(example().bones.length, 206);
  assert.doesNotThrow(() => validateSkeletalMeshManifest(example()));
});

test('an incomplete imported model cannot masquerade as a complete skeleton', () => {
  const manifest = example();
  const missing = manifest.bones.find(bone => bone.boneId.endsWith('.coccyx'));
  assert.ok(missing);
  assert.throws(() => validateSkeletalMeshManifest({
    ...manifest, bones: manifest.bones.filter(bone => bone !== missing),
  }), /Missing source-backed skeletal meshes.*coccyx/);
});

test('one mesh cannot stand in for two independent bones', () => {
  const manifest = example();
  const [first, second] = manifest.bones;
  assert.ok(first && second);
  assert.throws(() => validateSkeletalMeshManifest({
    ...manifest, bones: manifest.bones.map(bone => bone === second
      ? { ...bone, meshNames: first.meshNames } : bone),
  }), /non-shared mesh geometry/);
});

test('the skeletal mesh must be a locally packaged verified asset', () => {
  const manifest = example();
  assert.throws(() => validateSkeletalMeshManifest({
    ...manifest, assetPath: 'https://cdn.example.org/skeleton.glb',
  }), /bundled locally/);
});

test('source licenses and modifications must be attributed', () => {
  const manifest = example();
  assert.throws(() => validateSkeletalMeshManifest({
    ...manifest, sources: [{ ...manifest.sources[0]!, modifications: '' }],
  }), /source provenance/);
});
