import { isValidId } from '../../core/ids.js';
import { MAX_CARDS } from '../../features/index-cards/card-model.js';
import { validateDisplayOptions } from '../../features/index-cards/display-options.js';
import {
  MAX_DEPTH,
  MAX_ITEMS,
} from '../../features/index-cards/tree-model.js';
import {
  asObject,
  claimId,
  optionalDisplay,
  recoverName,
} from './shared.js';

export function migrateLegacyIndexCards(raw, report) {
  const ids = new Set();
  const setIdMap = new Map();
  let itemCount = 0;
  let cardCount = 0;

  function recoverCard(entry) {
    if (cardCount >= MAX_CARDS) {
      report.skipped += 1;
      return null;
    }
    const source = asObject(entry);
    if (!source || typeof source.front !== 'string' || typeof source.back !== 'string' ||
        source.front.length > 2000 || source.back.length > 2000) {
      report.skipped += 1;
      return null;
    }

    const card = {
      id: claimId(source.id, ids, report),
      front: source.front,
      back: source.back,
    };
    for (const key of ['title', 'backTitle']) {
      if (!Object.hasOwn(source, key)) continue;
      if (typeof source[key] === 'string' && source[key].length <= 120) card[key] = source[key];
      else report.repaired += 1;
    }
    cardCount += 1;
    report.recovered += 1;
    return card;
  }

  function visit(list, depth = 1) {
    if (!Array.isArray(list)) return [];
    if (depth > MAX_DEPTH) {
      report.skipped += list.length;
      return [];
    }

    return list.flatMap((entry) => {
      const source = asObject(entry);
      if (!source) {
        report.skipped += 1;
        return [];
      }

      let kind = source.kind;
      if (!['group', 'set'].includes(kind)) {
        if (Array.isArray(source.children)) kind = 'group';
        else if (Array.isArray(source.cards)) kind = 'set';
      }
      if (!['group', 'set'].includes(kind) || itemCount >= MAX_ITEMS) {
        report.skipped += 1;
        return [];
      }

      itemCount += 1;
      const id = claimId(source.id, ids, report);
      report.recovered += 1;
      if (kind === 'group') {
        return [{
          id,
          kind: 'group',
          name: recoverName(source.name, 'Recovered group', report),
          children: visit(source.children, depth + 1),
        }];
      }

      if (isValidId(source.id) && !setIdMap.has(source.id)) setIdMap.set(source.id, id);
      return [{
        id,
        kind: 'set',
        name: recoverName(source.name, 'Recovered set', report),
        cards: Array.isArray(source.cards)
          ? source.cards.map(recoverCard).filter(Boolean)
          : [],
      }];
    });
  }

  raw = asObject(raw) ?? {};
  const result = { items: visit(raw.items) };
  if (Object.hasOwn(raw, 'display')) {
    const display = optionalDisplay(raw.display, validateDisplayOptions, report);
    if (display) result.display = display;
  }
  if (Object.hasOwn(raw, 'lastSelectedSetId')) {
    result.lastSelectedSetId = setIdMap.get(raw.lastSelectedSetId) ?? null;
    if (raw.lastSelectedSetId !== null && result.lastSelectedSetId === null) {
      report.repaired += 1;
    }
  }
  return result;
}
