import { isValidId } from '../../core/ids.js';
import {
  DEFAULT_DOCUMENT_TYPE,
  isDocumentType,
  validateDocumentData,
} from '../../features/notebook/document-types.js';
import {
  MAX_DEPTH,
  MAX_DOCUMENTS,
  MAX_ITEMS,
} from '../../features/notebook/library-model.js';
import { asObject, claimId, recoverName } from './shared.js';

export function migrateLegacyNotebook(raw, report) {
  const ids = new Set();
  const documentIdMap = new Map();
  let itemCount = 0;
  let documentCount = 0;

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
      if (!['group', 'document'].includes(kind)) {
        if (Array.isArray(source.children)) kind = 'group';
        else if (Object.hasOwn(source, 'markdown') || Object.hasOwn(source, 'data') ||
            Object.hasOwn(source, 'type')) kind = 'document';
      }
      if (!['group', 'document'].includes(kind)) {
        report.skipped += 1;
        return [];
      }

      if (kind === 'group') {
        if (itemCount >= MAX_ITEMS) {
          report.skipped += 1;
          return [];
        }
        itemCount += 1;
        const id = claimId(source.id, ids, report);
        report.recovered += 1;
        return [{
          id,
          kind: 'group',
          name: recoverName(source.name, 'Recovered group', report),
          children: visit(source.children, depth + 1),
        }];
      }

      if (itemCount >= MAX_ITEMS || documentCount >= MAX_DOCUMENTS) {
        report.skipped += 1;
        return [];
      }

      let type = source.type;
      let data = asObject(source.data);
      if (!Object.hasOwn(source, 'type') && !Object.hasOwn(source, 'data') &&
          typeof source.markdown === 'string') {
        type = DEFAULT_DOCUMENT_TYPE;
        data = { markdown: source.markdown };
        report.repaired += 1;
      }
      if (type === 'grid' && data && !Object.keys(data).length) {
        type = 'graph';
        report.repaired += 1;
      }
      if (!isDocumentType(type)) {
        report.skipped += 1;
        return [];
      }
      try {
        validateDocumentData(type, data);
      } catch {
        report.skipped += 1;
        return [];
      }

      itemCount += 1;
      documentCount += 1;
      const id = claimId(source.id, ids, report);
      if (isValidId(source.id) && !documentIdMap.has(source.id)) documentIdMap.set(source.id, id);
      report.recovered += 1;
      return [{
        id,
        kind: 'document',
        name: recoverName(source.name, 'Recovered document', report),
        type,
        data,
      }];
    });
  }

  raw = asObject(raw) ?? {};
  const result = { items: visit(raw.items) };
  if (Object.hasOwn(raw, 'lastSelectedDocumentId')) {
    result.lastSelectedDocumentId = documentIdMap.get(raw.lastSelectedDocumentId) ?? null;
    if (raw.lastSelectedDocumentId !== null && result.lastSelectedDocumentId === null) {
      report.repaired += 1;
    }
  }
  return result;
}
