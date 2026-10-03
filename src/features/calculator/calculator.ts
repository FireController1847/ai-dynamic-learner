import { defineComponent, h, onActivated, onBeforeUnmount, onDeactivated, ref } from 'vue';

type Operator = '+' | '-' | '*' | '/';
type UnaryOperation = 'reciprocal' | 'square' | 'sqrt';

interface HistoryEntry {
  id: number;
  expression: string;
  result: number;
}

const MAX_INPUT_LENGTH = 18;
const SYMBOLS: Record<Operator, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

function normalise(value: number) {
  return value === 0 ? 0 : Number.parseFloat(value.toPrecision(12));
}

function formatNumber(value: number) {
  const normalised = normalise(value);
  const absolute = Math.abs(normalised);
  if (absolute !== 0 && (absolute >= 1e12 || absolute < 1e-9)) {
    return normalised.toExponential(10).replace(/\.0+e/, 'e').replace(/(\.\d*?[1-9])0+e/, '$1e');
  }
  return String(normalised);
}

export const Calculator = defineComponent({
  name: 'Calculator',
  props: { title: { type: String, required: true } },
  setup(props) {
    const display = ref('0');
    const expression = ref('');
    const accumulator = ref<number | null>(null);
    const pendingOperator = ref<Operator | null>(null);
    const overwrite = ref(true);
    const hasError = ref(false);
    const lastOperator = ref<Operator | null>(null);
    const lastOperand = ref<number | null>(null);
    const memory = ref<number | null>(null);
    const history = ref<HistoryEntry[]>([]);
    let historyId = 0;
    let listening = false;

    function readCurrent() {
      const value = Number(display.value);
      return Number.isFinite(value) ? value : null;
    }

    function resetBinaryState() {
      accumulator.value = null;
      pendingOperator.value = null;
      lastOperator.value = null;
      lastOperand.value = null;
    }

    function showError(message: string) {
      display.value = message;
      expression.value = '';
      hasError.value = true;
      overwrite.value = true;
      resetBinaryState();
    }

    function clearAll() {
      display.value = '0';
      expression.value = '';
      hasError.value = false;
      overwrite.value = true;
      resetBinaryState();
    }

    function clearEntry() {
      if (hasError.value) {
        clearAll();
        return;
      }
      display.value = '0';
      overwrite.value = true;
    }

    function inputDigit(digit: string) {
      if (hasError.value) clearAll();
      if (overwrite.value || display.value === '0') {
        display.value = digit;
        overwrite.value = false;
        return;
      }
      if (display.value.replace('-', '').replace('.', '').length < MAX_INPUT_LENGTH) {
        display.value += digit;
      }
    }

    function inputDecimal() {
      if (hasError.value) clearAll();
      if (overwrite.value) {
        display.value = '0.';
        overwrite.value = false;
      } else if (!display.value.includes('.')) {
        display.value += '.';
      }
    }

    function backspace() {
      if (hasError.value) {
        clearAll();
        return;
      }
      if (overwrite.value) return;
      const next = display.value.slice(0, -1);
      display.value = !next || next === '-' ? '0' : next;
      if (display.value === '0') overwrite.value = true;
    }

    function toggleSign() {
      if (hasError.value || display.value === '0') return;
      display.value = display.value.startsWith('-') ? display.value.slice(1) : `-${display.value}`;
    }

    function calculate(left: number, operator: Operator, right: number) {
      let result: number;
      switch (operator) {
        case '+': result = left + right; break;
        case '-': result = left - right; break;
        case '*': result = left * right; break;
        case '/':
          if (right === 0) {
            showError('Cannot divide by zero');
            return null;
          }
          result = left / right;
          break;
      }
      if (!Number.isFinite(result)) {
        showError('Result is too large');
        return null;
      }
      return normalise(result);
    }

    function chooseOperator(operator: Operator) {
      if (hasError.value) return;
      const current = readCurrent();
      if (current === null) return;

      if (pendingOperator.value && accumulator.value !== null) {
        if (overwrite.value) {
          pendingOperator.value = operator;
          expression.value = `${formatNumber(accumulator.value)} ${SYMBOLS[operator]}`;
          return;
        }
        const result = calculate(accumulator.value, pendingOperator.value, current);
        if (result === null) return;
        accumulator.value = result;
        display.value = formatNumber(result);
      } else {
        accumulator.value = current;
      }

      pendingOperator.value = operator;
      expression.value = `${formatNumber(accumulator.value)} ${SYMBOLS[operator]}`;
      overwrite.value = true;
      lastOperator.value = null;
      lastOperand.value = null;
    }

    function addHistory(left: number, operator: Operator, right: number, result: number) {
      history.value.unshift({
        id: ++historyId,
        expression: `${formatNumber(left)} ${SYMBOLS[operator]} ${formatNumber(right)} =`,
        result,
      });
      if (history.value.length > 30) history.value.pop();
    }

    function equals() {
      if (hasError.value) return;
      const current = readCurrent();
      if (current === null) return;

      if (pendingOperator.value && accumulator.value !== null) {
        const operator = pendingOperator.value;
        const left = accumulator.value;
        const right = current;
        const result = calculate(left, operator, right);
        if (result === null) return;
        addHistory(left, operator, right, result);
        display.value = formatNumber(result);
        expression.value = `${formatNumber(left)} ${SYMBOLS[operator]} ${formatNumber(right)} =`;
        lastOperator.value = operator;
        lastOperand.value = right;
        accumulator.value = null;
        pendingOperator.value = null;
        overwrite.value = true;
        return;
      }

      if (lastOperator.value && lastOperand.value !== null) {
        const operator = lastOperator.value;
        const right = lastOperand.value;
        const result = calculate(current, operator, right);
        if (result === null) return;
        addHistory(current, operator, right, result);
        display.value = formatNumber(result);
        expression.value = `${formatNumber(current)} ${SYMBOLS[operator]} ${formatNumber(right)} =`;
        overwrite.value = true;
      }
    }

    function percent() {
      if (hasError.value) return;
      const current = readCurrent();
      if (current === null) return;
      const result = pendingOperator.value && accumulator.value !== null &&
        (pendingOperator.value === '+' || pendingOperator.value === '-')
        ? accumulator.value * current / 100
        : current / 100;
      display.value = formatNumber(result);
      if (pendingOperator.value && accumulator.value !== null) {
        expression.value = `${formatNumber(accumulator.value)} ${SYMBOLS[pendingOperator.value]} ${display.value}`;
      } else {
        expression.value = `${formatNumber(current)}% =`;
        history.value.unshift({ id: ++historyId, expression: expression.value, result: normalise(result) });
      }
      overwrite.value = true;
    }

    function unary(operation: UnaryOperation) {
      if (hasError.value) return;
      const current = readCurrent();
      if (current === null) return;

      let result: number;
      let label: string;
      if (operation === 'reciprocal') {
        if (current === 0) {
          showError('Cannot divide by zero');
          return;
        }
        result = 1 / current;
        label = `1/(${formatNumber(current)})`;
      } else if (operation === 'square') {
        result = current * current;
        label = `sqr(${formatNumber(current)})`;
      } else {
        if (current < 0) {
          showError('Invalid input');
          return;
        }
        result = Math.sqrt(current);
        label = `√(${formatNumber(current)})`;
      }

      if (!Number.isFinite(result)) {
        showError('Result is too large');
        return;
      }

      const normalised = normalise(result);
      display.value = formatNumber(normalised);
      if (pendingOperator.value && accumulator.value !== null) {
        expression.value = `${formatNumber(accumulator.value)} ${SYMBOLS[pendingOperator.value]} ${label}`;
      } else {
        expression.value = `${label} =`;
        history.value.unshift({ id: ++historyId, expression: expression.value, result: normalised });
      }
      overwrite.value = true;
    }

    function memoryValue() {
      return hasError.value ? null : readCurrent();
    }

    function memoryStore() {
      const value = memoryValue();
      if (value !== null) memory.value = value;
    }

    function memoryRecall() {
      if (memory.value === null) return;
      display.value = formatNumber(memory.value);
      hasError.value = false;
      overwrite.value = true;
    }

    function memoryAdjust(direction: 1 | -1) {
      const value = memoryValue();
      if (value === null) return;
      memory.value = normalise((memory.value ?? 0) + value * direction);
    }

    function useHistory(entry: HistoryEntry) {
      display.value = formatNumber(entry.result);
      expression.value = entry.expression;
      hasError.value = false;
      overwrite.value = true;
      resetBinaryState();
    }

    function handleKeyboard(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^\d$/.test(event.key)) inputDigit(event.key);
      else if (event.key === '.' || event.key === ',') inputDecimal();
      else if (['+', '-', '*', '/'].includes(event.key)) chooseOperator(event.key as Operator);
      else if (event.key === 'Enter' || event.key === '=') equals();
      else if (event.key === 'Backspace') backspace();
      else if (event.key === 'Delete') clearEntry();
      else if (event.key === 'Escape') clearAll();
      else if (event.key === '%') percent();
      else return;
      event.preventDefault();
    }

    function startListening() {
      if (listening) return;
      window.addEventListener('keydown', handleKeyboard);
      listening = true;
    }

    function stopListening() {
      if (!listening) return;
      window.removeEventListener('keydown', handleKeyboard);
      listening = false;
    }

    onActivated(startListening);
    onDeactivated(stopListening);
    onBeforeUnmount(stopListening);
    startListening();

    const key = (
      label: string,
      action: () => void,
      kind: 'number' | 'operator' | 'function' | 'equals' = 'number',
      ariaLabel?: string,
    ) => h('button', {
      type: 'button',
      class: ['calculator-key', `calculator-key--${kind}`],
      'aria-label': ariaLabel ?? label,
      onClick: action,
    }, label);

    const memoryKey = (label: string, action: () => void, disabled = false, ariaLabel?: string) =>
      h('button', {
        type: 'button',
        class: 'calculator-memory-key',
        disabled,
        'aria-label': ariaLabel ?? label,
        onClick: action,
      }, label);

    return () => h('section', { class: 'calculator-page', 'aria-label': props.title }, [
      h('div', { class: 'calculator-layout' }, [
        h('div', { class: 'calculator-machine' }, [
          h('div', { class: 'calculator-display', 'aria-live': 'polite', 'aria-atomic': 'true' }, [
            h('div', { class: 'calculator-display-meta' }, [
              h('span', {
                class: ['calculator-memory-indicator', { 'is-active': memory.value !== null }],
                title: memory.value === null ? 'Memory is empty' : `Memory: ${formatNumber(memory.value)}`,
              }, 'M'),
              h('span', { class: 'calculator-expression' }, expression.value || '\u00a0'),
            ]),
            h('output', {
              class: ['calculator-value', { 'is-error': hasError.value }],
              'aria-label': 'Calculator display',
            }, display.value),
          ]),
          h('div', { class: 'calculator-memory', 'aria-label': 'Memory controls' }, [
            memoryKey('MC', () => { memory.value = null; }, memory.value === null, 'Clear memory'),
            memoryKey('MR', memoryRecall, memory.value === null, 'Recall memory'),
            memoryKey('M+', () => memoryAdjust(1), false, 'Add to memory'),
            memoryKey('M−', () => memoryAdjust(-1), false, 'Subtract from memory'),
            memoryKey('MS', memoryStore, false, 'Store in memory'),
          ]),
          h('div', { class: 'calculator-keypad', 'aria-label': 'Calculator keypad' }, [
            key('%', percent, 'function', 'Percent'),
            key('CE', clearEntry, 'function', 'Clear entry'),
            key('C', clearAll, 'function', 'Clear'),
            key('⌫', backspace, 'function', 'Backspace'),

            key('1/x', () => unary('reciprocal'), 'function', 'Reciprocal'),
            key('x²', () => unary('square'), 'function', 'Square'),
            key('√x', () => unary('sqrt'), 'function', 'Square root'),
            key('÷', () => chooseOperator('/'), 'operator', 'Divide'),

            key('7', () => inputDigit('7')),
            key('8', () => inputDigit('8')),
            key('9', () => inputDigit('9')),
            key('×', () => chooseOperator('*'), 'operator', 'Multiply'),

            key('4', () => inputDigit('4')),
            key('5', () => inputDigit('5')),
            key('6', () => inputDigit('6')),
            key('−', () => chooseOperator('-'), 'operator', 'Subtract'),

            key('1', () => inputDigit('1')),
            key('2', () => inputDigit('2')),
            key('3', () => inputDigit('3')),
            key('+', () => chooseOperator('+'), 'operator', 'Add'),

            key('±', toggleSign, 'function', 'Toggle sign'),
            key('0', () => inputDigit('0')),
            key('.', inputDecimal, 'number', 'Decimal point'),
            key('=', equals, 'equals', 'Equals'),
          ]),
          h('p', { class: 'calculator-keyboard-hint' }, 'Keyboard: 0–9, +, −, × (*), ÷ (/), %, Enter, Backspace, Delete, and Escape.'),
        ]),
        h('aside', { class: 'calculator-history', 'aria-labelledby': 'calculator-history-title' }, [
          h('div', { class: 'calculator-history-header' }, [
            h('h2', { id: 'calculator-history-title' }, 'History'),
            h('button', {
              type: 'button',
              class: 'quiet-button',
              disabled: history.value.length === 0,
              onClick: () => { history.value = []; },
            }, 'Clear'),
          ]),
          history.value.length
            ? h('ol', { class: 'calculator-history-list' }, history.value.map((entry) =>
              h('li', { key: entry.id }, [
                h('button', {
                  type: 'button',
                  class: 'calculator-history-entry',
                  title: 'Use this result',
                  onClick: () => useHistory(entry),
                }, [
                  h('span', { class: 'calculator-history-expression' }, entry.expression),
                  h('strong', formatNumber(entry.result)),
                ]),
              ])))
            : h('div', { class: 'calculator-history-empty' }, [
              h('p', 'No calculations yet.'),
              h('span', 'Completed calculations stay here for this session.'),
            ]),
        ]),
      ]),
    ]);
  },
});
