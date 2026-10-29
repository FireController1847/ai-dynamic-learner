import type { AtlasShape, AtlasStructure, AtlasSystemId } from './atlas-model.ts';
import { parseAnatomyClassification } from './anatomy-structure-groups.ts';

// Eligibility is registered per anatomical system. Future packs can opt in
// without changing the session, scoring, or leader-line rendering.
export const identificationPacks: Partial<Record<AtlasSystemId, {
  label: string;
  pageSize: number;
}>> = {
  skeletal: { label: 'Bone identification', pageSize: 6 },
};

export interface IdentificationItem {
  id: string;
  name: string;
  classification: string;
  aliases: readonly string[];
}
export interface IdentificationPage {
  id: string;
  category: string;
  group: string;
  items: readonly IdentificationItem[];
}
export interface IdentificationSession {
  systemId: AtlasSystemId;
  pages: readonly IdentificationPage[];
  total: number;
}
export interface IdentificationSection {
  id: string;
  title: string;
  category: string;
  itemIds: readonly string[];
  count: number;
}
function skeletalSection(structure: AtlasStructure, group: string): string {
  if (group === 'Thoracic cage') {
    if (structure.id.endsWith('sternum')) return 'Sternum';
    const rib = /rib-(\d+)$/.exec(structure.id);
    return rib && Number(rib[1]) <= 6 ? 'Ribs 1–6' : 'Ribs 7–12';
  }
  if (group === 'Hand phalanges' || group === 'Toe phalanges') {
    if (/-(?:proximal)-/.test(structure.id)) return 'Proximal phalanges';
    if (/-(?:middle)-/.test(structure.id)) return 'Middle phalanges';
    return 'Distal phalanges';
  }
  if (group === 'Upper limb') {
    return structure.id.endsWith('humerus') ? 'Humerus' : 'Radius & ulna';
  }
  if (group === 'Lower limb') {
    return /(?:femur|patella)$/.test(structure.id) ? 'Femur & patella' : 'Tibia & fibula';
  }
  return group;
}

/** Sections follow authored classifications, splitting only unusually broad
 * skeletal classifications along anatomically meaningful subgroups. Whole
 * body / Both currently yields 27 focused groups plus All visible bones. */
export function createIdentificationSections(
  systemId: AtlasSystemId, structures: readonly AtlasStructure[],
  visibleShapes: readonly AtlasShape[],
): readonly IdentificationSection[] {
  if (!identificationPacks[systemId]) return [];
  const visible = new Set(visibleShapes
    .filter(shape => shape.renderMode !== 'etch' && shape.renderMode !== 'cutout')
    .map(shape => shape.structureId));
  const candidates = structures.filter(s => s.systemId === systemId && visible.has(s.id));
  if (!candidates.length) return [];
  const sections = new Map<string, { title: string; category: string; itemIds: string[] }>();
  for (const structure of candidates) {
    const parsed = parseAnatomyClassification(structure.classification);
    const original = parsed.subgroup ?? parsed.category;
    const title = systemId === 'skeletal' ? skeletalSection(structure, original) : original;
    const key = structure.classification + '::' + title;
    if (!sections.has(key)) {
      sections.set(key, { title, category: parsed.category, itemIds: [] });
    }
    sections.get(key)!.itemIds.push(structure.id);
  }
  return [
    { id: 'all', title: 'All visible structures', category: 'Complete review',
      itemIds: candidates.map(item => item.id), count: candidates.length },
    ...[...sections].map(([id, section]) => ({
      id, title: section.title, category: section.category,
      itemIds: section.itemIds, count: section.itemIds.length,
    })),
  ];
}

export function createIdentificationSession(
  systemId: AtlasSystemId, structures: readonly AtlasStructure[],
  visibleShapes: readonly AtlasShape[], selectedIds?: ReadonlySet<string>,
): IdentificationSession | null {
  const pack = identificationPacks[systemId];
  if (!pack) return null;
  const visible = new Set(visibleShapes
    .filter(shape => shape.renderMode !== 'etch' && shape.renderMode !== 'cutout')
    .map(shape => shape.structureId));
  const groups = new Map<string, IdentificationItem[]>();
  for (const structure of structures) {
    if (structure.systemId !== systemId || !visible.has(structure.id)
        || (selectedIds && !selectedIds.has(structure.id))) continue;
    const group = structure.classification;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push({
      id: structure.id, name: structure.name,
      classification: structure.classification,
      aliases: structure.aliases ?? [],
    });
  }
  const pages: IdentificationPage[] = [];
  for (const [classification, items] of groups) {
    const parsed = parseAnatomyClassification(classification);
    const category = parsed.subgroup ? parsed.category : systemId;
    const group = parsed.subgroup ?? parsed.category;
    for (let index = 0; index < items.length; index += pack.pageSize) {
      const part = items.slice(index, index + pack.pageSize);
      pages.push({ id: classification + ':' + index, category, group, items: part });
    }
  }
  return { systemId, pages, total: pages.reduce((sum, page) => sum + page.items.length, 0) };
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    .replace(/\b(?:bone|vertebra)\b/g, '').replace(/\s+/g, ' ').trim();
}

// Left/right is optional for identification: the leader line points at one
// specific side. Named bones must still distinguish digits and numbered ribs.
export function isIdentificationCorrect(item: IdentificationItem, attempt: string): boolean {
  const answer = normalize(attempt).replace(/^(left|right)\s+/, '');
  if (!answer) return false;
  const candidates = [item.name, ...item.aliases];
  for (const value of candidates) {
    const basic = value.replace(/^(left|right)\s+/i, '');
    const beforeParentheses = basic.split('(')[0].trim();
    const parenthetical = /\(([^)]+)\)/.exec(basic)?.[1];
    if ([basic, beforeParentheses, parenthetical].some(text =>
      text && normalize(text) === answer)) return true;
  }
  return false;
}
