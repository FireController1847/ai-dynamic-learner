export type Operator = '+' | '-' | '*' | '/';
export type UnaryOperation = 'reciprocal' | 'square' | 'sqrt';

export interface HistoryEntry {
  id: number;
  expression: string;
  result: number;
}

const MAX_INPUT_LENGTH = 18;
export const OPERATOR_SYMBOLS: Record<Operator, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

function normalise(value: number) {
  return value === 0 ? 0 : Number.parseFloat(value.toPrecision(12));
}

export function formatNumber(value: number) {
  const normalised = normalise(value);
  const absolute = Math.abs(normalised);
  if (absolute !== 0 && (absolute >= 1e12 || absolute < 1e-9)) {
    return normalised.toExponential(10).replace(/\.0+e/, 'e').replace(/(\.\d*?[1-9])0+e/, '$1e');
  }
  return String(normalised);
}

export class CalculatorModel {
  display = '0';
  expression = '';
  accumulator: number | null = null;
  pendingOperator: Operator | null = null;
  overwrite = true;
  hasError = false;
  lastOperator: Operator | null = null;
  lastOperand: number | null = null;
  memory: number | null = null;
  history: HistoryEntry[] = [];
  private historyId = 0;

  private readCurrent() {
    const value = Number(this.display);
    return Number.isFinite(value) ? value : null;
  }

  private resetBinaryState() {
    this.accumulator = null;
    this.pendingOperator = null;
    this.lastOperator = null;
    this.lastOperand = null;
  }

  private startFreshEntryIfNeeded() {
    if (!this.overwrite || this.pendingOperator !== null || this.accumulator !== null || !this.expression.endsWith('=')) return;
    this.expression = '';
    this.lastOperator = null;
    this.lastOperand = null;
  }

  private showError(message: string) {
    this.display = message;
    this.expression = '';
    this.hasError = true;
    this.overwrite = true;
    this.resetBinaryState();
  }

  private calculate(left: number, operator: Operator, right: number) {
    let result: number;
    switch (operator) {
      case '+': result = left + right; break;
      case '-': result = left - right; break;
      case '*': result = left * right; break;
      case '/':
        if (right === 0) {
          this.showError('Cannot divide by zero');
          return null;
        }
        result = left / right;
        break;
    }
    if (!Number.isFinite(result)) {
      this.showError('Result is too large');
      return null;
    }
    return normalise(result);
  }

  private record(expression: string, result: number) {
    this.history.unshift({ id: ++this.historyId, expression, result });
    if (this.history.length > 30) this.history.pop();
  }

  clearAll() {
    this.display = '0';
    this.expression = '';
    this.hasError = false;
    this.overwrite = true;
    this.resetBinaryState();
  }

  clearEntry() {
    if (this.hasError) {
      this.clearAll();
      return;
    }
    this.display = '0';
    this.overwrite = true;
  }

  inputDigit(digit: string) {
    if (this.hasError) this.clearAll();
    this.startFreshEntryIfNeeded();
    if (this.overwrite || this.display === '0') {
      this.display = digit;
      this.overwrite = false;
      return;
    }
    if (this.display.replace('-', '').replace('.', '').length < MAX_INPUT_LENGTH) {
      this.display += digit;
    }
  }

  inputDecimal() {
    if (this.hasError) this.clearAll();
    this.startFreshEntryIfNeeded();
    if (this.overwrite) {
      this.display = '0.';
      this.overwrite = false;
    } else if (!this.display.includes('.')) {
      this.display += '.';
    }
  }

  backspace() {
    if (this.hasError) {
      this.clearAll();
      return;
    }
    if (this.overwrite) return;
    const next = this.display.slice(0, -1);
    this.display = !next || next === '-' ? '0' : next;
    if (this.display === '0') this.overwrite = true;
  }

  toggleSign() {
    if (this.hasError || this.display === '0') return;
    this.display = this.display.startsWith('-') ? this.display.slice(1) : `-${this.display}`;
  }

