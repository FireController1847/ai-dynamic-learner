import { useStatistics, useStatisticsVisits } from '../../components/statistics-context.ts';
import { Icon } from '../../components/icon.ts';
import { clearPreference, readNumberPreference, writeNumberPreference } from '../../core/ui-preferences.ts';
import {
  parseMathPrint, tokenizeMathPrintText, type MathPrintNode,
} from './calculator-entry.ts';
import { CalculatorSettings } from './calculator-settings.ts';
import { CalculatorModel, type HistoryEntry, type Operator } from './calculator-model.ts';
import type { DecimalPlaces, FractionParts } from './calculator-format.ts';

import {
  defineComponent, h, nextTick, onActivated, onBeforeUnmount, onDeactivated, reactive, ref, watch,
  type VNode,
} from 'vue';

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
    const statistics = useStatistics();
    useStatisticsVisits('calculator', () => null, () => true, 'views', () => 'calculator');
    watch(() => calculator.history[0], entry => { if (entry) statistics?.record('calculator', null, 'calculations'); });
    const scientificOpen = ref(false);
    const settingsOpen = ref(false);
    const clearHistoryArmed = ref(false);
    const settingsButton = ref<HTMLButtonElement | null>(null);
    let listening = false;

    function handleKeyboard(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]') || target?.closest('a[href]')) return;
      const button = target?.closest('button');
      if (button && !button.closest('.calculator-page')) return;
      if (button && (event.key === 'Enter' || event.key === ' ')) return;

      clearHistoryArmed.value = false;

      if (/^\d$/.test(event.key)) calculator.inputDigit(event.key);
      else if (event.key === '.') calculator.inputDecimal();
      else if (event.key === ',') calculator.inputComma();
      else if (['+', '-', '*', '/', '^'].includes(event.key)) calculator.chooseOperator(event.key as Operator);
      else if (event.key === '(') calculator.inputParenthesis(true);
      else if (event.key === ')') calculator.inputParenthesis(false);
      else if (event.key === '!') calculator.inputPostfix('!');
      else if (event.key === '%') calculator.inputPostfix('%');
      else if (event.key === 'Enter' || event.key === '=') calculator.equals();
      else if (event.key === 'Backspace') calculator.backspace();
      else if (event.key === 'Delete') calculator.deleteForward();
      else if (event.key === 'Insert') calculator.toggleOverwriteMode();
      else if (event.key === 'Escape') calculator.clearAll();
      else if (event.key === 'ArrowUp') calculator.moveVertical('up');
      else if (event.key === 'ArrowDown') calculator.moveVertical('down');
      else if (event.key === 'ArrowLeft') calculator.moveLeft();
      else if (event.key === 'ArrowRight') calculator.moveRight();
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

    function pressClear() {
      if (clearHistoryArmed.value) {
        calculator.clearHistory();
        clearHistoryArmed.value = false;
        return;
      }

      calculator.clearAll();
      clearHistoryArmed.value = true;
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
      tooltip?: string,
    ) => h('button', {
      type: 'button',
      class: ['calculator-key', `calculator-key--${kind}`],
      'aria-label': ariaLabel ?? label,
      title: tooltip,
      onClick: action,
    }, label);

    const memoryKey = (label: string, action: () => void, disabled = false, ariaLabel?: string, tooltip?: string) =>
      h('button', {
        type: 'button',
        class: 'calculator-memory-key',
        disabled,
        'aria-label': ariaLabel ?? label,
        title: tooltip ?? ariaLabel,
        onClick: action,
      }, label);

    const fractionTemplateKey = () => h('button', {
      type: 'button',
      class: ['calculator-key', 'calculator-key--function', 'calculator-fraction-template-key'],
      'aria-label': 'Fraction template',
      title: 'Fraction template: enter a numerator over a denominator.',
      onClick: () => calculator.inputFraction(),
    }, [
      h('span', { class: 'calculator-fraction-template-icon', 'aria-hidden': 'true' }, [
        h('span', { class: 'calculator-fraction-template-box' }),
        h('span', { class: 'calculator-fraction-template-bar' }),
        h('span', { class: 'calculator-fraction-template-box' }),
      ]),
    ]);

    const clearKey = () => h('button', {
      type: 'button',
      class: ['calculator-key', 'calculator-key--function', 'calculator-clear-key'],
      'aria-label': 'Clear calculator',
      title: 'C: Clear the current entry. Press C twice in a row to clear history.',
      onClick: pressClear,
    }, 'C');

    const stackedFraction = (fraction: FractionParts, compact = false) => h('span', {
      class: ['calculator-stacked-fraction', { 'is-compact': compact }],
      'aria-hidden': 'true',
    }, [
      h('span', { class: 'calculator-fraction-numerator' }, String(fraction.numerator)),
      h('span', { class: 'calculator-fraction-bar' }),
      h('span', { class: 'calculator-fraction-denominator' }, String(fraction.denominator)),
    ]);

    function placeCursorFromToken(event: PointerEvent, start: number, end: number) {
      event.preventDefault();
      event.stopPropagation();
      if (calculator.overwriteMode) {
        calculator.setCursor(start);
        return;
      }
      const target = event.currentTarget as HTMLElement;
      const bounds = target.getBoundingClientRect();
      calculator.setCursor(event.clientX < bounds.left + bounds.width / 2 ? start : end);
    }

    function renderTextNode(node: Extract<MathPrintNode, { kind: 'text' }>, cursor: number | null) {
      const tokens = tokenizeMathPrintText(node.text, node.start);
      const children: VNode[] = [];

      for (const token of tokens) {
        if (cursor === token.start && !calculator.overwriteMode) {
          children.push(h('span', { class: 'calculator-entry-caret', 'aria-hidden': 'true' }));
        }
        children.push(h('span', {
          class: ['calculator-entry-token', {
            'is-editable': cursor !== null,
            'is-overwrite-cursor': cursor === token.start && calculator.overwriteMode,
          }],
          'data-cursor-start': token.start,
          'data-cursor-end': token.end,
          onPointerdown: cursor === null
            ? undefined
            : (event: PointerEvent) => placeCursorFromToken(event, token.start, token.end),
        }, token.display));
      }

      if (cursor === node.end) {
        children.push(h('span', { class: 'calculator-entry-caret', 'aria-hidden': 'true' }));
      }

      return h('span', { class: 'calculator-entry-text' }, children);
    }

    function renderMathNodes(nodes: MathPrintNode[], cursor: number | null): VNode[] {
      return nodes.map((node) => {
        if (node.kind === 'text') return renderTextNode(node, cursor);

        if (node.kind === 'sqrt') {
          const contentActive = cursor !== null
            && cursor >= node.contentStart && cursor <= node.contentEnd;
          const content = renderMathNodes(node.content, contentActive ? cursor : null);

          return h('span', {
            class: ['calculator-mathprint-radical-wrap', {
              'is-overwrite-cursor': cursor === node.start && calculator.overwriteMode,
            }],
          }, [
            cursor === node.start && !calculator.overwriteMode
              ? h('span', { class: 'calculator-entry-caret', 'aria-hidden': 'true' })
              : null,
            h('span', {
              class: ['calculator-mathprint-radical', { 'is-editable': cursor !== null }],
              onPointerdown: cursor === null ? undefined : (event: PointerEvent) => {
                if (event.target !== event.currentTarget) return;
                event.preventDefault();
                event.stopPropagation();
                calculator.setCursor(node.contentStart);
              },
            }, [
              h('svg', {
                class: 'calculator-radical-symbol',
                viewBox: '0 0 12 14',
                preserveAspectRatio: 'none',
                'aria-hidden': 'true',
                onPointerdown: cursor === null ? undefined : (event: PointerEvent) => {
                  event.preventDefault();
                  event.stopPropagation();
                  calculator.setCursor(calculator.overwriteMode ? node.start : node.contentStart);
                },
              }, [
                h('path', {
                  d: 'M0.75 7.4 L3 7.4 L5.2 12.9 L11.85 0.7',
                  fill: 'none',
                  stroke: 'currentColor',
                  'stroke-width': '1.45',
                  'stroke-linecap': 'square',
                  'stroke-linejoin': 'miter',
                  'vector-effect': 'non-scaling-stroke',
                }),
              ]),
              h('span', {
                class: ['calculator-radical-content', { 'is-active': contentActive }],
                onPointerdown: cursor === null ? undefined : (event: PointerEvent) => {
                  if (event.target !== event.currentTarget) return;
                  event.preventDefault();
                  event.stopPropagation();
                  calculator.setCursor(node.contentEnd);
                },
              }, content.length ? content : contentActive
                ? [h('span', { class: 'calculator-entry-caret', 'aria-hidden': 'true' })]
                : [h('span', { class: 'calculator-mathprint-placeholder' }, '□')]),
            ]),
            cursor === node.end && node.end !== node.contentEnd
              ? h('span', { class: 'calculator-entry-caret', 'aria-hidden': 'true' })
              : null,
          ]);
        }


        if (node.kind === 'power') {
          const contentActive = cursor !== null
            && cursor >= node.contentStart && cursor <= node.contentEnd;
          const content = renderMathNodes(node.content, contentActive ? cursor : null);

          return h('span', {
            class: ['calculator-mathprint-power-wrap', {
              'is-overwrite-cursor': cursor === node.start && calculator.overwriteMode,
            }],
          }, [
            cursor === node.start && !calculator.overwriteMode
              ? h('span', { class: 'calculator-entry-caret', 'aria-hidden': 'true' })
              : null,
            h('span', {
              class: ['calculator-mathprint-power', {
                'is-active': contentActive,
                'is-editable': cursor !== null,
              }],
              onPointerdown: cursor === null ? undefined : (event: PointerEvent) => {
                event.preventDefault();
                event.stopPropagation();
                if (calculator.overwriteMode) {
                  calculator.setCursor(node.contentStart);
                  return;
                }
                const target = event.currentTarget as HTMLElement;
                const bounds = target.getBoundingClientRect();
                calculator.setCursor(
                  event.clientX < bounds.left + bounds.width / 2
                    ? node.contentStart
                    : node.contentEnd,
                );
              },
            }, content.length
              ? content
              : [h('span', { class: 'calculator-mathprint-placeholder' }, '□')]),
            cursor === node.end && node.end !== node.contentEnd
              ? h('span', { class: 'calculator-entry-caret', 'aria-hidden': 'true' })
              : null,
          ]);
        }

        const numeratorActive = cursor !== null
          && cursor >= node.numeratorStart && cursor <= node.numeratorEnd;
        const denominatorActive = cursor !== null
          && cursor >= node.denominatorStart && cursor <= node.denominatorEnd;

        const numerator = renderMathNodes(node.numerator, numeratorActive ? cursor : null);
        const denominator = renderMathNodes(node.denominator, denominatorActive ? cursor : null);

        const fraction = h('span', {
          class: ['calculator-mathprint-fraction', { 'is-editable': cursor !== null }],
          onPointerdown: cursor === null ? undefined : (event: PointerEvent) => {
            if (event.target !== event.currentTarget) return;
            calculator.setCursor(node.denominatorStart);
          },
        }, [
          h('span', {
            class: ['calculator-mathprint-part', { 'is-active': numeratorActive }],
            onPointerdown: cursor === null ? undefined : (event: PointerEvent) => {
              if (event.target !== event.currentTarget) return;
              event.preventDefault();
              event.stopPropagation();
              calculator.setCursor(node.numeratorEnd);
            },
          }, numerator.length ? numerator : numeratorActive
            ? [h('span', { class: 'calculator-entry-caret', 'aria-hidden': 'true' })]
            : [h('span', {
                class: 'calculator-mathprint-placeholder',
                onPointerdown: cursor === null ? undefined : (event: PointerEvent) => {
                  event.preventDefault();
                  event.stopPropagation();
                  calculator.setCursor(node.numeratorStart);
                },
              }, '□')]),
          h('span', {
            class: 'calculator-mathprint-bar',
            onPointerdown: cursor === null ? undefined : (event: PointerEvent) => {
              event.preventDefault();
              event.stopPropagation();
              calculator.setCursor(node.denominatorStart);
            },
          }),
          h('span', {
            class: ['calculator-mathprint-part', { 'is-active': denominatorActive }],
            onPointerdown: cursor === null ? undefined : (event: PointerEvent) => {
              if (event.target !== event.currentTarget) return;
              event.preventDefault();
              event.stopPropagation();
              calculator.setCursor(node.denominatorEnd);
            },
          }, denominator.length ? denominator : denominatorActive
            ? [h('span', { class: 'calculator-entry-caret', 'aria-hidden': 'true' })]
            : [h('span', {
                class: 'calculator-mathprint-placeholder',
                onPointerdown: cursor === null ? undefined : (event: PointerEvent) => {
                  event.preventDefault();
                  event.stopPropagation();
                  calculator.setCursor(node.denominatorStart);
                },
              }, '□')]),
        ]);

        return h('span', {
          class: ['calculator-mathprint-fraction-wrap', {
            'is-overwrite-cursor': cursor === node.start && calculator.overwriteMode,
          }],
        }, [
          cursor === node.start && !calculator.overwriteMode
            ? h('span', { class: 'calculator-entry-caret', 'aria-hidden': 'true' })
            : null,
          fraction,
          cursor === node.end
            ? h('span', { class: 'calculator-entry-caret', 'aria-hidden': 'true' })
            : null,
        ]);
      });
    }

    function renderMathPrint(source: string, cursor: number | null = null) {
      if (!source) {
        return cursor === null
          ? h('span', { class: 'calculator-mathprint-empty' }, '\u00a0')
          : h('span', { class: 'calculator-entry-caret', 'aria-hidden': 'true' });
      }
      return renderMathNodes(parseMathPrint(source), cursor);
    }

    function renderResult(value: number, compact = false) {
      const fraction = calculator.fractionPartsForResult(value);
      return fraction ? stackedFraction(fraction, compact) : calculator.formatResult(value);
    }

    function historyPanelEntry(entry: HistoryEntry) {
      return h('li', { key: entry.id }, [
        h('button', {
          type: 'button',
          class: 'calculator-history-entry',
          title: 'Recall this expression to the calculator',
          onClick: () => calculator.recallHistoryEntry(entry),
        }, [
          h('span', { class: 'calculator-history-expression' }, renderMathPrint(entry.source)),
          h('strong', { class: 'calculator-history-result' }, renderResult(entry.result, true)),
        ]),
      ]);
    }

    return () => {
      const historyEntry = calculator.visibleHistoryEntry();
      const displayFraction = calculator.displayFractionParts();

      return h('section', {
        class: 'calculator-page',
        'aria-label': props.title,
        onPointerdown: (event: PointerEvent) => {
          const target = event.target instanceof Element ? event.target : null;
          if (!target?.closest('.calculator-clear-key')) clearHistoryArmed.value = false;
        },
      }, [
        h('div', { class: 'calculator-layout' }, [
          h('div', { class: 'calculator-machine' }, [
            h('div', { class: 'calculator-display', 'aria-live': 'polite', 'aria-atomic': 'true' }, [
              h('div', {
                class: ['calculator-lcd-row', 'calculator-history-row', {
                  'is-selected': calculator.isBrowsingHistory(),
                }],
              }, [
                h('span', {
                  class: ['calculator-memory-indicator', { 'is-active': calculator.memory !== null }],
                  title: calculator.memory === null ? 'Memory is empty' : `Memory: ${calculator.formatResult(calculator.memory)}`,
                }, 'M'),
                historyEntry ? h('span', { class: 'calculator-history-math' }, [
                  h('span', { class: 'calculator-history-source' }, renderMathPrint(historyEntry.source)),
                  h('span', { class: 'calculator-history-answer' }, renderResult(historyEntry.result, true)),
                ]) : h('span', { class: 'calculator-history-empty-line' }, '\u00a0'),
              ]),
              h('div', {
                class: ['calculator-lcd-row', 'calculator-entry-row', {
                  'is-error': calculator.hasError,
                  'is-result': calculator.justEvaluated,
                  'is-fraction': Boolean(displayFraction),
                }],
              }, calculator.hasError
                ? [h('button', {
                    type: 'button',
                    class: 'calculator-error-text',
                    title: 'Return to the expression and edit it',
                    'aria-label': `${calculator.display}. Return to the expression and edit it`,
                    onClick: () => calculator.recoverError(),
                  }, calculator.display)]
                : calculator.justEvaluated
                  ? [h('output', {
                      class: 'calculator-current-result',
                      'aria-label': displayFraction
                        ? `Calculator result: ${displayFraction.numerator} over ${displayFraction.denominator}`
                        : `Calculator result: ${calculator.display}`,
                    }, displayFraction ? stackedFraction(displayFraction) : calculator.display)]
                  : [h('div', {
                      class: ['calculator-current-entry', {
                        'is-overwrite-mode': calculator.overwriteMode,
                      }],
                      'aria-label': calculator.formattedExpression() || 'Empty calculator entry',
                      onPointerdown: (event: PointerEvent) => {
                        if (event.target === event.currentTarget) calculator.setCursor(calculator.expression.length);
                      },
                    }, renderMathPrint(calculator.expression, calculator.cursor))]),
              h('div', { class: 'calculator-history-arrows', 'aria-label': 'Calculator cursor and history navigation' }, [
                h('button', {
                  type: 'button',
                  class: 'calculator-history-arrow calculator-arrow-up',
                  title: 'Move up in a fraction template or browse older calculations',
                  'aria-label': 'Up',
                  onClick: () => calculator.moveVertical('up'),
                }, '▲'),
                h('button', {
                  type: 'button',
                  class: 'calculator-history-arrow calculator-arrow-left',
                  title: 'Move cursor left',
                  'aria-label': 'Left',
                  onClick: () => calculator.moveLeft(),
                }, '◀'),
                h('button', {
                  type: 'button',
                  class: 'calculator-history-arrow calculator-arrow-right',
                  title: 'Move cursor right or exit the current MathPrint field',
                  'aria-label': 'Right',
                  onClick: () => calculator.moveRight(),
                }, '▶'),
                h('button', {
                  type: 'button',
                  class: 'calculator-history-arrow calculator-arrow-down',
                  title: 'Move down in a fraction template or browse newer calculations',
                  'aria-label': 'Down',
                  onClick: () => calculator.moveVertical('down'),
                }, '▼'),
              ]),
            ]),
            h('div', { class: 'calculator-edit-row', 'aria-label': 'Calculator editing controls' }, [
              h('button', {
                type: 'button',
                class: ['calculator-edit-key', { 'is-active': calculator.overwriteMode }],
                'aria-pressed': calculator.overwriteMode,
                title: calculator.overwriteMode
                  ? 'Overwrite mode is on. Press INS to return to normal insert mode.'
                  : 'INS: Toggle overwrite mode. Normal typing inserts at the cursor.',
                'aria-label': calculator.overwriteMode
                  ? 'Overwrite mode on. Switch to insert mode'
                  : 'Insert mode on. Switch to overwrite mode',
                onClick: () => calculator.toggleOverwriteMode(),
              }, 'INS'),
              h('button', {
                type: 'button',
                class: 'calculator-edit-key',
                title: 'BCK: Delete the item immediately left of the cursor.',
                onClick: () => calculator.backspace(),
              }, 'BCK'),
              h('button', {
                type: 'button',
                class: 'calculator-edit-key',
                title: 'DEL: Delete the item at the cursor.',
                onClick: () => calculator.deleteForward(),
              }, 'DEL'),
            ]),
            h('div', { class: 'calculator-mode-row' }, [
              h('button', {
                type: 'button',
                class: 'quiet-button calculator-angle-mode',
                title: calculator.angleMode === 'DEG'
                  ? 'Angles use degrees. Click to switch to radians.'
                  : 'Angles use radians. Click to switch to degrees.',
                'aria-label': `Angle mode: ${calculator.angleMode}. Change angle mode`,
                onClick: () => calculator.toggleAngleMode(),
              }, calculator.angleMode),
              h('button', {
                type: 'button',
                class: ['quiet-button', 'calculator-fraction-toggle', {
                  'is-active': calculator.displayMode === 'fraction',
                }],
                'aria-pressed': calculator.displayMode === 'fraction',
                title: calculator.displayMode === 'fraction'
                  ? 'FR↔DC: Fraction result mode is on. Click to return to decimal; C also resets it.'
                  : 'FR↔DC: Prefer fraction form for eligible results until toggled off or C is pressed.',
                'aria-label': calculator.displayMode === 'fraction'
                  ? 'Fraction result mode on. Switch to decimal results'
                  : 'Decimal result mode on. Switch to fraction results',
                onClick: () => calculator.toggleFractionDecimal(),
              }, 'FR↔DC'),
              h('button', {
                type: 'button',
                class: 'quiet-button calculator-scientific-toggle',
                'aria-expanded': scientificOpen.value,
                'aria-controls': 'calculator-scientific-keypad',
                title: scientificOpen.value ? 'Hide scientific functions' : 'Show scientific functions',
                onClick: () => { scientificOpen.value = !scientificOpen.value; },
              }, scientificOpen.value ? 'Hide scientific' : 'Scientific'),
              h('span', { class: 'calculator-mode-description' }, 'MathPrint · expression history'),
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
              memoryKey('MC', () => { calculator.memory = null; }, calculator.memory === null,
                'Clear memory', 'MC: Clear the stored memory value.'),
              memoryKey('MR', () => calculator.memoryRecall(), calculator.memory === null,
                'Recall memory', 'MR: Recall the stored memory value into the entry.'),
              memoryKey('M+', () => calculator.memoryAdjust(1), false,
                'Add to memory', 'M+: Add the current value to memory.'),
              memoryKey('M−', () => calculator.memoryAdjust(-1), false,
                'Subtract from memory', 'M−: Subtract the current value from memory.'),
              memoryKey('MS', () => calculator.memoryStore(), false,
                'Store in memory', 'MS: Store the current value in memory.'),
            ]),
            h('div', {
              id: 'calculator-scientific-keypad',
              class: ['calculator-scientific-keypad', { 'is-expanded': scientificOpen.value }],
              'aria-label': 'Scientific functions',
            }, [
              key('(', () => calculator.inputParenthesis(true), 'function', 'Open parenthesis'),
              key(')', () => calculator.inputParenthesis(false), 'function', 'Close parenthesis'),
              key('%', () => calculator.inputPostfix('%'), 'function', 'Percent'),
              key('π', () => calculator.inputConstant('pi'), 'function', 'Pi'),
              key('e', () => calculator.inputConstant('e'), 'function', 'Euler’s number'),

              key('Ans', () => calculator.inputConstant('ans'), 'function', 'Previous answer',
                'Ans: Insert the previous evaluated answer.'),
              key('sin', () => calculator.inputFunction('sin'), 'function', 'Sine'),
              key('cos', () => calculator.inputFunction('cos'), 'function', 'Cosine'),
              key('tan', () => calculator.inputFunction('tan'), 'function', 'Tangent'),
              key('ln', () => calculator.inputFunction('ln'), 'function', 'Natural logarithm',
                'ln: Natural logarithm, base e.'),

              key('log', () => calculator.inputFunction('log'), 'function', 'Base 10 logarithm',
                'log: Common logarithm, base 10.'),
              key('sin⁻¹', () => calculator.inputFunction('asin'), 'function', 'Inverse sine',
                'sin⁻¹: Inverse sine (arcsin).'),
              key('cos⁻¹', () => calculator.inputFunction('acos'), 'function', 'Inverse cosine',
                'cos⁻¹: Inverse cosine (arccos).'),
              key('tan⁻¹', () => calculator.inputFunction('atan'), 'function', 'Inverse tangent',
                'tan⁻¹: Inverse tangent (arctan).'),
              key('rnd', () => calculator.inputRound(), 'function', 'Round to decimal places',
                'rnd: Wrap the current value, then enter how many decimal places to keep.'),

              key('√x', () => calculator.inputFunction('sqrt'), 'function', 'Square root',
                '√x: Take the square root of a value.'),
              key('xʸ', () => calculator.chooseOperator('^'), 'function', 'Raise to a power',
                'xʸ: Raise the current value to a power.'),
              key('x²', () => calculator.inputPowerShortcut('2'), 'function', 'Square',
                'x²: Square the current value.'),
              key('1/x', () => calculator.inputPowerShortcut('-1'), 'function', 'Reciprocal',
                '1/x: Take the reciprocal of the current value.'),
              key('n!', () => calculator.inputPostfix('!'), 'function', 'Factorial',
                'n!: Factorial. Multiplies each positive integer from n down to 1.'),
              key('10ˣ', () => calculator.inputPowerFunction('10'), 'function', 'Ten to a power',
                '10ˣ: Raise 10 to a power.'),
              key('eˣ', () => calculator.inputPowerFunction('e'), 'function', 'Euler’s number to a power',
                'eˣ: Raise Euler’s number e to a power.'),
              key(',', () => calculator.inputComma(), 'function', 'Argument separator',
                'Comma: Separate function arguments, such as rnd(value, places).'),
            ]),
            h('div', { class: 'calculator-keypad calculator-basic-keypad', 'aria-label': 'Calculator keypad' }, [
              fractionTemplateKey(),
              key('%', () => calculator.inputPostfix('%'), 'function', 'Percent'),
              key('CE', () => calculator.clearEntry(), 'function', 'Clear entry'),
              clearKey(),

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

              key('=', () => calculator.equals(), 'equals',
                calculator.isBrowsingHistory() ? 'Recall selected history expression' : 'Evaluate expression'),
            ]),
            h('p', { class: 'calculator-keyboard-hint' },
              'Keyboard: normal typing inserts; Insert toggles overwrite mode. Supports 0–9, operators, decimal point, comma, parentheses, !, %, Enter, Backspace, Delete, Escape, and arrow keys.'),
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
              ? h('ol', { class: 'calculator-history-list' }, calculator.history.map(historyPanelEntry))
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
    };
  },
});
