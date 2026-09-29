import { defineComponent, h } from 'vue';
import type { PropType, VNode } from 'vue';
import type { MarkdownHeading } from './markdown-renderer.ts';

export interface OutlineEntry extends MarkdownHeading { children: OutlineEntry[] }

export function nestHeadings(headings: readonly MarkdownHeading[]): OutlineEntry[] {
  const root: Pick<OutlineEntry, 'level' | 'children'> = { level: 0, children: [] };
  const stack = [root];
  for (const heading of headings) {
    while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) stack.pop();
    const entry: OutlineEntry = { ...heading, children: [] };
    stack[stack.length - 1].children.push(entry);
    stack.push(entry);
  }
  return root.children;
}

export const MarkdownOutline = defineComponent({
  name: 'MarkdownOutline',
  props: { headings: { type: Array as PropType<readonly MarkdownHeading[]>, required: true } },
  emits: { navigate: (id: string) => typeof id === 'string' },
  setup(props, { emit }) {
    function list(headings: readonly OutlineEntry[]): VNode {
      return h('ol', headings.map((heading) => h('li', { key: heading.id }, [
        h('a', {
          href: `#${heading.id}`,
          onClick: (event: MouseEvent) => { event.preventDefault(); emit('navigate', heading.id); },
        }, heading.title || 'Untitled heading'),
        heading.children.length ? list(heading.children) : null,
      ])));
    }
    return () => h('nav', { id: 'notebook-markdown-toc', class: 'markdown-toc', 'aria-label': 'Table of contents' }, [
      h('strong', 'Contents'),
      props.headings.length ? list(nestHeadings(props.headings)) : h('p', 'Add Markdown headings to build your contents.'),
    ]);
  },
});
