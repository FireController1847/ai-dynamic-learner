import { isRecord } from '../../core/validation.ts';

export interface DropdownMatch { label: string; answer: string }
export const MAX_DROPDOWN_ROWS = 20;
export const MAX_DROPDOWN_CHOICES = 20;

export function validateDropdownMatches(value: unknown, maxText: number): asserts value is DropdownMatch[] {
  if (!Array.isArray(value) || value.length > MAX_DROPDOWN_ROWS) throw new Error(`Dropdown questions support up to ${MAX_DROPDOWN_ROWS} rows.`);
  const rows: unknown[] = value;
  if (rows.some(row => !isRecord(row) || Object.keys(row).some(key => !['label', 'answer'].includes(key)) ||
      typeof row.label !== 'string' || row.label.length > maxText || typeof row.answer !== 'string' || row.answer.length > maxText)) {
    throw new Error('Each dropdown row needs plain-text label and answer fields.');
  }
}

export function dropdownProblem(matches: readonly DropdownMatch[], choices: readonly string[]): string {
  if (matches.length > MAX_DROPDOWN_ROWS || choices.length > MAX_DROPDOWN_CHOICES) return 'Reduce the number of dropdown rows or choices.';
  const options = choices.map(choice => choice.trim()).filter(Boolean);
  if (options.length < 2 || new Set(options).size !== options.length) return 'Add at least two distinct dropdown choices.';
  if (!matches.length) return 'Add at least one matching row.';
  if (matches.some(row => !row.label.trim())) return 'Give every matching row a label.';
  if (new Set(matches.map(row => row.label.trim())).size !== matches.length) return 'Use distinct labels for the matching rows.';
  if (matches.some(row => !options.includes(row.answer.trim()))) return 'Select a correct dropdown answer for every row.';
  return '';
}

export function dropdownCorrectness(matches: readonly DropdownMatch[], response: string | string[] | undefined): boolean[] {
  return matches.map((row, index) => Boolean(row.answer.trim()) && Array.isArray(response) && row.answer.trim() === response[index]?.trim());
}