  chooseOperator(operator: Operator) {
    if (this.hasError) return;
    const current = this.readCurrent();
    if (current === null) return;

    if (this.pendingOperator && this.accumulator !== null) {
      if (this.overwrite) {
        this.pendingOperator = operator;
        this.expression = `${formatNumber(this.accumulator)} ${OPERATOR_SYMBOLS[operator]}`;
        return;
      }
      const result = this.calculate(this.accumulator, this.pendingOperator, current);
      if (result === null) return;
      this.accumulator = result;
      this.display = formatNumber(result);
    } else {
      this.accumulator = current;
    }

    this.pendingOperator = operator;
    this.expression = `${formatNumber(this.accumulator)} ${OPERATOR_SYMBOLS[operator]}`;
    this.overwrite = true;
    this.lastOperator = null;
    this.lastOperand = null;
  }

  equals() {
    if (this.hasError) return;
    const current = this.readCurrent();
    if (current === null) return;

    if (this.pendingOperator && this.accumulator !== null) {
      const operator = this.pendingOperator;
      const left = this.accumulator;
      const right = current;
      const result = this.calculate(left, operator, right);
      if (result === null) return;
      const label = `${formatNumber(left)} ${OPERATOR_SYMBOLS[operator]} ${formatNumber(right)} =`;
      this.record(label, result);
      this.display = formatNumber(result);
      this.expression = label;
      this.lastOperator = operator;
      this.lastOperand = right;
      this.accumulator = null;
      this.pendingOperator = null;
      this.overwrite = true;
      return;
    }

    if (this.lastOperator && this.lastOperand !== null) {
      const operator = this.lastOperator;
      const right = this.lastOperand;
      const result = this.calculate(current, operator, right);
      if (result === null) return;
      const label = `${formatNumber(current)} ${OPERATOR_SYMBOLS[operator]} ${formatNumber(right)} =`;
      this.record(label, result);
      this.display = formatNumber(result);
      this.expression = label;
      this.overwrite = true;
    }
  }

  percent() {
    if (this.hasError) return;
    const current = this.readCurrent();
    if (current === null) return;
    const result = this.pendingOperator && this.accumulator !== null &&
      (this.pendingOperator === '+' || this.pendingOperator === '-')
      ? this.accumulator * current / 100
      : current / 100;
    this.display = formatNumber(result);

    if (this.pendingOperator && this.accumulator !== null) {
      this.expression = `${formatNumber(this.accumulator)} ${OPERATOR_SYMBOLS[this.pendingOperator]} ${this.display}`;
    } else {
      const label = `${formatNumber(current)}% =`;
      this.expression = label;
      this.record(label, normalise(result));
      this.lastOperator = null;
      this.lastOperand = null;
    }
    this.overwrite = true;
  }

  unary(operation: UnaryOperation) {
    if (this.hasError) return;
    const current = this.readCurrent();
    if (current === null) return;

    let result: number;
    let label: string;
    if (operation === 'reciprocal') {
      if (current === 0) {
        this.showError('Cannot divide by zero');
        return;
      }
      result = 1 / current;
      label = `1/(${formatNumber(current)})`;
    } else if (operation === 'square') {
      result = current * current;
      label = `sqr(${formatNumber(current)})`;
    } else {
      if (current < 0) {
        this.showError('Invalid input');
        return;
      }
      result = Math.sqrt(current);
      label = `√(${formatNumber(current)})`;
    }

    if (!Number.isFinite(result)) {
      this.showError('Result is too large');
      return;
    }

    const normalised = normalise(result);
    this.display = formatNumber(normalised);
    if (this.pendingOperator && this.accumulator !== null) {
      this.expression = `${formatNumber(this.accumulator)} ${OPERATOR_SYMBOLS[this.pendingOperator]} ${label}`;
    } else {
      const historyLabel = `${label} =`;
      this.expression = historyLabel;
      this.record(historyLabel, normalised);
      this.lastOperator = null;
      this.lastOperand = null;
    }
    this.overwrite = true;
  }

  memoryStore() {
    const value = this.hasError ? null : this.readCurrent();
    if (value !== null) this.memory = value;
  }

  memoryRecall() {
    if (this.memory === null) return;
    this.display = formatNumber(this.memory);
    this.hasError = false;
    this.overwrite = true;
  }

  memoryAdjust(direction: 1 | -1) {
    const value = this.hasError ? null : this.readCurrent();
    if (value === null) return;
    this.memory = normalise((this.memory ?? 0) + value * direction);
  }

  useHistory(entry: HistoryEntry) {
    this.display = formatNumber(entry.result);
    this.expression = entry.expression;
    this.hasError = false;
    this.overwrite = true;
    this.resetBinaryState();
  }

  clearHistory() {
    this.history = [];
  }
}
