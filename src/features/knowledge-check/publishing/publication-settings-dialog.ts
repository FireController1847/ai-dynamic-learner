import { defineComponent, h, type PropType } from 'vue';
import { PopupDialog } from '../../../components/popup-dialog.ts';
import { PUBLICATION_METADATA_FIELDS, type PublicationSettings } from './publication-model.ts';

export const PublicationSettingsDialog = defineComponent({
  name: 'PublicationSettingsDialog',
  props: { settings: { type: Object as PropType<PublicationSettings>, required: true } },
  emits: { close: () => true, update: (_settings: PublicationSettings) => true },
  setup(props, { emit }) {
    return () => h(PopupDialog, { title: 'Document settings', headingId: 'publication-settings-title', width: 640,
      onClose: () => emit('close') }, { default: () => [
      h('label', { class: 'publication-setting-toggle' }, [
        h('input', { type: 'checkbox', checked: props.settings.alignColumns, disabled: props.settings.columns === 1,
          onChange: (event: Event) => emit('update', { ...props.settings,
            alignColumns: (event.target as HTMLInputElement).checked }) }),
        h('span', 'Align questions across two columns'),
      ]),
      h('p', { class: 'knowledge-muted' }, 'Use two columns to align question pairs. Metadata changes update the preview automatically.'),
      h('div', { class: 'publication-metadata-options' },
        (['questionMetadata', 'keyMetadata'] as const).map(key => h('fieldset', [
          h('legend', key === 'questionMetadata' ? 'Question sheet' : 'Answer key'),
          ...PUBLICATION_METADATA_FIELDS.filter(field => key !== 'keyMetadata' || field.id !== 'questionCount').map(field => h('label', { class: 'publication-setting-toggle' }, [
            h('input', { type: 'checkbox', checked: props.settings[key][field.id],
              onChange: (event: Event) => emit('update', { ...props.settings,
                [key]: { ...props.settings[key], [field.id]: (event.target as HTMLInputElement).checked } }) }),
            h('span', field.label),
          ])),
        ]))),
      h('p', { class: 'knowledge-muted' }, 'Question sheet settings also apply to its cover and bubble answer sheet. Name, Date, and Class are blank fields to fill in.'),
    ] });
  },
});
