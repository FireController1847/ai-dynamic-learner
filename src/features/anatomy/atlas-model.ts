// Anatomy data and diagram geometry are independent of the Vue viewer.
// Stable IDs may be referenced by several regional views, layers, or future assessments.
export type AtlasSystemId =
  | 'integumentary' | 'skeletal' | 'muscular' | 'nervous' | 'endocrine'
  | 'cardiovascular' | 'lymphatic' | 'respiratory' | 'digestive'
  | 'urinary' | 'reproductive';

export type AtlasOrientation =
  | 'anterior' | 'posterior' | 'left-lateral' | 'right-lateral' | 'superior' | 'inferior';

export interface AtlasSystem {
  id: AtlasSystemId;
  name: string;
  description: string;
}

export interface AtlasRegion {
  id: string;
  name: string;
  parentId?: string;
}

export interface AtlasSource {
  id: string;
  title: string;
  attribution: string;
  license: string;
  url?: string;
}

export interface AtlasStructure {
  id: string;
  systemId: AtlasSystemId;
  name: string;
  classification: string;
  regionIds: readonly string[];
  parentId?: string;
  latinName?: string;
  aliases?: readonly string[];
  description?: string;
  sourceIds?: readonly string[];
}

export interface AtlasView {
  id: string;
  systemId: AtlasSystemId;
  regionId: string;
  orientation: AtlasOrientation;
  name: string;
  width: number;
  height: number;
}

export interface AtlasLayer {
  id: string;
  viewId: string;
  name: string;
  order: number;
}

export type AtlasGeometry =
  | { kind: 'path'; d: string }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

export interface AtlasShape {
  id: string;
  layerId: string;
  structureId: string;
  geometry: AtlasGeometry;
  // Decorative etched lines and cutouts are drawn but never given selection
  // controls; they belong to the parent structure.
  renderMode?: 'filled' | 'stroke' | 'etch' | 'cutout';
  // Mirror the original vector shape across the current view width.
  mirrorX?: boolean;
}

export interface AtlasDataset {
  schemaVersion: 1;
  systems: readonly AtlasSystem[];
  regions: readonly AtlasRegion[];
  sources: readonly AtlasSource[];
  structures: readonly AtlasStructure[];
  views: readonly AtlasView[];
  layers: readonly AtlasLayer[];
  shapes: readonly AtlasShape[];
}
