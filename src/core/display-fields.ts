/** Declarative controls preserve the relationship between a field key and its value. */
export interface DisplayChoice<Value extends string = string> {
  value: Value;
  label: string;
  css?: string | number;
}
export type DisplayField<Options> = {
  [Key in keyof Options]-?: NonNullable<Options[Key]> extends number
    ? { key: Key; label: string; default: number; min: number; max: number; step: number; unit: string; choices?: never }
    : { key: Key; label: string; default: Extract<Options[Key], string>; choices: DisplayChoice<Extract<Options[Key], string>>[]; min?: never; max?: never; step?: never; unit?: never }
}[keyof Options];

export function choiceStyle(fields: readonly { key: string; choices?: readonly DisplayChoice[] }[], key: string, value: unknown): string | number | undefined {
  return fields.find(field => field.key === key)?.choices?.find(choice => choice.value === value)?.css;
}
