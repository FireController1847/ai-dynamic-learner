export type AngleMode = 'DEG' | 'RAD';

export interface EvaluationContext {
  angleMode: AngleMode;
  ans: number;
}

const MAX_FACTORIAL = 170;

function finite(value: number) {
  if (Number.isNaN(value)) throw new Error('Invalid input.');
  if (!Number.isFinite(value)) throw new Error('Result is too large.');
  return value === 0 ? 0 : value;
}

function factorial(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_FACTORIAL) {
    throw new Error('Factorial requires an integer from 0 to 170.');
  }
  let result = 1;
  for (let current = 2; current <= value; current += 1) result *= current;
  return finite(result);
}

function toRadians(value: number, mode: AngleMode) {
  return mode === 'DEG' ? value * Math.PI / 180 : value;
}

function fromRadians(value: number, mode: AngleMode) {
  return mode === 'DEG' ? value * 180 / Math.PI : value;
}

function applyFunction(name: string, value: number, mode: AngleMode) {
  switch (name) {
    case 'sin': return finite(Math.sin(toRadians(value, mode)));
    case 'cos': return finite(Math.cos(toRadians(value, mode)));
    case 'tan': {
      const radians = toRadians(value, mode);
      if (Math.abs(Math.cos(radians)) < 1e-14) throw new Error('Tangent is undefined at this angle.');
      return finite(Math.tan(radians));
    }
    case 'asin':
      if (value < -1 || value > 1) throw new Error('sin⁻¹ requires a value from −1 to 1.');
      return finite(fromRadians(Math.asin(value), mode));
    case 'acos':
      if (value < -1 || value > 1) throw new Error('cos⁻¹ requires a value from −1 to 1.');
      return finite(fromRadians(Math.acos(value), mode));
    case 'atan': return finite(fromRadians(Math.atan(value), mode));
    case 'ln':
      if (value <= 0) throw new Error('ln requires a positive value.');
      return finite(Math.log(value));
    case 'log':
      if (value <= 0) throw new Error('log requires a positive value.');
      return finite(Math.log10(value));
    case 'sqrt':
      if (value < 0) throw new Error('Square root requires a nonnegative value.');
      return finite(Math.sqrt(value));
    case 'abs': return Math.abs(value);
    default: throw new Error(`Unknown function “${name}”.`);
  }
}

class Parser {
  private index = 0;
  private readonly source: string;
  private readonly context: EvaluationContext;

  constructor(source: string, context: EvaluationContext) {
    this.source = source;
    this.context = context;
  }

  parse() {
    if (!this.source.trim()) throw new Error('Enter an expression.');
    const value = this.parseExpression();
    this.skipSpaces();
    if (this.index !== this.source.length) {
      throw new Error(`Unexpected “${this.source[this.index]}”.`);
    }
    return finite(value);
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    while (true) {
      if (this.match('+')) value = finite(value + this.parseTerm());
      else if (this.match('-')) value = finite(value - this.parseTerm());
      else return value;
    }
  }

  private parseTerm(): number {
    let value = this.parseUnary();
    while (true) {
      if (this.match('*')) value = finite(value * this.parseUnary());
      else if (this.match('/')) {
        const divisor = this.parseUnary();
        if (divisor === 0) throw new Error('Cannot divide by zero.');
        value = finite(value / divisor);
      } else {
        return value;
      }
    }
  }

  private parseUnary(): number {
    if (this.match('+')) return this.parseUnary();
    if (this.match('-')) return finite(-this.parseUnary());
    return this.parsePower();
  }

  private parsePower(): number {
    const base = this.parsePostfix();
    if (!this.match('^')) return base;
    return finite(Math.pow(base, this.parseUnary()));
  }

  private parsePostfix(): number {
    let value = this.parsePrimary();
    while (true) {
      if (this.match('!')) value = factorial(value);
      else if (this.match('%')) value = finite(value / 100);
      else return value;
    }
  }

