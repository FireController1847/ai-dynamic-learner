export interface FractionContext {
  start: number;
  open: number;
  comma: number;
  close: number;
  numeratorStart: number;
  numeratorEnd: number;
  denominatorStart: number;
  denominatorEnd: number;
  field: 'numerator' | 'denominator' | 'outside';
}

export type MathPrintNode =
  | { kind: 'text'; text: string; start: number; end: number }
  | {
      kind: 'fraction';
      start: number;
      end: number;
      numeratorStart: number;
      numeratorEnd: number;
      denominatorStart: number;
      denominatorEnd: number;
      numerator: MathPrintNode[];
      denominator: MathPrintNode[];
    };

export interface MathPrintTextToken {
  raw: string;
  display: string;
  start: number;
  end: number;
}

const DISPLAY_TOKENS: readonly [string, string][] = [
  ['asin(', 'sin⁻¹('],
  ['acos(', 'cos⁻¹('],
  ['atan(', 'tan⁻¹('],
  ['sqrt(', '√('],
  ['round(', 'round('],
  ['^(-1)', '⁻¹'],
  ['^(2)', '²'],
  ['ans', 'Ans'],
  ['pi', 'π'],
  ['sin(', 'sin('],
  ['cos(', 'cos('],
  ['tan(', 'tan('],
  ['log(', 'log('],
  ['ln(', 'ln('],
  ['abs(', 'abs('],
];

export function tokenizeMathPrintText(text: string, start: number): MathPrintTextToken[] {
  const tokens: MathPrintTextToken[] = [];
  let offset = 0;

  while (offset < text.length) {
    const matched = DISPLAY_TOKENS.find(([raw]) => text.startsWith(raw, offset));
    if (matched) {
      const [raw, display] = matched;
      tokens.push({ raw, display, start: start + offset, end: start + offset + raw.length });
      offset += raw.length;
      continue;
    }

    const raw = text[offset];
    const display = raw === '*' ? '×' : raw === '/' ? '÷' : raw === '-' ? '−' : raw;
    tokens.push({ raw, display, start: start + offset, end: start + offset + 1 });
    offset += 1;
  }

  return tokens;
}

export function endsValue(expression: string) {
  return /[\d)!%]$/.test(expression) || /(?:pi|e|ans)$/.test(expression);
}

export function parenthesesBalancedEnoughToClose(expression: string) {
  let depth = 0;
  for (const character of expression) {
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
  }
  return depth > 0;
}

export function lastOperandStart(expression: string) {
  if (!expression || !endsValue(expression)) return expression.length;
  let index = expression.length - 1;

  while (expression[index] === '!' || expression[index] === '%') index -= 1;

  if (expression[index] === ')') {
    let depth = 1;
    index -= 1;
    while (index >= 0 && depth > 0) {
      if (expression[index] === ')') depth += 1;
      else if (expression[index] === '(') depth -= 1;
      index -= 1;
    }
    let start = index + 1;
    while (start > 0 && /[A-Za-z]/.test(expression[start - 1] ?? '')) start -= 1;
    return start;
  }

  if (/[A-Za-z]/.test(expression[index] ?? '')) {
    while (index >= 0 && /[A-Za-z]/.test(expression[index] ?? '')) index -= 1;
    return index + 1;
  }

  while (index >= 0 && /[\d.]/.test(expression[index] ?? '')) index -= 1;
  return index + 1;
}

function fractionSpanAt(source: string, start: number) {
  if (!source.startsWith('frac(', start)) return null;
  const open = start + 4;
  let depth = 1;
  let comma = -1;

  for (let index = open + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    else if (character === ')') {
      depth -= 1;
      if (depth === 0) {
        if (comma < 0) return null;
        return { start, open, comma, close: index };
      }
    } else if (character === ',' && depth === 1 && comma < 0) {
      comma = index;
    }
  }
  return null;
}

