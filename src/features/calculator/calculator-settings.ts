import { useDialog } from '../../components/use-dialog.ts';
import type { DecimalPlaces } from './calculator-format.ts';

import { defineComponent, h, type PropType } from 'vue';

export const CalculatorSettings = defineComponent({
  name: 'CalculatorSettings',
  props: {
    decimalPlaces: { type: Number as PropType<DecimalPlaces>, default: null },
  },
  emits: {
    'update-decimal-places': (_value: DecimalPlaces) => true,
    'close': () => true,
  },
  setup(props, { emit }) {
    const { dialog } = useDialog();

    return () => h('dialog', {
      ref: dialog,
      class: 'calculator-settings',
      'aria-labelledby': 'calculator-settings-title',
      onCancel: (event: Event) => {
        event.preventDefault();
        emit('close');
      },
    }, [
      h('header', [
        h('h2', { id: 'calculator-settings-title' }, 'Calculator settings'),
        h('button', {
          type: 'button',
          class: 'quiet-button',
          autofocus: true,
          onClick: () => emit('close'),
        }, 'Done'),
      ]),
      h('div', { class: 'calculator-settings-field' }, [
        h('label', { for: 'calculator-decimal-places' }, 'Decimal places'),
        h('select', {
          id: 'calculator-decimal-places',
          value: props.decimalPlaces === null ? 'float' : String(props.decimalPlaces),
          onChange: (event: Event) => {
            const value = (event.currentTarget as HTMLSelectElement).value;
            emit('update-decimal-places', value === 'float' ? null : Number(value));
          },
        }, [
          h('option', { value: 'float' }, 'FLOAT'),
          ...Array.from({ length: 10 }, (_, value) =>
            h('option', { value: String(value) }, String(value))),
        ]),
      ]),
      h('p', { class: 'calculator-settings-help' },
        'Fixed decimal places change only how answers are displayed. Calculations and memory keep full internal precision.'),
    ]);
  },
});
