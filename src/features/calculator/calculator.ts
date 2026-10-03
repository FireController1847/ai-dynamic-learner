import { defineComponent, h, onActivated, onBeforeUnmount, onDeactivated, reactive } from 'vue';
import { CalculatorModel, formatNumber, type HistoryEntry, type Operator } from './calculator-model.ts';

export const Calculator = defineComponent({
  name: 'Calculator',
  props: { title: { type: String, required: true } },
  setup(props) {
    const calculator = reactive(new CalculatorModel());
    let listening = false;

    function handleKeyboard(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]') || target?.closest('a[href]')) return;
      const button = target?.closest('button');
      if (button && !button.closest('.calculator-page')) return;
      if (button && (event.key === 'Enter' || event.key === ' ')) return;

      if (/^\d$/.test(event.key)) calculator.inputDigit(event.key);
      else if (event.key === '.' || event.key === ',') calculator.inputDecimal();
      else if (['+', '-', '*', '/'].includes(event.key)) calculator.chooseOperator(event.key as Operator);
      else if (event.key === 'Enter' || event.key === '=') calculator.equals();
      else if (event.key === 'Backspace') calculator.backspace();
      else if (event.key === 'Delete') calculator.clearEntry();
      else if (event.key === 'Escape') calculator.clearAll();
      else if (event.key === '%') calculator.percent();
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

    const historyEntry = (entry: HistoryEntry) => h('li', { key: entry.id }, [
      h('button', {
        type: 'button',
        class: 'calculator-history-entry',
        title: 'Use this result',
        onClick: () => calculator.useHistory(entry),
      }, [
        h('span', { class: 'calculator-history-expression' }, entry.expression),
        h('strong', formatNumber(entry.result)),
      ]),
    ]);

    return () => h('section', { class: 'calculator-page', 'aria-label': props.title }, [
      h('div', { class: 'calculator-layout' }, [
        h('div', { class: 'calculator-machine' }, [
          h('div', { class: 'calculator-display', 'aria-live': 'polite', 'aria-atomic': 'true' }, [
            h('div', { class: 'calculator-display-meta' }, [
              h('span', {
                class: ['calculator-memory-indicator', { 'is-active': calculator.memory !== null }],
                title: calculator.memory === null ? 'Memory is empty' : `Memory: ${formatNumber(calculator.memory)}`,
              }, 'M'),
              h('span', { class: 'calculator-expression' }, calculator.expression || '\u00a0'),
            ]),
            h('output', {
              class: ['calculator-value', { 'is-error': calculator.hasError }],
              'aria-label': 'Calculator display',
            }, calculator.display),
          ]),
          h('div', { class: 'calculator-memory', 'aria-label': 'Memory controls' }, [
            memoryKey('MC', () => { calculator.memory = null; }, calculator.memory === null, 'Clear memory'),
            memoryKey('MR', () => calculator.memoryRecall(), calculator.memory === null, 'Recall memory'),
            memoryKey('M+', () => calculator.memoryAdjust(1), false, 'Add to memory'),
            memoryKey('M−', () => calculator.memoryAdjust(-1), false, 'Subtract from memory'),
            memoryKey('MS', () => calculator.memoryStore(), false, 'Store in memory'),
          ]),
          h('div', { class: 'calculator-keypad', 'aria-label': 'Calculator keypad' }, [
            key('%', () => calculator.percent(), 'function', 'Percent'),
            key('CE', () => calculator.clearEntry(), 'function', 'Clear entry'),
            key('C', () => calculator.clearAll(), 'function', 'Clear'),
            key('⌫', () => calculator.backspace(), 'function', 'Backspace'),

            key('1/x', () => calculator.unary('reciprocal'), 'function', 'Reciprocal'),
            key('x²', () => calculator.unary('square'), 'function', 'Square'),
            key('√x', () => calculator.unary('sqrt'), 'function', 'Square root'),
            key('÷', () => calculator.chooseOperator('/'), 'operator', 'Divide'),

            key('7', () => calculator.inputDigit('7')),
            key('8', () => calculator.inputDigit('8')),
            key('9', () => calculator.inputDigit('9')),
            key('×', () => calculator.chooseOperator('*'), 'operator', 'Multiply'),

            key('4', () => calculator.inputDigit('4')),
            key('5', () => calculator.inputDigit('5')),
            key('6', () => calculator.inputDigit('6')),
            key('−', () => calculator.chooseOperator('-'), 'operator', 'Subtract'),

            key('1', () => calculator.inputDigit('1')),
            key('2', () => calculator.inputDigit('2')),
            key('3', () => calculator.inputDigit('3')),
            key('+', () => calculator.chooseOperator('+'), 'operator', 'Add'),

            key('±', () => calculator.toggleSign(), 'function', 'Toggle sign'),
            key('0', () => calculator.inputDigit('0')),
            key('.', () => calculator.inputDecimal(), 'number', 'Decimal point'),
            key('=', () => calculator.equals(), 'equals', 'Equals'),
          ]),
          h('p', { class: 'calculator-keyboard-hint' }, 'Keyboard: 0–9, +, −, × (*), ÷ (/), %, Enter, Backspace, Delete, and Escape.'),
        ]),
        h('aside', { class: 'calculator-history', 'aria-labelledby': 'calculator-history-title' }, [
          h('div', { class: 'calculator-history-header' }, [
            h('h2', { id: 'calculator-history-title' }, 'History'),
            h('button', {
              type: 'button',
              class: 'quiet-button',
              disabled: calculator.history.length === 0,
              onClick: () => calculator.clearHistory(),
            }, 'Clear'),
          ]),
          calculator.history.length
            ? h('ol', { class: 'calculator-history-list' }, calculator.history.map(historyEntry))
            : h('div', { class: 'calculator-history-empty' }, [
              h('p', 'No calculations yet.'),
              h('span', 'Completed calculations stay here for this session.'),
            ]),
        ]),
      ]),
    ]);
  },
});