export function fractionContextAt(source: string, cursor: number): FractionContext | null {
  let match: FractionContext | null = null;
  for (let index = 0; index < source.length; index += 1) {
    if (!source.startsWith('frac(', index)) continue;
    const span = fractionSpanAt(source, index);
    if (!span) continue;
    if (cursor < span.open + 1 || cursor > span.close) continue;

    const numeratorStart = span.open + 1;
    const numeratorEnd = span.comma;
    const denominatorStart = span.comma + 1;
    const denominatorEnd = span.close;
    const field = cursor <= span.comma
      ? 'numerator'
      : cursor <= span.close ? 'denominator' : 'outside';
    match = { ...span, numeratorStart, numeratorEnd, denominatorStart, denominatorEnd, field };
  }
  return match;
}

export function createFractionTemplate(source: string, cursor: number) {
  const before = source.slice(0, cursor);
  const after = source.slice(cursor);

  if (endsValue(before)) {
    const start = lastOperandStart(before);
    const numerator = before.slice(start);
    const prefix = before.slice(0, start);
    const template = `frac(${numerator},)`;
    return {
      source: `${prefix}${template}${after}`,
      cursor: prefix.length + 5 + numerator.length,
    };
  }

  const template = 'frac(,)';
  return {
    source: `${before}${template}${after}`,
    cursor: before.length + 5,
  };
}


export function createRoundTemplate(source: string, cursor: number) {
  const before = source.slice(0, cursor);
  const after = source.slice(cursor);

  if (endsValue(before)) {
    const start = lastOperandStart(before);
    const value = before.slice(start);
    const prefix = before.slice(0, start);
    const template = `round(${value},)`;
    return {
      source: `${prefix}${template}${after}`,
      cursor: prefix.length + 7 + value.length,
    };
  }

  const template = 'round(,)';
  return {
    source: `${before}${template}${after}`,
    cursor: before.length + 7,
  };
}

export function moveFractionCursor(source: string, cursor: number, direction: 'up' | 'down' | 'right') {
  const context = fractionContextAt(source, cursor);
  if (!context) return null;

  if (direction === 'down' && context.field === 'numerator') return context.denominatorStart;
  if (direction === 'up' && context.field === 'denominator') return context.numeratorEnd;
  if (direction === 'right') return context.close + 1;
  return null;
}


function collectCursorPositions(nodes: MathPrintNode[], positions: number[]) {
  for (const node of nodes) {
    if (node.kind === 'text') {
      for (const token of tokenizeMathPrintText(node.text, node.start)) {
        positions.push(token.start, token.end);
      }
      continue;
    }

    positions.push(node.start);
    collectCursorPositions(node.numerator, positions);
    positions.push(node.numeratorStart, node.numeratorEnd);
    collectCursorPositions(node.denominator, positions);
    positions.push(node.denominatorStart, node.denominatorEnd, node.end);
  }
}

export function mathPrintCursorPositions(source: string) {
  const positions = [0, source.length];
  collectCursorPositions(parseMathPrint(source), positions);
  return [...new Set(positions)]
    .filter((position) => position >= 0 && position <= source.length)
    .sort((left, right) => left - right);
}

export function normaliseMathPrintCursor(source: string, cursor: number) {
  const positions = mathPrintCursorPositions(source);
  return positions.reduce((nearest, position) =>
    Math.abs(position - cursor) < Math.abs(nearest - cursor) ? position : nearest, positions[0] ?? 0);
}

export function moveMathPrintCursor(source: string, cursor: number, direction: 'left' | 'right') {
  const positions = mathPrintCursorPositions(source);
  const current = normaliseMathPrintCursor(source, cursor);
  const index = Math.max(0, positions.indexOf(current));
  if (direction === 'left') return positions[Math.max(0, index - 1)] ?? 0;
  return positions[Math.min(positions.length - 1, index + 1)] ?? source.length;
}