  private parsePrimary(): number {
    if (this.match('(')) {
      const value = this.parseExpression();
      if (!this.match(')')) throw new Error('Missing closing parenthesis.');
      return value;
    }

    const character = this.peek();
    if (character && (this.isDigit(character) || character === '.')) return this.readNumber();

    if (character && this.isLetter(character)) {
      const identifier = this.readIdentifier();
      if (identifier === 'pi') return Math.PI;
      if (identifier === 'e') return Math.E;
      if (identifier === 'ans') return this.context.ans;
      if (!this.match('(')) throw new Error(`${identifier} requires parentheses.`);

      if (identifier === 'frac') {
        const numerator = this.parseExpression();
        if (!this.match(',')) throw new Error('Fraction denominator is missing.');
        const denominator = this.parseExpression();
        if (!this.match(')')) throw new Error('Missing closing parenthesis.');
        if (denominator === 0) throw new Error('Cannot divide by zero.');
        return finite(numerator / denominator);
      }

      const value = this.parseExpression();
      if (!this.match(')')) throw new Error('Missing closing parenthesis.');
      return applyFunction(identifier, value, this.context.angleMode);
    }

    if (!character) throw new Error('Expression is incomplete.');
    throw new Error(`Unexpected “${character}”.`);
  }

  private readNumber() {
    this.skipSpaces();
    const start = this.index;
    let hasDigits = false;

    while (this.isDigit(this.source[this.index])) {
      this.index += 1;
      hasDigits = true;
    }
    if (this.source[this.index] === '.') {
      this.index += 1;
      while (this.isDigit(this.source[this.index])) {
        this.index += 1;
        hasDigits = true;
      }
    }
    if (!hasDigits) throw new Error('Invalid number.');

    if (this.source[this.index] === 'E') {
      this.index += 1;
      if (this.source[this.index] === '+' || this.source[this.index] === '-') this.index += 1;
      const exponentStart = this.index;
      while (this.isDigit(this.source[this.index])) this.index += 1;
      if (this.index === exponentStart) throw new Error('Scientific notation is incomplete.');
    }

    const value = Number(this.source.slice(start, this.index));
    if (!Number.isFinite(value)) throw new Error('Number is too large.');
    return value;
  }

  private readIdentifier() {
    this.skipSpaces();
    const start = this.index;
    while (this.isLetter(this.source[this.index])) this.index += 1;
    return this.source.slice(start, this.index).toLowerCase();
  }

  private match(expected: string) {
    this.skipSpaces();
    if (this.source[this.index] !== expected) return false;
    this.index += 1;
    return true;
  }

  private peek() {
    this.skipSpaces();
    return this.source[this.index];
  }

  private skipSpaces() {
    while (/\s/.test(this.source[this.index] ?? '')) this.index += 1;
  }

  private isDigit(character: string | undefined): character is string {
    return Boolean(character && character >= '0' && character <= '9');
  }

  private isLetter(character: string | undefined): character is string {
    return Boolean(character && /[A-Za-z]/.test(character));
  }
}


export function completeTrailingClosures(source: string) {
  let depth = 0;

  for (const character of source) {
    if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      if (depth === 0) return source;
      depth -= 1;
    }
  }

  return depth > 0 ? `${source}${')'.repeat(depth)}` : source;
}

export function evaluateExpression(source: string, context: EvaluationContext) {
  return new Parser(source, context).parse();
}

export function formatExpression(source: string) {
  return source
    .replace(/\basin\(/g, 'sin⁻¹(')
    .replace(/\bacos\(/g, 'cos⁻¹(')
    .replace(/\batan\(/g, 'tan⁻¹(')
    .replace(/\bsqrt\(/g, '√(')
    .replace(/\^\(2\)/g, '²')
    .replace(/\^\(-1\)/g, '⁻¹')
    .replace(/\bpi\b/g, 'π')
    .replace(/\bans\b/g, 'Ans')
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/-/g, '−');
}
