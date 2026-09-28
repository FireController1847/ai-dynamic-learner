import { DOCUMENT_TYPES } from './document-types.js';

const { h } = window.Vue;

function PaperIcon({ type }) {
  const common = {
    class: 'notebook-type-icon',
    viewBox: '0 0 96 96',
    width: 96,
    height: 96,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2.5,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  };

  const paper = [
    h('path', { d: 'M24 10h36l12 12v64H24Z' }),
    h('path', { d: 'M60 10v14h12' }),
  ];

  if (type === 'markdown') {
    return h('svg', common, [
      ...paper,
      h('path', { d: 'M34 39v24M34 39l8 9 8-9v24M57 48l6 7 6-7M63 55v-16' }),
    ]);
  }

  if (type === 'lined') {
    return h('svg', common, [
      ...paper,
      ...[36, 46, 56, 66].map((y) => h('path', { d: `M34 ${y}h28` })),
    ]);
  }

  return h('svg', common, [
    ...paper,
    ...[36, 44, 52, 60, 68].map((y) => h('path', { d: `M32 ${y}h32`, opacity: 0.7 })),
    ...[36, 44, 52, 60].map((x) => h('path', { d: `M${x} 32v40`, opacity: 0.7 })),
    h('path', { d: 'M32 62l9-9 8 4 13-16', 'stroke-width': 3 }),
  ]);
}

export const DocumentBuilder = {
  name: 'NotebookDocumentBuilder',
  props: {
    destination: { type: String, required: true },
  },
  emits: ['create', 'cancel'],
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
          onClick: () => emit('create', type.id),
        }, [
          h(PaperIcon, { type: type.id }),
          h('span', { class: 'notebook-type-copy' }, [
            h('strong', type.label),
            h('span', type.description),
          ]),
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
};
