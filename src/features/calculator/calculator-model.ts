import {
  completeTrailingClosures, evaluateExpression, formatExpression, type AngleMode,
} from './expression-engine.ts';
import {
  backspaceMathPrint, createFractionTemplate, createRoundTemplate, deleteMathPrintForward, endsValue, fractionContextAt,
  lastOperandStart, moveFractionCursor, moveMathPrintCursor, normaliseMathPrintCursor,
  overwriteRangeAtCursor, parenthesesBalancedEnoughToClose,
} from './calculator-entry.ts';
import {
  formatNumber, fractionForValue, fractionPartsForValue, normaliseNumber,
  type DecimalPlaces, type FractionParts,
} from './calculator-format.ts';

export type Operator = '+' | '-' | '*' | '/' | '^';
export type ScientificFunction = 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan' | 'ln' | 'log' | 'sqrt';

export interface HistoryEntry {
  id: number;
  source: string;
  result: number;
}

const MAX_EXPRESSION_LENGTH = 180;

export class CalculatorModel {
  expression = '';
  cursor = 0;
  display = '0';
  hasError = false;
  memory: number | null = null;
  history: HistoryEntry[] = [];
  historyIndex: number | null = null;
  angleMode: AngleMode = 'DEG';
  lastAnswer = 0;
  justEvaluated = false;
  overwriteMode = false;
  decimalPlaces: DecimalPlaces;
  displayMode: 'decimal' | 'fraction' = 'decimal';
  private displayValue = 0;
  private historyId = 0;

  constructor(decimalPlaces: DecimalPlaces = null) {
    this.decimalPlaces = decimalPlaces;
    this.display = this.formatResult(0);
  }

  formattedExpression() {
    return formatExpression(this.expression);
  }

  formatResult(value: number) {
    if (this.displayMode === 'fraction') {
      return fractionForValue(value) ?? formatNumber(value, this.decimalPlaces);
    }
    return formatNumber(value, this.decimalPlaces);
  }

  fractionPartsForResult(value: number): FractionParts | null {
    return this.displayMode === 'fraction' ? fractionPartsForValue(value) : null;
  }

  displayFractionParts(): FractionParts | null {
    if (this.hasError || !this.justEvaluated) return null;
    return this.fractionPartsForResult(this.displayValue);
  }

  visibleHistoryEntry() {
    if (!this.history.length) return null;
    if (this.historyIndex !== null) return this.history[this.historyIndex] ?? null;
    return this.history[this.justEvaluated ? 1 : 0] ?? null;
  }

  isBrowsingHistory() {
    return this.historyIndex !== null;
  }

  toggleFractionDecimal() {
    this.displayMode = this.displayMode === 'fraction' ? 'decimal' : 'fraction';
    if (!this.hasError) this.display = this.formatResult(this.displayValue);
  }

  setDecimalPlaces(decimalPlaces: DecimalPlaces) {
    this.decimalPlaces = decimalPlaces;
    if (!this.hasError) this.display = this.formatResult(this.displayValue);
  }

  private context() {
    return { angleMode: this.angleMode, ans: this.lastAnswer };
  }

  private currentValue() {
    return this.hasError ? null : this.displayValue;
  }

  private showValue(value: number) {
    this.displayValue = normaliseNumber(value);
    this.display = this.formatResult(this.displayValue);
  }

  private dismissHistory() {
    this.historyIndex = null;
  }

  recoverError() {
    if (!this.hasError) return false;
    this.hasError = false;
    this.justEvaluated = false;
    this.display = this.formatResult(this.displayValue);
    return true;
  }

  toggleOverwriteMode() {
    if (this.justEvaluated) return;
    this.recoverError();
    this.dismissHistory();
    this.overwriteMode = !this.overwriteMode;
  }

  setCursor(position: number) {
    if (this.justEvaluated) return;
    this.recoverError();
    this.dismissHistory();
    this.cursor = normaliseMathPrintCursor(this.expression, position);
  }

  moveHorizontal(direction: 'left' | 'right') {
    if (this.justEvaluated) return;
    this.recoverError();
    this.dismissHistory();
    this.cursor = moveMathPrintCursor(this.expression, this.cursor, direction);
  }

  private prepareValue() {
    this.dismissHistory();
    this.recoverError();
    if (this.justEvaluated) {
      this.expression = '';
      this.cursor = 0;
      this.justEvaluated = false;
    }
  }

  private insert(text: string, forceInsert = false) {
    const overwrite = this.overwriteMode && !forceInsert
      ? overwriteRangeAtCursor(this.expression, this.cursor)
      : null;
    const replacedLength = overwrite ? overwrite.end - overwrite.start : 0;
    if (this.expression.length - replacedLength + text.length > MAX_EXPRESSION_LENGTH) return false;

    if (overwrite) {
      this.expression = this.expression.slice(0, overwrite.start)
        + text
        + this.expression.slice(overwrite.end);
      this.cursor = overwrite.start + text.length;
    } else {
      this.expression = this.expression.slice(0, this.cursor) + text + this.expression.slice(this.cursor);
      this.cursor += text.length;
    }

    this.refreshPreview();
    return true;
  }

