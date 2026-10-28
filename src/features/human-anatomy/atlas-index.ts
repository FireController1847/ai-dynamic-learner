import type {
  AtlasDataset, AtlasLayer, AtlasRegion, AtlasShape, AtlasStructure, AtlasSystem,
  AtlasSystemId, AtlasView,
} from './atlas-model.ts';

export interface AtlasIndex {
  readonly systems: ReadonlyMap<AtlasSystemId, AtlasSystem>;
  readonly regions: ReadonlyMap<string, AtlasRegion>;
  readonly structures: ReadonlyMap<string, AtlasStructure>;
  readonly views: ReadonlyMap<string, AtlasView>;
  readonly layers: ReadonlyMap<string, AtlasLayer>;
  readonly shapesByView: ReadonlyMap<string, readonly AtlasShape[]>;
  readonly layersByView: ReadonlyMap<string, readonly AtlasLayer[]>;
}

function uniqueById<T extends { id: string }>(items: readonly T[], label: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (!item.id || map.has(item.id)) throw new Error('Invalid or duplicate ' + label + ' ID: ' + item.id);
    map.set(item.id, item);
  }
  return map;
}

function assertParentChains(items: ReadonlyMap<string, { parentId?: string }>, label: string) {
  for (const id of items.keys()) {
    const visited = new Set<string>();
    let current: string | undefined = id;
    while (current) {
      if (visited.has(current)) throw new Error('Cyclic ' + label + ' hierarchy: ' + id);
      visited.add(current);
      const entry: { parentId?: string } | undefined = items.get(current);
      if (!entry) throw new Error('Missing ' + label + ' reference: ' + current);
      current = entry.parentId;
    }
  }
}

// Validates authored packs before indexing. No arbitrary completeness limit:
// different body systems may have thousands of structures and regional views.
export function buildAtlasIndex(dataset: AtlasDataset): AtlasIndex {
  if (dataset.schemaVersion !== 1) throw new Error('Unsupported anatomy dataset schema.');
  const systems = uniqueById(dataset.systems, 'system') as Map<AtlasSystemId, AtlasSystem>;
  const regions = uniqueById(dataset.regions, 'region');
  const sources = uniqueById(dataset.sources, 'source');
  const structures = uniqueById(dataset.structures, 'structure');
  const views = uniqueById(dataset.views, 'view');
  const layers = uniqueById(dataset.layers, 'layer');
  uniqueById(dataset.shapes, 'shape');
  assertParentChains(regions, 'region');
  assertParentChains(structures, 'structure');

  for (const structure of dataset.structures) {
    if (!systems.has(structure.systemId)) throw new Error('Unknown system for ' + structure.id);
    if (!structure.name.trim() || !structure.classification.trim()) throw new Error('Incomplete structure: ' + structure.id);
    for (const regionId of structure.regionIds) {
      if (!regions.has(regionId)) throw new Error('Unknown region ' + regionId + ' for ' + structure.id);
    }
    for (const sourceId of structure.sourceIds ?? []) {
      if (!sources.has(sourceId)) throw new Error('Unknown source ' + sourceId + ' for ' + structure.id);
    }
    if (structure.parentId && structures.get(structure.parentId)?.systemId !== structure.systemId) {
      throw new Error('Invalid parent structure for ' + structure.id);
    }
  }

  for (const view of dataset.views) {
    if (!systems.has(view.systemId) || !regions.has(view.regionId)) throw new Error('Invalid view: ' + view.id);
    if (!(view.width > 0 && view.height > 0 && Number.isFinite(view.width) && Number.isFinite(view.height))) {
      throw new Error('Invalid view dimensions: ' + view.id);
    }
  }

  const layersByView = new Map<string, AtlasLayer[]>();
  for (const layer of dataset.layers) {
    if (!views.has(layer.viewId)) throw new Error('Invalid layer view: ' + layer.id);
    const group = layersByView.get(layer.viewId) ?? [];
    group.push(layer);
    layersByView.set(layer.viewId, group);
  }
  for (const group of layersByView.values()) group.sort((a, b) => a.order - b.order);

  const shapesByView = new Map<string, AtlasShape[]>();
  for (const shape of dataset.shapes) {
    const layer = layers.get(shape.layerId);
    const structure = structures.get(shape.structureId);
    if (!layer || !structure) throw new Error('Invalid diagram shape: ' + shape.id);
    const view = views.get(layer.viewId);
    if (!view || view.systemId !== structure.systemId) throw new Error('Shape system mismatch: ' + shape.id);
    if (shape.geometry.kind === 'path' && !shape.geometry.d.trim()) throw new Error('Empty path: ' + shape.id);
    if (shape.geometry.kind === 'ellipse' &&
      (![shape.geometry.cx, shape.geometry.cy, shape.geometry.rx, shape.geometry.ry].every(Number.isFinite)
        || shape.geometry.rx <= 0 || shape.geometry.ry <= 0)) throw new Error('Invalid ellipse: ' + shape.id);
    const group = shapesByView.get(view.id) ?? [];
    group.push(shape);
    shapesByView.set(view.id, group);
  }

  return { systems, regions, structures, views, layers, shapesByView, layersByView };
}

export function searchStructures(index: AtlasIndex, query: string, systemId: AtlasSystemId): AtlasStructure[] {
  const term = query.trim().toLocaleLowerCase();
  return [...index.structures.values()]
    .filter(structure => structure.systemId === systemId &&
      (!term || [structure.name, structure.latinName ?? '', structure.classification,
        ...(structure.aliases ?? [])].some(value => value.toLocaleLowerCase().includes(term))))
    .sort((a, b) => a.name.localeCompare(b.name));
}
