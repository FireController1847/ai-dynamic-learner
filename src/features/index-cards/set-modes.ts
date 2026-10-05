export type SetModeId = 'flash-cards' | 'fill-in-the-blanks';

export interface SetMode {
  readonly id: SetModeId;
  readonly available: boolean;
  readonly label: string;
  readonly description: string;
}

export const DEFAULT_SET_MODE: SetModeId = 'flash-cards';

export const SET_MODES: readonly SetMode[] = Object.freeze([
  Object.freeze({
    id: 'flash-cards',
    available: true,
    label: 'Flash Cards',
    description: 'Study prompts and answers by flipping through cards.',
  }),
  Object.freeze({
    id: 'fill-in-the-blanks',
    available: false,
    label: 'Fill in the Blanks',
    description: 'Practice recalling missing words from a prompt.',
  }),
]);

const MODE_IDS = new Set<string>(SET_MODES.map((mode) => mode.id));

export function isSetMode(value: unknown): value is SetModeId {
  return typeof value === 'string' && MODE_IDS.has(value);
}

export function getSetMode(value: unknown): SetMode | null {
  if (value === undefined || value === null) {
    return SET_MODES.find((mode) => mode.id === DEFAULT_SET_MODE) ?? null;
  }
  return SET_MODES.find((mode) => mode.id === value) ?? null;
}
