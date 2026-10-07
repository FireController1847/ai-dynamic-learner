export interface SemanticPhraseRewrite {
  canonical: readonly string[];
  forms: readonly (readonly string[])[];
}

export interface SemanticPolarityFamily {
  positive: readonly string[];
  negative: readonly string[];
}

export const SEMANTIC_WORD_FAMILIES: readonly (readonly string[])[] = [
  ['union', 'join', 'combine', 'merge', 'unite'],
  ['begin', 'start'],
  ['finish', 'end'],
  ['buy', 'purchase'],
  ['remove', 'delete'],
  ['large', 'big'],
  ['small', 'little'],
  ['sufficient', 'enough', 'adequate'],
  ['insufficient', 'inadequate'],
];

export const SEMANTIC_PHRASE_REWRITES: readonly SemanticPhraseRewrite[] = [
  { canonical: ['for', 'example'], forms: [['for', 'instance']] },
  { canonical: ['because', 'of'], forms: [['due', 'to']] },
  {
    canonical: ['null'],
    forms: [
      ['null', 'word'],
      ['the', 'null', 'word'],
      ['a', 'null', 'word'],
    ],
  },
  {
    canonical: ['insufficient'],
    forms: [
      ['not', 'enough'],
      ['not', 'sufficient'],
      ['not', 'adequate'],
    ],
  },
];

export const SEMANTIC_POLARITY_FAMILIES: readonly SemanticPolarityFamily[] = [
  { positive: ['sufficient', 'enough', 'adequate'], negative: ['insufficient', 'inadequate'] },
  { positive: ['possible'], negative: ['impossible'] },
  { positive: ['valid'], negative: ['invalid'] },
  { positive: ['complete'], negative: ['incomplete'] },
  { positive: ['correct'], negative: ['incorrect'] },
];

export interface SemanticPhraseRewriteResult {
  tokens: string[];
  changed: boolean;
}

function matchesAt(tokens: readonly string[], index: number, form: readonly string[]): boolean {
  return form.every((token, offset) => tokens[index + offset] === token);
}

export function rewriteSemanticPhrases(tokens: readonly string[]): SemanticPhraseRewriteResult {
  const rewritten: string[] = [];
  let changed = false;
  let index = 0;

  while (index < tokens.length) {
    let match: { canonical: readonly string[]; length: number } | null = null;

    for (const rule of SEMANTIC_PHRASE_REWRITES) {
      for (const form of rule.forms) {
        if (form.length <= (match?.length ?? 0) || !matchesAt(tokens, index, form)) continue;
        match = { canonical: rule.canonical, length: form.length };
      }
    }

    if (match) {
      rewritten.push(...match.canonical);
      index += match.length;
      changed = true;
    } else {
      rewritten.push(tokens[index]!);
      index += 1;
    }
  }

  return { tokens: rewritten, changed };
}
