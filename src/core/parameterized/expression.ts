export type Scalar = number | string | boolean;
export type Expression = { kind: 'literal'; value: Scalar } | { kind: 'variable'; name: string } |
  { kind: 'unary'; op: string; value: Expression } | { kind: 'binary'; op: string; left: Expression; right: Expression } |
  { kind: 'call'; name: string; args: Expression[] };
const functions: Record<string, (...args: number[]) => number> = {
  abs: Math.abs, min: Math.min, max: Math.max, sqrt: Math.sqrt, pow: Math.pow, round: Math.round,
  floor: Math.floor, ceil: Math.ceil, trunc: Math.trunc, sign: Math.sign, log: Math.log, log10: Math.log10,
  exp: Math.exp, sin: Math.sin, cos: Math.cos, tan: Math.tan,
};
const precedence: Record<string, number> = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '^': 7 };
export function parseExpression(source: string): Expression {
  if (!source.trim() || source.length > 2000) throw new Error('Expression must contain 1–2000 characters.');
  const tokens: string[] = [];
  const pattern = /\s*(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|"(?:[^"\\]|\\.)*"|'[^']*'|[A-Za-z_][A-Za-z0-9_]*|&&|\|\||==|!=|<=|>=|[()+\-*/%^!,<>])/gy;
  let offset = 0;
  while (offset < source.trimEnd().length) {
    pattern.lastIndex = offset;
    const match = pattern.exec(source);
    if (!match) throw new Error(`Invalid expression character at ${offset + 1}.`);
    tokens.push(match[1]!); offset = pattern.lastIndex;
  }
  if (tokens.length > 500) throw new Error('Expression is too complex.');
  let index = 0;
  function expression(min = 0, depth = 0): Expression {
    if (depth > 40) throw new Error('Expression is nested too deeply.');
    const token = tokens[index++];
    if (!token) throw new Error('Expression ended unexpectedly.');
    let left: Expression;
    if (token === '(') { left = expression(0, depth + 1); if (tokens[index++] !== ')') throw new Error('Missing closing parenthesis.'); }
    else if (['+', '-', '!'].includes(token)) left = { kind: 'unary', op: token, value: expression(7, depth + 1) };
    else if (/^(?:\d|\.\d)/.test(token)) left = { kind: 'literal', value: Number(token) };
    else if (token.startsWith('"') || token.startsWith("'")) left = { kind: 'literal', value: token.startsWith('"') ? JSON.parse(token) as string : token.slice(1, -1) };
    else if (token === 'true' || token === 'false') left = { kind: 'literal', value: token === 'true' };
    else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
      if (tokens[index] === '(') {
        if (!Object.hasOwn(functions, token)) throw new Error(`Unknown function: ${token}.`);
        index++; const args: Expression[] = [];
        if (tokens[index] !== ')') {
          do { args.push(expression(0, depth + 1)); } while (tokens[index] === ',' && ++index);
        }
        const expected = token === 'pow' ? 2 : token === 'min' || token === 'max' ? null : 1;
        if (tokens[index++] !== ')' || !args.length || args.length > 20 || expected !== null && args.length !== expected) throw new Error('Invalid function arguments.');
        left = { kind: 'call', name: token, args };
      } else left = { kind: 'variable', name: token };
    } else throw new Error(`Unexpected token: ${token}.`);
    while (Object.hasOwn(precedence, tokens[index] ?? '') && precedence[tokens[index]!]! >= min) {
      const op = tokens[index++]!; const rank = precedence[op]!;
      left = { kind: 'binary', op, left, right: expression(rank + (op === '^' ? 0 : 1), depth + 1) };
    }
    return left;
  }
  const result = expression();
  if (index !== tokens.length) throw new Error('Unexpected expression suffix.');
  return result;
}
export function expressionDependencies(node: Expression): string[] {
  if (node.kind === 'variable') return [node.name];
  if (node.kind === 'unary') return expressionDependencies(node.value);
  if (node.kind === 'binary') return [...expressionDependencies(node.left), ...expressionDependencies(node.right)];
  return node.kind === 'call' ? node.args.flatMap(expressionDependencies) : [];
}
function numeric(value: Scalar): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Arithmetic requires finite numeric values.');
  return value;
}
export function evaluateExpression(node: Expression, values: Readonly<Record<string, Scalar>>): Scalar {
  let result: Scalar;
  if (node.kind === 'literal') result = node.value;
  else if (node.kind === 'variable') {
    if (!Object.hasOwn(values, node.name)) throw new Error(`Unresolved variable: ${node.name}.`);
    result = values[node.name]!;
  } else if (node.kind === 'call') result = functions[node.name]!(...node.args.map(arg => numeric(evaluateExpression(arg, values))));
  else if (node.kind === 'unary') {
    const value = evaluateExpression(node.value, values);
    result = node.op === '!' ? !value : node.op === '-' ? -numeric(value) : numeric(value);
  } else {
    const left = evaluateExpression(node.left, values);
    if (node.op === '&&' && !left) return false;
    if (node.op === '||' && left) return true;
    const right = evaluateExpression(node.right, values);
    switch (node.op) {
      case '==': result = left === right; break; case '!=': result = left !== right; break;
      case '&&': result = Boolean(left && right); break; case '||': result = Boolean(left || right); break;
      case '+': result = typeof left === 'string' && typeof right === 'string' ? left + right : numeric(left) + numeric(right); break;
      case '-': result = numeric(left) - numeric(right); break; case '*': result = numeric(left) * numeric(right); break;
      case '/': result = numeric(left) / numeric(right); break; case '%': result = numeric(left) % numeric(right); break;
      case '^': result = numeric(left) ** numeric(right); break;
      case '<': result = numeric(left) < numeric(right); break; case '>': result = numeric(left) > numeric(right); break;
      case '<=': result = numeric(left) <= numeric(right); break; case '>=': result = numeric(left) >= numeric(right); break;
      default: throw new Error('Unsupported operator.');
    }
  }
  if (typeof result === 'number' && !Number.isFinite(result)) throw new Error('Expression produced a non-finite result.');
  return result;
}
