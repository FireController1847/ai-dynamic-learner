import { Icon } from '../../components/icon.js';
import { renderMarkdown } from './markdown-renderer.js';

const { computed, h, ref } = window.Vue;

const MIN_PANEL_PERCENT = 24;
const MAX_PANEL_PERCENT = 76;

export const MarkdownEditor = {
  name: 'NotebookMarkdownEditor',
  props: {
    document: { type: Object, required: true },
  },
  setup(props) {
    const mode = ref('split');
    const swapped = ref(false);
    const sourcePercent = ref(50);
    const resizing = ref(false);
    const workspace = ref(null);

    const markdown = computed({
      get: () => props.document.data.markdown,
      set: (value) => { props.document.data.markdown = value; },
    });

    function setPercent(value) {
      sourcePercent.value = Math.round(Math.min(MAX_PANEL_PERCENT, Math.max(MIN_PANEL_PERCENT, value)));
    }

    function beginResize(event) {
      if (event.button !== 0 || mode.value !== 'split') return;
      event.preventDefault();
      resizing.value = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      resizeFromPointer(event);
    }

    function resizeFromPointer(event) {
      if (!resizing.value || !workspace.value) return;
      const bounds = workspace.value.getBoundingClientRect();
      const fromLeft = (event.clientX - bounds.left) / bounds.width * 100;
      setPercent(swapped.value ? 100 - fromLeft : fromLeft);
    }

    function endResize(event) {
      resizing.value = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }

    function resizeFromKeyboard(event) {
      if (mode.value !== 'split') return;
      const step = event.shiftKey ? 10 : 4;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPercent(sourcePercent.value + (swapped.value ? step : -step));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPercent(sourcePercent.value + (swapped.value ? -step : step));
      } else if (event.key === 'Home') {
        event.preventDefault();
        setPercent(MIN_PANEL_PERCENT);
      } else if (event.key === 'End') {
        event.preventDefault();
        setPercent(MAX_PANEL_PERCENT);
      }
    }

    function sourcePanel() {
      return h('section', {
        class: 'markdown-panel markdown-source-panel',
        'aria-label': 'Raw Markdown editor',
      }, [
        h('header', { class: 'markdown-panel-heading' }, [
          h('strong', 'Markdown'),
          h('span', 'Raw source'),
        ]),
        h('textarea', {
          class: 'markdown-source',
          value: markdown.value,
          spellcheck: true,
          'aria-label': 'Markdown source',
          placeholder: '# Start writing\n\nYour Markdown saves automatically.',
          onInput: (event) => { markdown.value = event.target.value; },
        }),
      ]);
    }

    function previewPanel() {
      return h('section', {
        class: 'markdown-panel markdown-preview-panel',
        'aria-label': 'Markdown preview',
      }, [
        h('header', { class: 'markdown-panel-heading' }, [
          h('strong', 'Preview'),
          h('span', 'Rendered Markdown'),
        ]),
        h('article', { class: 'markdown-preview' }, renderMarkdown(markdown.value)),
      ]);
    }

    return () => {
      const source = sourcePanel();
      const preview = previewPanel();
      const first = swapped.value ? preview : source;
      const second = swapped.value ? source : preview;
      const sourceBasis = `${sourcePercent.value}%`;
      const firstBasis = swapped.value ? `${100 - sourcePercent.value}%` : sourceBasis;
      const secondBasis = swapped.value ? sourceBasis : `${100 - sourcePercent.value}%`;

      return h('div', { class: 'markdown-editor' }, [
        h('div', { class: 'markdown-toolbar', 'aria-label': 'Markdown editor layout' }, [
          h('div', { class: 'markdown-view-switcher', role: 'group', 'aria-label': 'View mode' }, [
            ...[
              ['split', 'Split'],
              ['source', 'Source'],
              ['preview', 'Preview'],
            ].map(([value, label]) => h('button', {
              type: 'button',
              class: ['quiet-button', { 'is-active': mode.value === value }],
              'aria-pressed': mode.value === value,
              onClick: () => { mode.value = value; },
            }, label)),
          ]),
          h('button', {
            type: 'button',
            class: 'quiet-button',
            disabled: mode.value !== 'split',
            title: 'Swap source and preview sides',
            onClick: () => { swapped.value = !swapped.value; },
          }, [h(Icon, { name: 'flip' }), 'Swap sides']),
        ]),
        h('div', {
          ref: workspace,
          class: ['markdown-workspace', `mode-${mode.value}`, {
            'is-swapped': swapped.value,
            'is-resizing': resizing.value,
          }],
        }, mode.value === 'split' ? [
          h('div', { class: 'markdown-pane-slot', style: { flexBasis: firstBasis } }, [first]),
          h('div', {
            class: 'markdown-splitter',
            role: 'separator',
            tabindex: 0,
            'aria-label': 'Resize Markdown panels',
            'aria-orientation': 'vertical',
            'aria-valuemin': MIN_PANEL_PERCENT,
            'aria-valuemax': MAX_PANEL_PERCENT,
            'aria-valuenow': sourcePercent.value,
            onPointerdown: beginResize,
            onPointermove: resizeFromPointer,
            onPointerup: endResize,
            onPointercancel: endResize,
            onKeydown: resizeFromKeyboard,
            onDblclick: () => { sourcePercent.value = 50; },
          }),
          h('div', { class: 'markdown-pane-slot', style: { flexBasis: secondBasis } }, [second]),
        ] : mode.value === 'source' ? [source] : [preview]),
      ]);
    };
  },
};