  private appendValue(text: string) {
    this.prepareValue();
    const before = this.expression.slice(0, this.cursor);
    this.insert(`${endsValue(before) ? '*' : ''}${text}`);
  }

  private refreshPreview() {
    if (!this.expression) {
      this.showValue(0);
      return;
    }
    try {
      this.showValue(evaluateExpression(completeTrailingClosures(this.expression), this.context()));
      this.hasError = false;
    } catch {
      // Incomplete MathPrint templates and operators retain the last valid value.
    }
  }

  private fail(error: unknown) {
    this.display = error instanceof Error ? error.message : String(error);
    this.hasError = true;
    this.justEvaluated = false;
  }

  clearAll() {
    this.displayMode = 'decimal';
    this.expression = '';
    this.cursor = 0;
    this.historyIndex = null;
    this.overwriteMode = false;
    this.showValue(0);
    this.hasError = false;
    this.justEvaluated = false;
  }

  clearEntry() {
    this.dismissHistory();
    this.recoverError();
    if (this.justEvaluated) {
      this.expression = '';
      this.cursor = 0;
      this.justEvaluated = false;
      this.showValue(0);
      return;
    }

    const fraction = fractionContextAt(this.expression, this.cursor);
    if (fraction?.field === 'numerator') {
      this.expression = this.expression.slice(0, fraction.numeratorStart)
        + this.expression.slice(fraction.numeratorEnd);
      this.cursor = fraction.numeratorStart;
    } else if (fraction?.field === 'denominator') {
      this.expression = this.expression.slice(0, fraction.denominatorStart)
        + this.expression.slice(fraction.denominatorEnd);
      this.cursor = fraction.denominatorStart;
    } else {
      const before = this.expression.slice(0, this.cursor);
      const start = lastOperandStart(before);
      this.expression = this.expression.slice(0, start) + this.expression.slice(this.cursor);
      this.cursor = start;
    }
    this.refreshPreview();
  }

  backspace() {
    this.dismissHistory();
    this.recoverError();
    if (this.justEvaluated) {
      this.justEvaluated = false;
      this.cursor = this.expression.length;
    }

    const edited = backspaceMathPrint(this.expression, this.cursor);
    this.expression = edited.source;
    this.cursor = edited.cursor;
    this.refreshPreview();
  }

  deleteForward() {
    this.dismissHistory();
    if (this.justEvaluated) return;
    this.recoverError();

    const edited = deleteMathPrintForward(this.expression, this.cursor);
    this.expression = edited.source;
    this.cursor = edited.cursor;
    this.refreshPreview();
  }

