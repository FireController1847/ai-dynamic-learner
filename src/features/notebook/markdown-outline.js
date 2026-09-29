const { h } = window.Vue;

export const MarkdownOutline = {
  name: 'MarkdownOutline',
  props: { headings: { type: Array, required: true } },
  emits: ['navigate'],
  setup(props, { emit }) {
    function nestedHeadings() {
      const root = { level: 0, children: [] };
      const stack = [root];
      for (const heading of props.headings) {
        while (stack.at(-1).level >= heading.level) stack.pop();
        const entry = { ...heading, children: [] };
        stack.at(-1).children.push(entry);
        stack.push(entry);
      }
      return root.children;
    }
    function list(headings) {
      return h('ol', headings.map((heading) => h('li', { key: heading.id }, [
        h('a', {
          href: `#${heading.id}`,
          onClick: (event) => { event.preventDefault(); emit('navigate', heading.id); },
        }, heading.title || 'Untitled heading'),
        heading.children.length ? list(heading.children) : null,
      ])));
    }
    return () => h('nav', { id: 'notebook-markdown-toc', class: 'markdown-toc', 'aria-label': 'Table of contents' }, [
      h('strong', 'Contents'),
      props.headings.length ? list(nestedHeadings()) : h('p', 'Add Markdown headings to build your contents.'),
    ]);
  },
};
