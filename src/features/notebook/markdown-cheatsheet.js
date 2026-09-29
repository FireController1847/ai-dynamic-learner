const { h, onBeforeUnmount, onDeactivated, onMounted, ref } = window.Vue;

const examples = [
  ['Headings', '# Title\n## Section\n### Subsection', 'Use one to six # signs, followed by a space.'],
  ['Emphasis', '**bold** · *italic* · ~~strikethrough~~', 'Wrap the words you want to format.'],
  ['Lists', '- First item\n  - Nested item\n\n1. First step\n2. Next step', 'Indent items to nest them. Numbers create an ordered list.'],
  ['Tasks', '- [ ] To do\n- [x] Done', 'Change the brackets in Source to check or uncheck a task.'],
  ['Links & images', '[Link text](https://example.com)\n![Image description](https://example.com/image.png)', 'Plain web addresses also become links.'],
  ['Quotes', '> A quoted paragraph', 'Start each quoted line with >.'],
  ['Code', '`inline code`\n\n```\nA block of code\n```', 'Code keeps its spacing and displays Markdown literally.'],
  ['Tables', '| Name | Value |\n| --- | ---: |\n| Example | 42 |', 'Use :---, :---:, or ---: to align a column left, center, or right.'],
  ['HTML formatting', '<u>underline</u> · H<sub>2</sub>O · x<sup>2</sup>', 'Basic HTML formatting is supported; scripts and custom styles are removed.'],
  ['Dividers & line breaks', '---\n\nFirst line<br>\nSecond line', 'Use a blank line for a new paragraph, or <br> for a line break.'],
];

export const MarkdownCheatsheet = {
  name: 'NotebookMarkdownCheatsheet',
  emits: ['close'],
  setup(props, { emit }) {
    const dialog = ref(null);
    const close = () => { if (dialog.value?.open) dialog.value.close(); };
    onMounted(() => dialog.value.showModal());
    onBeforeUnmount(close);
    onDeactivated(() => { close(); emit('close'); });

    return () => h('dialog', {
      ref: dialog,
      id: 'notebook-markdown-cheatsheet',
      class: 'markdown-cheatsheet',
      'aria-labelledby': 'markdown-cheatsheet-title',
      onCancel: (event) => { event.preventDefault(); emit('close'); },
    }, [
      h('header', { class: 'markdown-cheatsheet-header' }, [
        h('h2', { id: 'markdown-cheatsheet-title' }, 'Markdown cheatsheet'),
        h('button', {
          type: 'button', class: 'quiet-button', autofocus: true,
          onClick: () => emit('close'),
        }, 'Close'),
      ]),
      h('div', { class: 'markdown-cheatsheet-body' }, [
        h('p', { class: 'markdown-cheatsheet-intro' }, 'Type these examples in Source and watch them take shape in Preview.'),
        ...examples.map(([title, source, hint]) => h('section', { class: 'markdown-cheatsheet-example' }, [
          h('h3', title),
          h('pre', [h('code', source)]),
          h('p', hint),
        ])),
      ]),
    ]);
  },
};