  inputDigit(digit: string) {
    this.prepareValue();
    const before = this.expression.slice(0, this.cursor);
    if (endsValue(before) && /(?:\)|!|%|pi|e|ans)$/.test(before)) {
      this.insert(`*${digit}`);
      return;
    }
    this.insert(digit);
  }

  inputDecimal() {
    this.prepareValue();
    const before = this.expression.slice(0, this.cursor);
    if (!before || /[+\-*/^(,]$/.test(before)) {
      this.insert('0.');
      return;
    }
    if (/(?:\)|!|%|pi|e|ans)$/.test(before)) {
      this.insert('*0.');
      return;
    }
    const currentNumber = before.match(/(?:^|[+\-*/^(,])(\d*\.?\d*)$/)?.[1] ?? '';
    if (!currentNumber.includes('.')) this.insert('.');
  }

  inputComma() {
    this.dismissHistory();
    this.recoverError();
    if (this.justEvaluated) return;

    if (this.expression[this.cursor] === ',') {
      this.cursor += 1;
      this.overwriteMode = false;
      return;
    }

    const before = this.expression.slice(0, this.cursor);
    if (!endsValue(before) || before.endsWith(',')) return;

    this.insert(',', true);
  }

  inputFraction() {
    this.prepareValue();
    const template = createFractionTemplate(this.expression, this.cursor);
    if (template.source.length > MAX_EXPRESSION_LENGTH) return;
    this.expression = template.source;
    this.cursor = template.cursor;
    this.refreshPreview();
  }

  inputRound() {
    this.prepareValue();
    const template = createRoundTemplate(this.expression, this.cursor);
    if (template.source.length > MAX_EXPRESSION_LENGTH) return;
    this.expression = template.source;
    this.cursor = template.cursor;
    this.refreshPreview();
  }

  chooseOperator(operator: Operator) {
    this.recoverError();
    this.dismissHistory();

    if (this.justEvaluated) {
      this.expression = 'ans';
      this.cursor = this.expression.length;
      this.justEvaluated = false;
    }

    const fraction = fractionContextAt(this.expression, this.cursor);
    if (fraction?.field === 'denominator'
      && fraction.denominatorStart < fraction.denominatorEnd
      && this.cursor === fraction.denominatorEnd) {
      this.cursor = fraction.close + 1;
    }

    const before = this.expression.slice(0, this.cursor);
    if (!before) {
      if (operator === '-') this.insert('-');
      return;
    }
    if (/[,(]$/.test(before)) {
      if (operator === '-') this.insert('-');
      return;
    }

    if (/[+\-*/^]$/.test(before)) {
      if (operator === '-' && !before.endsWith('-')) {
        this.insert('-');
        return;
      }
      this.expression = this.expression.slice(0, this.cursor - 1)
        + operator + this.expression.slice(this.cursor);
      this.refreshPreview();
      return;
    }

    if (endsValue(before)) this.insert(operator);
  }

  inputParenthesis(open: boolean) {
    if (open) {
      this.prepareValue();
      const before = this.expression.slice(0, this.cursor);
      this.insert(`${endsValue(before) ? '*' : ''}(`);
      return;
    }
    const before = this.expression.slice(0, this.cursor);
    if (parenthesesBalancedEnoughToClose(before) && endsValue(before)) this.insert(')');
  }

  inputFunction(name: ScientificFunction) {
    this.appendValue(`${name}(`);
  }

  inputConstant(name: 'pi' | 'e' | 'ans') {
    this.appendValue(name);
  }

  inputPostfix(operator: '!' | '%') {
    this.recoverError();
    this.dismissHistory();
    if (this.justEvaluated) {
      this.expression = 'ans';
      this.cursor = this.expression.length;
      this.justEvaluated = false;
    }
    if (endsValue(this.expression.slice(0, this.cursor))) this.insert(operator);
  }

  inputPowerShortcut(power: '2' | '-1') {
    this.recoverError();
    this.dismissHistory();
    if (this.justEvaluated) {
      this.expression = 'ans';
      this.cursor = this.expression.length;
      this.justEvaluated = false;
    }
    if (endsValue(this.expression.slice(0, this.cursor))) {
      this.insert(power === '2' ? '^(2)' : '^(-1)');
    }
  }

  inputPowerFunction(base: '10' | 'e') {
    this.appendValue(`${base}^(`);
  }

  toggleSign() {
    this.recoverError();
    this.dismissHistory();
    if (this.justEvaluated) {
      this.expression = 'ans';
      this.cursor = this.expression.length;
      this.justEvaluated = false;
    }

    const before = this.expression.slice(0, this.cursor);
    if (!before || /[+\-*/^(,]$/.test(before)) {
      this.insert('-');
      return;
    }

    const start = lastOperandStart(before);
    if (start >= this.cursor) return;
    const operand = this.expression.slice(start, this.cursor);
    const negative = operand.match(/^\(-(.+)\)$/);
    const replacement = negative ? negative[1] : `(-${operand})`;
    this.expression = this.expression.slice(0, start) + replacement + this.expression.slice(this.cursor);
    this.cursor = start + replacement.length;
    this.refreshPreview();
  }

  equals() {
    if (this.historyIndex !== null) {
      this.recallHistorySelection();
      return;
    }
    if (!this.expression) return;

    try {
      const result = normaliseNumber(evaluateExpression(
        completeTrailingClosures(this.expression),
        this.context(),
      ));
      const source = this.expression;
      this.history.unshift({
        id: ++this.historyId,
        source,
        result,
      });
      if (this.history.length > 30) this.history.pop();
      this.lastAnswer = result;
      this.showValue(result);
      this.hasError = false;
      this.justEvaluated = true;
      this.cursor = this.expression.length;
    } catch (error) {
      this.fail(error);
    }
  }

  moveVertical(direction: 'up' | 'down') {
    if (!this.justEvaluated) {
      this.recoverError();
      const moved = moveFractionCursor(this.expression, this.cursor, direction);
      if (moved !== null) {
        this.cursor = moved;
        return;
      }
    }

    if (!this.history.length) return;
    if (direction === 'up') {
      this.historyIndex = this.historyIndex === null
        ? 0
        : Math.min(this.history.length - 1, this.historyIndex + 1);
    } else if (this.historyIndex !== null) {
      this.historyIndex = this.historyIndex === 0 ? null : this.historyIndex - 1;
    }
  }

  moveRight() {
    this.moveHorizontal('right');
  }

  moveLeft() {
    this.moveHorizontal('left');
  }

  recallHistorySelection() {
    if (this.historyIndex === null) return false;
    const entry = this.history[this.historyIndex];
    if (!entry) return false;
    this.recallHistoryEntry(entry);
    return true;
  }

  recallHistoryEntry(entry: HistoryEntry) {
    this.expression = entry.source;
    this.cursor = entry.source.length;
    this.historyIndex = null;
    this.hasError = false;
    this.justEvaluated = false;
    this.refreshPreview();
  }

  toggleAngleMode() {
    this.angleMode = this.angleMode === 'DEG' ? 'RAD' : 'DEG';
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

  clearHistory() {
    this.history = [];
    this.historyIndex = null;
  }
}
