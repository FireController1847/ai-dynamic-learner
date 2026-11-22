import { isRecord } from './validation.ts';

export type AiSourceUnitKind = 'module' | 'chapter' | 'section' | 'unit';
/** AI-reported source provenance. No unit is inferred by the importer. */
export interface AiSourceUnit {
  kind: AiSourceUnitKind;
  title: string;
  itemNumbers: number[];
  missingTopics: string[];
}

export const AI_SOURCE_UNITS_PROMPT = `EXPLICIT SOURCE UNITS: If and ONLY if the source itself has labeled modules, chapters, sections, or units, preserve their original names and order. Work SEQUENTIALLY, completing each unit's content before the next; never mix or reorder the output items between units. Include top-level "sourceUnits": [{"kind":"chapter","title":"Exact original chapter title","itemNumbers":[1,2],"missingTopics":[]}]. itemNumbers are 1-based positions in the generated questions, cards, sections, topics, words or entries array. Map each generated item to exactly one original unit, including nested original units at their most useful level (avoid duplicating nested chapters and sections). List omitted/partially covered topics in missingTopics; [] means no known gaps, not verified completeness. For units without a generated item, include itemNumbers:[] and specific missingTopics. Never invent chapter names. If the source has no explicit labeled units, OMIT sourceUnits or return []; keep the normal overall coverage view. If output must be resumed, continue from the last INCOMPLETE unit and do not repeat completed earlier units. Check ordering and all item references before returning JSON. Source-unit coverage is AI-reported, not independently verified; do not claim it represents study progress.`;

const KINDS: readonly AiSourceUnitKind[] = ['module', 'chapter', 'section', 'unit'];

export function parseAiSourceUnits(value: unknown, count: number): AiSourceUnit[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100) throw new Error('sourceUnits must be an array of up to 100 explicitly named units.');
  if (!value.length) return undefined;
  const seen = new Set<string>();
  const used = new Set<number>();
  let last = 0;
  const units: AiSourceUnit[] = [];
  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry) ||
        Object.keys(entry).some(key => !['kind', 'title', 'itemNumbers', 'missingTopics'].includes(key)) ||
        typeof entry.title !== 'string' || !entry.title.trim() || entry.title.trim().length > 120 ||
        !KINDS.some(kind => kind === entry.kind) ||
        !Array.isArray(entry.itemNumbers) || entry.itemNumbers.length > count ||
        entry.itemNumbers.some(n => !Number.isInteger(n) || n < 1 || n > count) ||
        (entry.missingTopics !== undefined && (!Array.isArray(entry.missingTopics) ||
          entry.missingTopics.length > 100 ||
          entry.missingTopics.some(topic => typeof topic !== 'string' || !topic.trim() || topic.length > 160)))) {
      throw new Error('Source unit ' + (index + 1) + ' needs a source-defined kind, title, valid item numbers, and optional missing topics.');
    }
    const title = entry.title.trim();
    const name = title.toLocaleLowerCase();
    if (seen.has(name)) throw new Error('Two source units use the same title: ' + title);
    seen.add(name);
    const numbers: number[] = entry.itemNumbers;
    for (const n of numbers) {
      if (used.has(n) || n <= last) throw new Error('Source units must reference content sequentially without repeating items.');
      last = n; used.add(n);
    }
    units.push({
      kind: entry.kind as AiSourceUnitKind, title,
      itemNumbers: [...numbers],
      missingTopics: entry.missingTopics === undefined ? [] : (entry.missingTopics as string[]).map(s => s.trim()),
    });
  }
  if (used.size !== count) throw new Error('Each generated item must be assigned to one source unit; ' +
    (count - used.size) + ' item(s) have no unit.');
  return units;
}

/** Adapt an AI-declared, sequential per-unit count without guessing from question text.
 * If counts are absent or inconsistent, skip mapping rather than invent provenance. */
export function recoverAiSourceUnits(value: unknown, count: number): {
  units?: AiSourceUnit[]; notice?: string; problem?: string;
} {
  try { return { units: parseAiSourceUnits(value, count) }; }
  catch (error) {
    const problem = error instanceof Error ? error.message : String(error);
    if (!Array.isArray(value) || !value.length || value.length > 100 ||
        !value.every(entry => isRecord(entry) && typeof entry.title === 'string' &&
          Number.isSafeInteger(entry.questionCount) && (entry.questionCount as number) >= 0)) {
      return { problem };
    }
    const total = value.reduce((sum, entry) => sum + Number(entry.questionCount), 0);
    if (total !== count) return { problem: 'The AI-reported unit counts do not total ' + count + ' accepted items.' };
    let offset = 0;
    const units = value.map(entry => {
      const n = Number(entry.questionCount);
      const mapping = {
        kind: KINDS.includes(entry.kind as AiSourceUnitKind) ? entry.kind : 'unit',
        title: entry.title,
        itemNumbers: Array.from({ length: n }, (_, index) => offset + index + 1),
        missingTopics: entry.missingTopics ?? [],
      };
      offset += n;
      return mapping;
    });
    try {
      return {
        units: parseAiSourceUnits(units, count),
        notice: 'Recovered chapter mapping from AI-reported sequential item counts. These links are not independently verified.',
      };
    } catch { return { problem }; }
  }
}

export function validateSavedSourceUnits(value: unknown): asserts value is AiSourceUnit[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Invalid saved source units.');
  const seen = new Set<string>();
  for (const unit of value) {
    if (!isRecord(unit) || Object.keys(unit).some(key => !['kind', 'title', 'itemNumbers', 'missingTopics'].includes(key)) ||
        !KINDS.some(kind => kind === unit.kind) ||
        typeof unit.title !== 'string' || !unit.title.trim() || unit.title.length > 120 ||
        !Array.isArray(unit.itemNumbers) || unit.itemNumbers.some(n => !Number.isInteger(n) || n < 1 || n > 10000) ||
        !Array.isArray(unit.missingTopics) || unit.missingTopics.some(s => typeof s !== 'string' || !s.trim() || s.length > 160) ||
        seen.has(unit.title.toLowerCase())) {
      throw new Error('A saved source unit has invalid metadata.');
    }
    seen.add(unit.title.toLowerCase());
  }
}