interface EditAtom {
  start: number;
  end: number;
  replaceable: boolean;
}

function collectEditAtoms(nodes: MathPrintNode[], atoms: EditAtom[]) {
  for (const node of nodes) {
    if (node.kind === 'text') {
      for (const token of tokenizeMathPrintText(node.text, node.start)) {
        atoms.push({
          start: token.start,
          end: token.end,
          replaceable: !token.raw.endsWith('(')
            && !['(', ')', ','].includes(token.raw)
            && token.raw !== '^(-1)'
            && token.raw !== '^(2)',
        });
      }
      continue;
    }

    atoms.push({ start: node.start, end: node.end, replaceable: true });
    collectEditAtoms(node.numerator, atoms);
    collectEditAtoms(node.denominator, atoms);
  }
}

function mathPrintEditAtoms(source: string) {
  const atoms: EditAtom[] = [];
  collectEditAtoms(parseMathPrint(source), atoms);
  return atoms.sort((left, right) => left.start - right.start || right.end - left.end);
}

export function overwriteRangeAtCursor(source: string, cursor: number) {
  const atom = mathPrintEditAtoms(source)
    .find((candidate) => candidate.start === cursor && candidate.replaceable);
  return atom ? { start: atom.start, end: atom.end } : null;
}

export function deleteMathPrintForward(source: string, cursor: number) {
  if (cursor >= source.length) return { source, cursor };

  const atom = mathPrintEditAtoms(source)
    .find((candidate) => candidate.start >= cursor);

  if (!atom) return { source, cursor };
  return {
    source: source.slice(0, atom.start) + source.slice(atom.end),
    cursor: normaliseMathPrintCursor(
      source.slice(0, atom.start) + source.slice(atom.end),
      atom.start,
    ),
  };
}

export function backspaceMathPrint(source: string, cursor: number) {
  if (cursor <= 0) return { source, cursor };

  const context = fractionContextAt(source, cursor);
  if (context?.field === 'denominator' && cursor === context.denominatorStart) {
    return { source, cursor: context.numeratorEnd };
  }
  if (context?.field === 'numerator' && cursor === context.numeratorStart) {
    const next = source.slice(0, context.start) + source.slice(context.close + 1);
    return { source: next, cursor: normaliseMathPrintCursor(next, context.start) };
  }

  const atoms = mathPrintEditAtoms(source)
    .filter((atom) => atom.end <= cursor)
    .sort((left, right) => right.end - left.end || (right.end - right.start) - (left.end - left.start));
  const atom = atoms[0];
  if (!atom) return { source, cursor };

  const next = source.slice(0, atom.start) + source.slice(atom.end);
  return {
    source: next,
    cursor: normaliseMathPrintCursor(next, atom.start),
  };
}

function parseRange(source: string, start: number, end: number): MathPrintNode[] {
  const nodes: MathPrintNode[] = [];
  let textStart = start;
  let index = start;

  while (index < end) {
    if (source.startsWith('frac(', index)) {
      const span = fractionSpanAt(source, index);
      if (span && span.close < end) {
        if (textStart < index) {
          nodes.push({ kind: 'text', text: source.slice(textStart, index), start: textStart, end: index });
        }
        nodes.push({
          kind: 'fraction',
          start: span.start,
          end: span.close + 1,
          numeratorStart: span.open + 1,
          numeratorEnd: span.comma,
          denominatorStart: span.comma + 1,
          denominatorEnd: span.close,
          numerator: parseRange(source, span.open + 1, span.comma),
          denominator: parseRange(source, span.comma + 1, span.close),
        });
        index = span.close + 1;
        textStart = index;
        continue;
      }
    }
    index += 1;
  }

  if (textStart < end) {
    nodes.push({ kind: 'text', text: source.slice(textStart, end), start: textStart, end });
  }
  return nodes;
}

export function parseMathPrint(source: string) {
  return parseRange(source, 0, source.length);
}
