import { defineComponent, h, ref, type PropType } from 'vue';
import { useDialog } from '../../components/use-dialog.ts';
import { inputValue } from '../../core/dom.ts';
import { DOCUMENT_TYPES, type DocumentTypeId } from './document-types.ts';
import { GraphPaper } from './graph-paper.ts';
import { defaultGraphView } from './graph-model.ts';
import {
  LINED_FIELDS, MARKDOWN_FIELDS, GRAPH_FIELDS, defaultLinedDisplay, defaultMarkdownDisplay, defaultGraphDisplay,
  notebookDisplayStyles, resolvedNotebookDisplay, validateNotebookDisplay, type NotebookDisplay,
} from './display-options.ts';

export const DisplaySettings = defineComponent({
  name: 'NotebookDisplaySettings',
  props: {
    options: { type: Object as PropType<NotebookDisplay>, required: true },
    initialTab: { type: String as PropType<DocumentTypeId>, default: 'lined' },
  },
  emits: { update: (_options: NotebookDisplay) => true, close: () => true },
  setup(props, { emit }) {
    const { dialog } = useDialog();
    const tab = ref<DocumentTypeId>(props.initialTab);
    function selectTab(event: KeyboardEvent, index: number) {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % DOCUMENT_TYPES.length;
      else if (event.key === 'ArrowLeft') next = (index + DOCUMENT_TYPES.length - 1) % DOCUMENT_TYPES.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = DOCUMENT_TYPES.length - 1;
      else return;
      event.preventDefault();
      tab.value = DOCUMENT_TYPES[next]!.id;
      dialog.value?.querySelector<HTMLButtonElement>(`#notebook-tab-${tab.value}`)?.focus();
    }
    function control(field: (typeof LINED_FIELDS)[number] | (typeof MARKDOWN_FIELDS)[number] | (typeof GRAPH_FIELDS)[number]) {
      const type = tab.value;
      const options = resolvedNotebookDisplay(props.options);
      const value = Reflect.get(options[type], field.key) as string | number;
      const id = `notebook-display-${type}-${field.key}`;
      const update = (event: Event) => {
        const next = { ...props.options, [type]: {
          ...options[type], [field.key]: field.choices ? inputValue(event) : Number(inputValue(event)),
        } };
        validateNotebookDisplay(next);
        emit('update', next);
      };
      return h('div', { class: 'display-setting', key: id }, [
        h('label', { for: id }, field.label),
        field.choices ? h('select', { id, value, onChange: update },
          field.choices.map(choice => h('option', { value: choice.value }, choice.label)))
          : h('div', { class: 'display-setting-range' }, [
            h('input', { id, type: 'range', min: field.min, max: field.max, step: field.step,
              value, onInput: update, 'aria-valuetext': `${value}${field.unit}` }),
            h('output', { for: id }, `${value}${field.unit}`),
          ]),
      ]);
    }
    function preview(type: DocumentTypeId) {
      if (type === 'graph') return h('div', { class: 'notebook-graph-preview', 'aria-label': 'Graph Paper appearance preview' }, [
        h(GraphPaper, { view: defaultGraphView(), options: resolvedNotebookDisplay(props.options).graph,
          title: 'A curve to explore', preview: true,
          plots: [{ color: 'blue', plot: { kind: 'function', evaluate: (x: number) => x * x / 4 } }],
        }),
      ]);
      if (type === 'markdown') return h('div', { class: 'notebook-display-sample', 'aria-label': 'Markdown appearance preview' }, [
        h('pre', { class: 'notebook-source-sample' }, '# A thought to keep\n\nA little space to learn.'),
        h('div', { class: 'notebook-display-sample--markdown' }, [
          h('strong', 'A thought to keep'), h('p', 'A little space to think, write, and learn.'),
        ]),
      ]);
      return h('div', { class: 'notebook-lined-preview', 'aria-label': 'Lined Paper appearance preview' }, [
        h('div', { class: 'lined-paper-frame' }, [h('div', { class: 'lined-paper' }, [
          h('div', { class: 'lined-paper-heading' }, [h('input', {
            class: 'lined-paper-title', value: 'Your notes', readonly: true, tabindex: -1, 'aria-label': 'Preview title',
          })]),
          h('div', { class: 'lined-paper-body' }, [
            h('textarea', { class: 'lined-paper-writing lined-paper-margin', value: '1\n2', readonly: true, tabindex: -1, 'aria-label': 'Preview margin notes' }),
            h('textarea', { class: 'lined-paper-writing lined-paper-main', value: 'A thought to keep.\nA little space to learn.', readonly: true, tabindex: -1, 'aria-label': 'Preview notes' }),
          ]),
          h('div', { class: 'lined-paper-holes', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]),
        ])]),
      ]);
    }
    return () => h('dialog', {
      ref: dialog, class: 'display-settings notebook-display-settings',
      style: notebookDisplayStyles(props.options),
      'aria-labelledby': 'notebook-display-settings-title',
      onCancel: (event: Event) => { event.preventDefault(); emit('close'); },
    }, [
      h('header', { class: 'display-settings-header' }, [
        h('h2', { id: 'notebook-display-settings-title' }, 'Notebook display options'),
        h('button', { type: 'button', class: 'quiet-button', autofocus: true, onClick: () => emit('close') }, 'Done'),
      ]),
      h('p', { class: 'display-settings-description' }, 'Each paper type has its own settings. Changes save automatically for all documents of that type and travel with backups.'),
      h('div', { class: 'notebook-display-tabs', role: 'tablist', 'aria-label': 'Document type' },
        DOCUMENT_TYPES.map((type, index) => h('button', {
          type: 'button', role: 'tab', id: `notebook-tab-${type.id}`,
          'aria-selected': tab.value === type.id, 'aria-controls': `notebook-display-panel-${type.id}`,
          tabindex: tab.value === type.id ? 0 : -1,
          onClick: () => { tab.value = type.id; }, onKeydown: (event: KeyboardEvent) => selectTab(event, index),
        }, type.label))),
      ...DOCUMENT_TYPES.map(type => h('section', {
        key: type.id, id: `notebook-display-panel-${type.id}`, role: 'tabpanel',
        'aria-labelledby': `notebook-tab-${type.id}`, hidden: tab.value !== type.id, tabindex: 0,
      }, tab.value !== type.id ? [] : [
        h('div', { class: 'display-settings-fields' },
          (type.id === 'lined' ? LINED_FIELDS : type.id === 'graph' ? GRAPH_FIELDS : MARKDOWN_FIELDS).map(control)),
        type.id === 'lined' ? h('p', { class: 'display-settings-description' },
          'Text size changes the letters, not the ruling. Negative offsets move text up. Paper size, font, and ruling can change page breaks.') : null,
        preview(type.id),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('update', {
          ...props.options, [type.id]: type.id === 'lined' ? defaultLinedDisplay()
            : type.id === 'graph' ? defaultGraphDisplay() : defaultMarkdownDisplay(),
        }) }, `Reset ${type.label} defaults`),
      ])),
    ]);
  },
});
