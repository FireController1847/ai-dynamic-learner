import { skeletalStructures } from './skeletal-bones.ts';

/**
 * Contract for the future source-backed skeletal atlas. This does NOT render
 * or certify anatomy. Meshes must be acquired from attributed source data,
 * reviewed, and packaged locally before enabling the replacement viewer.
 */
export interface SkeletalMeshSource {
  id: string;
  title: string;
  version: string;
  creator: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  modifications: string;
}

export interface SkeletalBoneMesh {
  /** Stable ID already used by Anatomy identification history and UI. */
  boneId: string;
  sourceId: string;
  /** Unique named meshes within the packaged asset (one-to-many is allowed). */
  meshNames: readonly string[];
}

export interface SkeletalMeshManifest {
  schemaVersion: 1;
  /** Path relative to the packaged application, never a runtime CDN. */
  assetPath: string;
  /** SHA-256 hex of the verified, locally bundled GLB. */
  sha256: string;
  /** Document the coordinate system used by the export. */
  axisConvention: 'y-up-anterior-positive-z';
  sources: readonly SkeletalMeshSource[];
  bones: readonly SkeletalBoneMesh[];
}

export const skeletalBoneIds: ReadonlySet<string> = new Set(
  skeletalStructures.map(bone => bone.id),
);

/**
 * The 206-bone catalogue is a *necessary* mapping test, not a morphology test.
 * Only a second, manual visual and anatomical review can accept a replacement.
 */
export function validateSkeletalMeshManifest(value: SkeletalMeshManifest): void {
  if (value.schemaVersion !== 1 || value.axisConvention !== 'y-up-anterior-positive-z') {
    throw new Error('The source-backed skeletal manifest has an unsupported format.');
  }
  if (!/^assets\/anatomy\/[a-z0-9/_-]+\.glb$/i.test(value.assetPath) ||
      value.assetPath.includes('..') || !/^[0-9a-f]{64}$/i.test(value.sha256)) {
    throw new Error('Skeletal meshes must be verified and bundled locally.');
  }
  if (!value.sources.length) throw new Error('Missing skeletal source attribution.');
  const sources = new Set<string>();
  for (const source of value.sources) {
    if (!source.id || sources.has(source.id) || !source.title || !source.version ||
        !source.creator || !source.license || !source.licenseUrl.startsWith('https://') ||
        !source.sourceUrl.startsWith('https://') || !source.modifications.trim()) {
      throw new Error('The skeletal source provenance is incomplete or duplicated.');
    }
    sources.add(source.id);
  }

  const mapped = new Set<string>();
  const meshes = new Set<string>();
  for (const binding of value.bones) {
    if (!skeletalBoneIds.has(binding.boneId) || mapped.has(binding.boneId) ||
        !sources.has(binding.sourceId) || !binding.meshNames.length) {
      throw new Error('Missing, duplicate, or unknown skeletal bone mapping: ' + binding.boneId);
    }
    mapped.add(binding.boneId);
    for (const name of binding.meshNames) {
      if (!name.trim() || meshes.has(name)) {
        throw new Error('Every bone must own identifiable, non-shared mesh geometry: ' + name);
      }
      meshes.add(name);
    }
  }
  const missing = [...skeletalBoneIds].filter(id => !mapped.has(id));
  if (missing.length) {
    throw new Error('Missing source-backed skeletal meshes (' + missing.length + '): ' +
      missing.join(', '));
  }
}
