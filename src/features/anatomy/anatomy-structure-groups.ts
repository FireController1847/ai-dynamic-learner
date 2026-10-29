import type { AtlasStructure } from './atlas-model.ts';

// Shared by the Structures index and Fill in the Blanks. A classification
// such as "Axial skeleton · Cervical vertebrae" defines two hierarchy levels;
// single-level classifications remain first-class groups rather than
// receiving an invented anatomical subgroup.
export function parseAnatomyClassification(classification: string) {
  const parts = classification.split(' · ').map(part => part.trim()).filter(Boolean);
  return {
    category: parts[0] ?? classification,
    subgroup: parts.length > 1 ? parts.slice(1).join(' · ') : null,
  };
}

export interface StructureSubgroup {
  name: string;
  structures: readonly AtlasStructure[];
}
export interface StructureCategory {
  name: string;
  direct: readonly AtlasStructure[];
  subgroups: readonly StructureSubgroup[];
  count: number;
}

export function groupAnatomyStructures(structures: readonly AtlasStructure[]): readonly StructureCategory[] {
  const categories = new Map<string, {
    direct: AtlasStructure[];
    subgroups: Map<string, AtlasStructure[]>;
    count: number;
  }>();
  for (const structure of structures) {
    const { category, subgroup } = parseAnatomyClassification(structure.classification);
    let section = categories.get(category);
    if (!section) {
      section = { direct: [], subgroups: new Map(), count: 0 };
      categories.set(category, section);
    }
    section.count++;
    if (!subgroup) {
      section.direct.push(structure);
    } else {
      let items = section.subgroups.get(subgroup);
      if (!items) { items = []; section.subgroups.set(subgroup, items); }
      items.push(structure);
    }
  }
  return [...categories].map(([name, value]) => ({
    name,
    direct: value.direct,
    subgroups: [...value.subgroups].map(([subgroup, items]) => ({
      name: subgroup, structures: items,
    })),
    count: value.count,
  }));
}
