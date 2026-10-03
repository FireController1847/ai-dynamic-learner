import {
  evaluateExpression, formatExpression, type AngleMode,
} from './expression-engine.ts';
import {
  formatNumber, fractionForValue, normaliseNumber, type DecimalPlaces,
} from './calculator-format.ts';

export type Operator = '+' | '-' | '*' | '/' | '^';
export type ScientificFunction = 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan' | 'ln' | 'log' | 'sqrt';

export interface HistoryEntry {
  id: number;
  expression: string;
  result: number;
}

const MAX_EXPRESSION_LENGTH = 180;

function endsValue(expression: string) {
  return /[\d)!%]$/.test(expression) || /(?:pi|e|ans)$/.test(expression);
}

function parenthesesBalancedEnoughToClose(expression: string) {
  let depth = 0;
  for (const character of expression) {
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
  }
  return depth > 0;
}

function lastOperandStart(expression: string) {
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

export class CalculatorModel {
  expression = '';
  display = '0';
  hasError = false;
  memory: number | null = null;
  history: HistoryEntry[] = [];
  angleMode: AngleMode = 'DEG';
  lastAnswer = 0;
  justEvaluated = false;
  decimalPlaces: DecimalPlaces;
  displayMode: 'decimal' | 'fraction' = 'decimal';
  private historyId = 0;

  constructor(decimalPlaces: DecimalPlaces = null) {
    this.decimalPlaces = decimalPlaces;
    this.display = this.formatResult(0);
  }

  formattedExpression() {
    return formatExpression(this.expression);
  }

  formatResult(value: number) {
    return formatNumber(value, this.decimalPlaces);
  }

  canToggleFraction() {
    return this.justEvaluated && !this.hasError && fractionForValue(this.lastAnswer) !== null;
  }

  toggleFractionDecimal() {
    if (!this.canToggleFraction()) return;
    if (this.displayMode === 'fraction') {
      this.displayMode = 'decimal';
      this.display = this.formatResult(this.lastAnswer);
      return;
    }

    const fraction = fractionForValue(this.lastAnswer);
    if (!fraction) return;
    this.displayMode = 'fraction';
    this.display = fraction;
  }

  setDecimalPlaces(decimalPlaces: DecimalPlaces) {
    this.decimalPlaces = decimalPlaces;
    if (this.hasError || this.displayMode === 'fraction') return;

    if (this.justEvaluated) {
      this.display = this.formatResult(this.lastAnswer);
      return;
    }

    if (!this.expression) {
      this.display = this.formatResult(0);
      return;
    }

    try {
      this.display = this.formatResult(evaluateExpression(this.expression, this.context()));
    } catch {
      // Keep the last valid preview while an expression is incomplete.
    }
  }

  private context() {
    return { angleMode: this.angleMode, ans: this.lastAnswer };
  }

  private currentValue() {
    if (this.justEvaluated) return this.lastAnswer;
    try {
      return normaliseNumber(evaluateExpression(this.expression, this.context()));
    } catch {
      const displayValue = Number(this.display);
      return Number.isFinite(displayValue) ? displayValue : null;
    }
  }

  private resetDisplayMode() {
    this.displayMode = 'decimal';
  }

  private prepareValue() {
    this.resetDisplayMode();
    if (this.hasError) {
      this.expression = '';
      this.display = this.formatResult(0);
      this.hasError = false;
      this.justEvaluated = false;
    }
    if (this.justEvaluated) {
      this.expression = '';
      this.justEvaluated = false;
    }
  }

  private append(text: string) {
    if (this.expression.length + text.length > MAX_EXPRESSION_LENGTH) return false;
    this.resetDisplayMode();
    this.expression += text;
    this.refreshPreview();
    return true;
  }

  private appendValue(text: string) {
    this.prepareValue();
    const multiply = endsValue(this.expression) ? '*' : '';
    this.append(`${multiply}${text}`);
  }

  private refreshPreview() {
    if (!this.expression) {
      this.display = this.formatResult(0);
      return;
    }
    try {
      this.display = this.formatResult(evaluateExpression(this.expression, this.context()));
      this.hasError = false;
    } catch {
      // Incomplete expressions are normal while the user is still typing.
    }
  }

  private fail(error: unknown) {
    this.resetDisplayMode();
    this.display = error instanceof Error ? error.message : String(error);
    this.hasError = true;
    this.justEvaluated = false;
  }

  clearAll() {
    this.resetDisplayMode();
    this.expression = '';
    this.display = this.formatResult(0);
    this.hasError = false;
    this.justEvaluated = false;
  }

  clearEntry() {
    this.resetDisplayMode();
    if (this.hasError) {
      this.hasError = false;
      this.refreshPreview();
      return;
    }
    const start = lastOperandStart(this.expression);
    if (start < this.expression.length) {
      this.expression = this.expression.slice(0, start);
      this.justEvaluated = false;
      this.refreshPreview();
    }
  }

  backspace() {
    this.resetDisplayMode();
    if (this.hasError) {
      this.hasError = false;
      this.refreshPreview();
      return;
    }
    if (this.justEvaluated) this.justEvaluated = false;
    this.expression = this.expression.slice(0, -1);
    this.refreshPreview();
  }

  inputDigit(digit: string) {
    this.prepareValue();
    if (endsValue(this.expression) && /(?:\)|!|%|pi|e|ans)$/.test(this.expression)) {
      this.append(`*${digit}`);
      return;
    }
    this.append(digit);
  }

  inputDecimal() {
    this.prepareValue();
    if (!this.expression || /[+\-*/^(]$/.test(this.expression)) {
      this.append('0.');
      return;
    }
    if (/(?:\)|!|%|pi|e|ans)$/.test(this.expression)) {
      this.append('*0.');
      return;
    }
    const currentNumber = this.expression.match(/(?:^|[+\-*/^(])(\d*\.?\d*)$/)?.[1] ?? '';
    if (!currentNumber.includes('.')) this.append('.');
  }

  chooseOperator(operator: Operator) {
    if (this.hasError) return;
    this.resetDisplayMode();
    if (this.justEvaluated) {
      this.expression = 'ans';
      this.justEvaluated = false;
    }
    if (!this.expression) {
      if (operator === '-') this.append('-');
      return;
    }
    if (this.expression.endsWith('(')) {
      if (operator === '-') this.append('-');
      return;
    }

    if (/[+\-*/^]$/.test(this.expression)) {
      if (operator === '-' && !this.expression.endsWith('-')) {
        this.append('-');
        return;
      }
      this.expression = this.expression.replace(/[+\-*/^]+$/, operator);
      this.refreshPreview();
      return;
    }

    if (endsValue(this.expression)) this.append(operator);
  }

  inputParenthesis(open: boolean) {
    if (open) {
      this.prepareValue();
      this.append(`${endsValue(this.expression) ? '*' : ''}(`);
      return;
    }
    if (parenthesesBalancedEnoughToClose(this.expression) && endsValue(this.expression)) this.append(')');
  }

  inputFunction(name: ScientificFunction) {
    this.appendValue(`${name}(`);
  }

  inputConstant(name: 'pi' | 'e' | 'ans') {
    this.appendValue(name);
  }

  inputPostfix(operator: '!' | '%') {
    if (this.hasError) return;
    this.resetDisplayMode();
    if (this.justEvaluated) {
      this.expression = 'ans';
      this.justEvaluated = false;
    }
    if (endsValue(this.expression)) this.append(operator);
  }

  inputPowerShortcut(power: '2' | '-1') {
    if (this.hasError || !endsValue(this.expression)) return;
    this.resetDisplayMode();
    if (this.justEvaluated) {
      this.expression = 'ans';
      this.justEvaluated = false;
    }
    this.append(power === '2' ? '^(2)' : '^(-1)');
  }

  inputPowerFunction(base: '10' | 'e') {
    this.appendValue(`${base}^(`);
  }

  toggleSign() {
    if (this.hasError) return;
    this.resetDisplayMode();
    if (this.justEvaluated) {
      this.expression = 'ans';
      this.justEvaluated = false;
    }
    if (!this.expression || /[+\-*/^(]$/.test(this.expression)) {
      this.append('-');
      return;
    }

    const start = lastOperandStart(this.expression);
    if (start >= this.expression.length) return;
    const prefix = this.expression.slice(0, start);
    const operand = this.expression.slice(start);
    const negative = operand.match(/^\(-(.+)\)$/);
    this.expression = negative ? `${prefix}${negative[1]}` : `${prefix}(-${operand})`;
    this.refreshPreview();
  }

  equals() {
    if (!this.expression) return;
    try {
      const result = normaliseNumber(evaluateExpression(this.expression, this.context()));
      const label = `${formatExpression(this.expression)} =`;
      this.history.unshift({ id: ++this.historyId, expression: label, result });
      if (this.history.length > 30) this.history.pop();
      this.lastAnswer = result;
      this.resetDisplayMode();
      this.display = this.formatResult(result);
      this.hasError = false;
      this.justEvaluated = true;
    } catch (error) {
      this.fail(error);
    }
  }

  toggleAngleMode() {
    this.angleMode = this.angleMode === 'DEG' ? 'RAD' : 'DEG';
    this.resetDisplayMode();
    if (!this.justEvaluated) this.refreshPreview();
  }

  memoryStore() {
    const value = this.currentValue();
    if (value !== null) this.memory = value;
  }

  memoryRecall() {
    if (this.memory === null) return;
    const literal = this.memory < 0 ? `(${String(this.memory)})` : String(this.memory);
    this.appendValue(literal);
  }

  memoryAdjust(direction: 1 | -1) {
    const value = this.currentValue();
    if (value === null) return;
    this.memory = normaliseNumber((this.memory ?? 0) + value * direction);
  }

  useHistory(entry: HistoryEntry) {
    this.expression = String(entry.result);
    this.lastAnswer = entry.result;
    this.resetDisplayMode();
    this.display = this.formatResult(entry.result);
    this.hasError = false;
    this.justEvaluated = true;
  }

  clearHistory() {
    this.history = [];
  }
}
