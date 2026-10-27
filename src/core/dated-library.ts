import { isRecord } from './validation.ts';

export interface DatedLibraryRecord { id: string; name: string; createdAt: string }
export interface Expiry { amount: number; unit: 'days' | 'weeks' | 'months' }
export interface LibrarySettings { order: 'newest' | 'oldest'; dates: 'long' | 'short'; expiry?: Expiry | null }
export function expirySetting(settings: LibrarySettings): Expiry | null { return settings.expiry === undefined ? { amount: 1, unit: 'months' } : settings.expiry; }
export function expiryLabel(settings: LibrarySettings): string {
  const expiry = expirySetting(settings);
  return expiry ? `${expiry.amount} ${expiry.amount === 1 ? expiry.unit.slice(0, -1) : expiry.unit} before archive` : 'No automatic expiry';
}
export function defaultLibrarySettings(): LibrarySettings { return { order: 'newest', dates: 'long', expiry: { amount: 1, unit: 'months' } }; }

/** UTC expiry; calendar months clamp at month-end, and disabled expiry is infinite. */
export function archiveTime(item: DatedLibraryRecord, settings = defaultLibrarySettings()): number {
  const expiry = expirySetting(settings);
  if (expiry === null) return Infinity;
  const created = new Date(item.createdAt);
  if (expiry.unit !== 'months') {
    created.setUTCDate(created.getUTCDate() + expiry.amount * (expiry.unit === 'weeks' ? 7 : 1));
    return created.getTime();
  }
  const month = created.getUTCMonth() + expiry.amount;
  const monthEnd = new Date(created);
  monthEnd.setUTCDate(1);
  monthEnd.setUTCMonth(month + 1);
  monthEnd.setUTCDate(0);
  const lastDay = monthEnd.getUTCDate();
  const result = new Date(created);
  result.setUTCDate(1);
  result.setUTCMonth(month);
  result.setUTCDate(Math.min(created.getUTCDate(), lastDay));
  return result.getTime();
}
export function isArchived(item: DatedLibraryRecord, now: number, settings = defaultLibrarySettings()): boolean { return now >= archiveTime(item, settings); }
export function ageProgress(item: DatedLibraryRecord, now: number, settings = defaultLibrarySettings()): number {
  const start = Date.parse(item.createdAt);
  return Math.min(1, Math.max(0, (now - start) / (archiveTime(item, settings) - start)));
}
export function orderedDatedItems<T extends DatedLibraryRecord>(items: readonly T[], settings: LibrarySettings): T[] {
  return [...items].sort((a, b) => {
    const order = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return (settings.order === 'newest' ? -order : order) || a.id.localeCompare(b.id);
  });
}
export function validateLibrarySettings(value: unknown): asserts value is LibrarySettings {
  if (!isRecord(value) || Object.keys(value).some(key => !['order', 'dates', 'expiry'].includes(key)) ||
      (value.order !== 'newest' && value.order !== 'oldest') || (value.dates !== 'long' && value.dates !== 'short')) {
    throw new Error('Date-based library settings are invalid.');
  }
  if (Object.hasOwn(value, 'expiry') && value.expiry !== null) {
    const expiry = value.expiry;
    if (!isRecord(expiry) || Object.keys(expiry).some(key => !['amount', 'unit'].includes(key)) ||
        typeof expiry.amount !== 'number' || !Number.isInteger(expiry.amount) || expiry.amount < 1 || expiry.amount > 365 ||
        !['days', 'weeks', 'months'].includes(typeof expiry.unit === 'string' ? expiry.unit : '')) {
      throw new Error('Library expiry must be 1–365 days, weeks, or months, or disabled.');
    }
  }
}
