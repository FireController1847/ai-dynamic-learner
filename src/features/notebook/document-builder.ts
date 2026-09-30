import type { DocumentTypeId } from './document-types.ts';
import { DOCUMENT_TYPES } from './document-types.ts';
import { DocumentTypeIcon } from './document-type-icon.ts';

import { defineComponent, h } from 'vue';

export const DocumentBuilder = defineComponent({
  name: 'NotebookDocumentBuilder',
  props: {
    destination: { type: String, required: true },
  },
  emits: { 'create': (_type: DocumentTypeId) => true, 'cancel': () => true },
  setup(props, { emit }) {
    return () => h('section', {
      class: 'notebook-builder',
      'aria-labelledby': 'notebook-builder-title',
    }, [
      h('header', { class: 'notebook-builder-intro' }, [
        h('p', { class: 'notebook-builder-eyebrow' }, 'New document'),
        h('h2', { id: 'notebook-builder-title' }, 'Choose your paper'),
        h('p', `Saved in ${props.destination}. Choose the kind of note you want to create.`),
      ]),
      h('div', { class: 'notebook-type-grid' }, DOCUMENT_TYPES.map((type) =>
        h('button', {
          key: type.id,
          type: 'button',
          class: 'notebook-type-card',
          'aria-disabled': !type.available,
          'aria-describedby': !type.available ? `notebook-coming-${type.id}` : undefined,
          onClick: () => { if (type.available) emit('create', type.id); },
        }, [
          h(DocumentTypeIcon, { type: type.id }),
          h('span', { class: 'notebook-type-copy' }, [
            h('strong', type.label),
            h('span', type.description),
          ]),
          !type.available ? h('span', {
            id: `notebook-coming-${type.id}`, class: 'notebook-coming-tooltip', role: 'tooltip',
          }, 'Coming soon!') : null,
        ]))),
      h('div', { class: 'notebook-builder-actions' }, [
        h('button', {
          type: 'button',
          class: 'quiet-button',
          onClick: () => emit('cancel'),
        }, 'Cancel'),
      ]),
    ]);
  },
});
