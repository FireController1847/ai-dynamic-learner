import { Icon } from '../../components/icon.js';
import { renderMarkdown } from './markdown-renderer.js';
import { MarkdownOutline } from './markdown-outline.js';
import { MarkdownCheatsheet } from './markdown-cheatsheet.js';
import { markdownFilename } from './document-files.js';
import { downloadText } from '../../core/file-download.js';

import { computed, h, ref } from 'vue';

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
    const previewArticle = ref(null);
    const showContents = ref(false);
    const showCheatsheet = ref(false);
    const downloading = ref(false);
    const downloadMessage = ref('');

    const markdown = computed({
      get: () => props.document.data.markdown,
      set: (value) => { props.document.data.markdown = value; },
    });
    const rendered = computed(() => {
      const headings = [];
      const blocks = renderMarkdown(markdown.value, headings);
      return { headings, blocks };
    });

    async function download() {
      if (downloading.value) return;
      downloading.value = true;
      downloadMessage.value = 'Preparing Markdown download…';
      try {
        await downloadText(markdownFilename(props.document.name), markdown.value, 'text/markdown;charset=utf-8');
        downloadMessage.value = 'Markdown download handed to your browser.';
      } catch {
        downloadMessage.value = 'The download could not be prepared. Please try again.';
      } finally { downloading.value = false; }
    }

    function navigateToHeading(id) {
      const article = previewArticle.value;
      const heading = article?.querySelector(`#${id}`);
      if (!heading) return;
      article.scrollTo({ top: article.scrollTop + heading.getBoundingClientRect().top - article.getBoundingClientRect().top - 16 });
      heading.focus({ preventScroll: true });
    }

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
          h('button', {
            type: 'button', class: 'quiet-button', 'aria-haspopup': 'dialog',
            'aria-controls': 'notebook-markdown-cheatsheet',
            'aria-expanded': showCheatsheet.value,
            onClick: () => { showCheatsheet.value = true; },
          }, 'Cheatsheet'),
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
          h('button', {
            type: 'button', class: 'quiet-button', 'aria-expanded': showContents.value,
            'aria-controls': 'notebook-markdown-toc',
            onClick: () => { showContents.value = !showContents.value; },
          }, 'Contents'),
        ]),
        h('div', { class: ['markdown-preview-body', { 'has-contents': showContents.value }] }, [
          h('article', { ref: previewArticle, class: 'markdown-preview' }, rendered.value.blocks),
          showContents.value ? h(MarkdownOutline, { headings: rendered.value.headings, onNavigate: navigateToHeading }) : null,
        ]),
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
        showCheatsheet.value ? h(MarkdownCheatsheet, {
          onClose: () => { showCheatsheet.value = false; },
        }) : null,
        h('div', { class: 'markdown-toolbar', 'aria-label': 'Markdown editor layout' }, [
          h('div', { class: 'markdown-view-switcher', role: 'group', 'aria-label': 'View mode' }, [
            h('button', {
              type: 'button', class: 'quiet-button notebook-coming-control notebook-coming-below',
              'aria-disabled': true, 'aria-describedby': 'notebook-coming-rich',
            }, ['Rich', h('span', {
              id: 'notebook-coming-rich', class: 'notebook-coming-tooltip', role: 'tooltip',
            }, 'Coming soon!')]),
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
            h('button', {
              type: 'button', class: ['icon-button', { 'markdown-is-loading': downloading.value }],
              disabled: downloading.value, 'aria-busy': downloading.value,
              title: downloading.value ? 'Preparing download…' : 'Download Markdown',
              'aria-label': downloading.value ? 'Preparing download' : 'Download Markdown', onClick: download,
            }, [h(Icon, { name: downloading.value ? 'loading' : 'download' })]),
          ]),
          h('button', {
            type: 'button',
            class: 'quiet-button',
            disabled: mode.value !== 'split',
            title: 'Swap source and preview sides',
            onClick: () => { swapped.value = !swapped.value; },
          }, [h(Icon, { name: 'flip' }), 'Swap sides']),
        ]),
        downloadMessage.value ? h('p', { class: 'markdown-file-status', role: 'status' }, downloadMessage.value) : null,
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
