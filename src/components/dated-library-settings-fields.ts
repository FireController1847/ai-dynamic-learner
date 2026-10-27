import { computed, defineComponent, h, type PropType } from 'vue';
import { inputValue } from '../core/dom.ts';
import { defaultLibrarySettings, expirySetting, type LibrarySettings } from '../core/dated-library.ts';

export const DatedLibrarySettingsFields = defineComponent({
  name: 'DatedLibrarySettingsFields',
  props: {
    settings: { type: Object as PropType<LibrarySettings>, required: true },
    idPrefix: { type: String, required: true },
    pluralLabel: { type: String, default: 'entries' },
  },
  emits: { update: (_settings: LibrarySettings) => true },
  setup(props, { emit }) {
    const heading = computed(() => props.pluralLabel.charAt(0).toUpperCase() + props.pluralLabel.slice(1));
    return () => h('div', [
        h('p', { class: 'display-settings-description' }, `${heading.value} are organized by when you created them. Changes save automatically.`),
        h('div', { class: 'display-settings-fields' }, [
          h('div', { class: 'display-setting' }, [
            h('label', { for: `${props.idPrefix}-library-order` }, 'Date order'),
            h('select', { id: `${props.idPrefix}-library-order`, value: props.settings.order, onChange: (event: Event) => {
              const order = inputValue(event); if (order === 'newest' || order === 'oldest') emit('update', { ...props.settings, order });
            } }, [h('option', { value: 'newest' }, 'Newest first'), h('option', { value: 'oldest' }, 'Oldest first')]),
          ]),
          h('div', { class: 'display-setting' }, [
            h('label', { for: `${props.idPrefix}-library-dates` }, 'Date labels'),
            h('select', { id: `${props.idPrefix}-library-dates`, value: props.settings.dates, onChange: (event: Event) => {
              const dates = inputValue(event); if (dates === 'long' || dates === 'short') emit('update', { ...props.settings, dates });
            } }, [h('option', { value: 'long' }, 'Full dates'), h('option', { value: 'short' }, 'Short dates')]),
          ]),
        ]),
        h('div', { class: 'display-setting dated-expiry-setting' }, [
          h('label', { for: `${props.idPrefix}-expiry-unit` }, 'Archive after'),
          h('div', { class: 'dated-expiry-controls' }, [
            expirySetting(props.settings) ? h('input', { type: 'number', min: 1, max: 365, step: 1,
              value: expirySetting(props.settings)?.amount, 'aria-label': 'Expiry duration',
              onChange: (event: Event) => {
                const amount = Number(inputValue(event)); const expiry = expirySetting(props.settings);
                if (expiry && Number.isInteger(amount) && amount >= 1 && amount <= 365) emit('update', { ...props.settings, expiry: { ...expiry, amount } });
                else if (event.target instanceof HTMLInputElement) event.target.value = String(expiry?.amount ?? 1);
              },
            }) : null,
            h('select', { id: `${props.idPrefix}-expiry-unit`, value: expirySetting(props.settings)?.unit ?? 'never', onChange: (event: Event) => {
              const unit = inputValue(event);
              if (unit === 'never') emit('update', { ...props.settings, expiry: null });
              else if (unit === 'days' || unit === 'weeks' || unit === 'months') emit('update', { ...props.settings, expiry: { amount: expirySetting(props.settings)?.amount ?? 1, unit } });
            } }, [h('option', { value: 'days' }, 'Days'), h('option', { value: 'weeks' }, 'Weeks'), h('option', { value: 'months' }, 'Calendar months'), h('option', { value: 'never' }, 'Never')]),
          ]),
        ]),
        h('p', `${heading.value} gradually turn gray and move to Archive after this duration from creation. Changes apply to all existing ${props.pluralLabel} immediately, including archived ${props.pluralLabel}. Editing does not reset their age. Archived ${props.pluralLabel} stay saved and are included in backups.`),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('update', defaultLibrarySettings()) }, 'Reset library defaults'),
    ]);
  },
});
