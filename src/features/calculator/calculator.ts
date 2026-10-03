import { Icon } from '../../components/icon.ts';
import { clearPreference, readNumberPreference, writeNumberPreference } from '../../core/ui-preferences.ts';
import { CalculatorSettings } from './calculator-settings.ts';
import { CalculatorModel, type HistoryEntry, type Operator } from './calculator-model.ts';
import type { DecimalPlaces } from './calculator-format.ts';

import { defineComponent, h, nextTick, onActivated, onBeforeUnmount, onDeactivated, reactive, ref } from 'vue';

const DECIMAL_PLACES_PREFERENCE = 'dynamic-learner.ui.calculator.decimal-places';

function savedDecimalPlaces(): DecimalPlaces {
  const stored = readNumberPreference(DECIMAL_PLACES_PREFERENCE);
  return stored !== null && Number.isInteger(stored) && stored >= 0 && stored <= 9 ? stored : null;
}

export const Calculator = defineComponent({
  name: 'Calculator',
  props: { title: { type: String, required: true } },
  setup(props) {
    const calculator = reactive(new CalculatorModel(savedDecimalPlaces()));
    const scientificOpen = ref(false);
    const settingsOpen = ref(false);
    const settingsButton = ref<HTMLButtonElement | null>(null);
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
      else if (['+', '-', '*', '/', '^'].includes(event.key)) calculator.chooseOperator(event.key as Operator);
      else if (event.key === '(') calculator.inputParenthesis(true);
      else if (event.key === ')') calculator.inputParenthesis(false);
      else if (event.key === '!') calculator.inputPostfix('!');
      else if (event.key === '%') calculator.inputPostfix('%');
      else if (event.key === 'Enter' || event.key === '=') calculator.equals();
      else if (event.key === 'Backspace') calculator.backspace();
      else if (event.key === 'Delete') calculator.clearEntry();
      else if (event.key === 'Escape') calculator.clearAll();
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

    function updateDecimalPlaces(value: DecimalPlaces) {
      calculator.setDecimalPlaces(value);
      if (value === null) clearPreference(DECIMAL_PLACES_PREFERENCE);
      else writeNumberPreference(DECIMAL_PLACES_PREFERENCE, value);
    }

    async function closeSettings() {
      settingsOpen.value = false;
      await nextTick();
      settingsButton.value?.focus();
    }

    onActivated(startListening);
    onDeactivated(() => {
      stopListening();
      settingsOpen.value = false;
    });
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
        h('strong', calculator.formatResult(entry.result)),
      ]),
    ]);

    return () => h('section', { class: 'calculator-page', 'aria-label': props.title }, [
      h('div', { class: 'calculator-layout' }, [
        h('div', { class: 'calculator-machine' }, [
          h('div', { class: 'calculator-display', 'aria-live': 'polite', 'aria-atomic': 'true' }, [
            h('div', { class: 'calculator-display-meta' }, [
              h('span', {
                class: ['calculator-memory-indicator', { 'is-active': calculator.memory !== null }],
                title: calculator.memory === null ? 'Memory is empty' : `Memory: ${calculator.formatResult(calculator.memory)}`,
              }, 'M'),
              h('span', {
                class: 'calculator-expression',
                title: calculator.formattedExpression(),
              }, calculator.formattedExpression() || '\u00a0'),
            ]),
            h('output', {
              class: ['calculator-value', { 'is-error': calculator.hasError }],
              'aria-label': 'Calculator result',
              title: calculator.display,
            }, calculator.display),
          ]),
          h('div', { class: 'calculator-mode-row' }, [
            h('button', {
              type: 'button',
              class: 'quiet-button calculator-angle-mode',
              title: 'Change trigonometric angle mode',
              'aria-label': `Angle mode: ${calculator.angleMode}. Change angle mode`,
              onClick: () => calculator.toggleAngleMode(),
            }, calculator.angleMode),
            h('button', {
              type: 'button',
              class: 'quiet-button calculator-fraction-toggle',
              disabled: !calculator.canToggleFraction(),
              title: 'Toggle the evaluated answer between fraction and decimal',
              'aria-label': 'Toggle fraction and decimal answer',
              onClick: () => calculator.toggleFractionDecimal(),
            }, 'FR↔DC'),
            h('button', {
              type: 'button',
              class: 'quiet-button calculator-scientific-toggle',
              'aria-expanded': scientificOpen.value,
              'aria-controls': 'calculator-scientific-keypad',
              onClick: () => { scientificOpen.value = !scientificOpen.value; },
            }, scientificOpen.value ? 'Hide scientific' : 'Scientific'),
            h('span', { class: 'calculator-mode-description' }, 'Expression mode · standard scientific functions'),
            h('button', {
              ref: settingsButton,
              type: 'button',
              class: 'icon-button calculator-settings-trigger',
              title: 'Calculator settings',
              'aria-label': 'Calculator settings',
              'aria-haspopup': 'dialog',
              onClick: () => { settingsOpen.value = true; },
            }, [h(Icon, { name: 'settings' })]),
          ]),
          h('div', { class: 'calculator-memory', 'aria-label': 'Memory controls' }, [
            memoryKey('MC', () => { calculator.memory = null; }, calculator.memory === null, 'Clear memory'),
            memoryKey('MR', () => calculator.memoryRecall(), calculator.memory === null, 'Recall memory'),
            memoryKey('M+', () => calculator.memoryAdjust(1), false, 'Add to memory'),
            memoryKey('M−', () => calculator.memoryAdjust(-1), false, 'Subtract from memory'),
            memoryKey('MS', () => calculator.memoryStore(), false, 'Store in memory'),
          ]),
          h('div', {
            id: 'calculator-scientific-keypad',
            class: ['calculator-scientific-keypad', { 'is-expanded': scientificOpen.value }],
            'aria-label': 'Scientific functions',
          }, [
            key('(', () => calculator.inputParenthesis(true), 'function', 'Open parenthesis'),
            key(')', () => calculator.inputParenthesis(false), 'function', 'Close parenthesis'),
            key('π', () => calculator.inputConstant('pi'), 'function', 'Pi'),
            key('e', () => calculator.inputConstant('e'), 'function', 'Euler’s number'),
            key('Ans', () => calculator.inputConstant('ans'), 'function', 'Previous answer'),

            key('sin', () => calculator.inputFunction('sin'), 'function', 'Sine'),
            key('cos', () => calculator.inputFunction('cos'), 'function', 'Cosine'),
            key('tan', () => calculator.inputFunction('tan'), 'function', 'Tangent'),
            key('ln', () => calculator.inputFunction('ln'), 'function', 'Natural logarithm'),
            key('log', () => calculator.inputFunction('log'), 'function', 'Base 10 logarithm'),

            key('sin⁻¹', () => calculator.inputFunction('asin'), 'function', 'Inverse sine'),
            key('cos⁻¹', () => calculator.inputFunction('acos'), 'function', 'Inverse cosine'),
            key('tan⁻¹', () => calculator.inputFunction('atan'), 'function', 'Inverse tangent'),
            key('√x', () => calculator.inputFunction('sqrt'), 'function', 'Square root'),
            key('xʸ', () => calculator.chooseOperator('^'), 'function', 'Raise to a power'),

            key('x²', () => calculator.inputPowerShortcut('2'), 'function', 'Square'),
            key('1/x', () => calculator.inputPowerShortcut('-1'), 'function', 'Reciprocal'),
            key('n!', () => calculator.inputPostfix('!'), 'function', 'Factorial'),
            key('10ˣ', () => calculator.inputPowerFunction('10'), 'function', 'Ten to a power'),
            key('eˣ', () => calculator.inputPowerFunction('e'), 'function', 'Euler’s number to a power'),
          ]),
          h('div', { class: 'calculator-keypad calculator-basic-keypad', 'aria-label': 'Calculator keypad' }, [
            key('%', () => calculator.inputPostfix('%'), 'function', 'Percent'),
            key('CE', () => calculator.clearEntry(), 'function', 'Clear entry'),
            key('C', () => calculator.clearAll(), 'function', 'Clear expression'),
            key('⌫', () => calculator.backspace(), 'function', 'Backspace'),

            key('7', () => calculator.inputDigit('7')),
            key('8', () => calculator.inputDigit('8')),
            key('9', () => calculator.inputDigit('9')),
            key('÷', () => calculator.chooseOperator('/'), 'operator', 'Divide'),

            key('4', () => calculator.inputDigit('4')),
            key('5', () => calculator.inputDigit('5')),
            key('6', () => calculator.inputDigit('6')),
            key('×', () => calculator.chooseOperator('*'), 'operator', 'Multiply'),

            key('1', () => calculator.inputDigit('1')),
            key('2', () => calculator.inputDigit('2')),
            key('3', () => calculator.inputDigit('3')),
            key('−', () => calculator.chooseOperator('-'), 'operator', 'Subtract'),

            key('±', () => calculator.toggleSign(), 'function', 'Toggle sign'),
            key('0', () => calculator.inputDigit('0')),
            key('.', () => calculator.inputDecimal(), 'number', 'Decimal point'),
            key('+', () => calculator.chooseOperator('+'), 'operator', 'Add'),

            key('=', () => calculator.equals(), 'equals', 'Evaluate expression'),
          ]),
          h('p', { class: 'calculator-keyboard-hint' },
            'Keyboard: 0–9, +, −, × (*), ÷ (/), ^, parentheses, !, %, Enter, Backspace, Delete, and Escape.'),
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
      settingsOpen.value ? h(CalculatorSettings, {
        decimalPlaces: calculator.decimalPlaces,
        onUpdateDecimalPlaces: updateDecimalPlaces,
        onClose: closeSettings,
      }) : null,
    ]);
  },
});
