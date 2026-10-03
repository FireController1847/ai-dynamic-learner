import { MAX_EXPRESSION_LENGTH } from './graph-model.ts';

type Formula = (x: number) => number;
export type GraphPlot = { kind: 'function'; evaluate: Formula }
  | { kind: 'vertical'; x: number } | { kind: 'point'; x: number; y: number };
export interface ParsedGraphExpression { plot: GraphPlot | null; error: string | null }

const FUNCTIONS: Readonly<Record<string, (value: number) => number>> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
};

// A bounded arithmetic parser; expressions never become JavaScript source.
function formula(source: string, allowX: boolean): Formula {
  const tokens: string[] = [];
  const input = source.toLowerCase().replace(/π/g, 'pi').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  let offset = 0;
  while (offset < input.length) {
    if (/\s/.test(input[offset]!)) { offset += 1; continue; }
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|^[a-z]+|^[+\-*/^()]/.exec(input.slice(offset));
    if (!match) throw new Error(`Unexpected character “${input[offset]}”.`);
    tokens.push(match[0]);
    offset += match[0].length;
    if (tokens.length > 120) throw new Error('This expression is too complex. Try a shorter formula.');
  }
  let position = 0;
  let depth = 0;
  const peek = () => tokens[position];
  function atom(): Formula {
    const token = tokens[position++];
    if (token === undefined) throw new Error('Finish the expression.');
    if (/^(?:\d|\.)/.test(token)) {
      const value = Number(token);
      if (!Number.isFinite(value)) throw new Error('Use a finite number.');
      return () => value;
    }
    if (token === 'x' && allowX) return x => x;
    if (token === 'pi') return () => Math.PI;
    if (token === 'e') return () => Math.E;
    if (token === '(') {
      const value = nested();
      if (tokens[position++] !== ')') throw new Error('Close the parentheses.');
      return value;
    }
    if (Object.hasOwn(FUNCTIONS, token)) {
      if (tokens[position++] !== '(') throw new Error(`Use parentheses, such as ${token}(x).`);
      const value = nested();
      if (tokens[position++] !== ')') throw new Error('Close the function parentheses.');
      return x => FUNCTIONS[token]!(value(x));
    }
    throw new Error(token === 'x' ? 'Use a constant here, without x.' : `“${token}” is not supported.`);
  }
  function power(): Formula {
    const base = atom();
    if (peek() !== '^') return base;
    position += 1;
    const exponent = unary();
    return x => base(x) ** exponent(x);
  }
  function unary(): Formula {
    if (++depth > 32) throw new Error('Use fewer nested operations.');
    let value: Formula;
    if (peek() === '+' || peek() === '-') {
      const sign = tokens[position++];
      const inner = unary();
      value = sign === '-' ? x => -inner(x) : inner;
    } else value = power();
    depth -= 1;
    return value;
  }
  function product(): Formula {
    let left = unary();
    while (true) {
      const token = peek();
      const implicit = token !== undefined && /^(?:\d|\.|[a-z]|\()/.test(token);
      if (token !== '*' && token !== '/' && !implicit) break;
      if (!implicit) position += 1;
      const right = unary();
      const previous = left;
      left = token === '/' ? x => previous(x) / right(x) : x => previous(x) * right(x);
    }
    return left;
  }
  function sum(): Formula {
    let left = product();
    while (peek() === '+' || peek() === '-') {
      const operation = tokens[position++];
      const right = product();
      const previous = left;
      left = operation === '+' ? x => previous(x) + right(x) : x => previous(x) - right(x);
    }
    return left;
  }
  function nested(): Formula {
    if (++depth > 32) throw new Error('Use fewer nested parentheses.');
    const result = sum();
    depth -= 1;
    return result;
  }
  const result = nested();
  if (position !== tokens.length) throw new Error('Check the operators and parentheses.');
  return result;
}

export function parseGraphExpression(source: string): ParsedGraphExpression {
  const text = source.trim();
  if (!text) return { plot: null, error: null };
  try {
    if (text.length > MAX_EXPRESSION_LENGTH) throw new Error('This expression is too long.');
    if (text.startsWith('(') && text.endsWith(')') && text.includes(',')) {
      const coordinates = text.slice(1, -1).split(',');
      if (coordinates.length !== 2) throw new Error('Write a point as (x, y).');
      const x = formula(coordinates[0]!, false)(0);
      const y = formula(coordinates[1]!, false)(0);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Point coordinates must be finite.');
      return { plot: { kind: 'point', x, y }, error: null };
    }
    const equation = text.split('=');
    if (equation.length > 2) throw new Error('Use one equals sign.');
    if (equation.length === 2 && equation[0]!.trim().toLowerCase() === 'x') {
      const x = formula(equation[1]!, false)(0);
      if (!Number.isFinite(x)) throw new Error('Use a finite x coordinate.');
      return { plot: { kind: 'vertical', x }, error: null };
    }
    if (equation.length === 2 && equation[0]!.trim().toLowerCase() !== 'y') {
      throw new Error('Use y = f(x), x = a number, or a point (x, y).');
    }
    return { plot: { kind: 'function', evaluate: formula(equation.at(-1)!, true) }, error: null };
  } catch (error) {
    return { plot: null, error: error instanceof Error ? error.message : 'Check this expression.' };
  }
}
