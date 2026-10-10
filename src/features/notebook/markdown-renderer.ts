import { renderMarkdown as renderSharedMarkdown, type MarkdownHeading } from '../../components/markdown-renderer.ts';
import type { VNodeChild } from 'vue';
export type { MarkdownHeading } from '../../components/markdown-renderer.ts';

export function renderMarkdown(markdown: string, headings: MarkdownHeading[] = []): VNodeChild[] {
  return renderSharedMarkdown(markdown, headings, 'notebook-heading');
}
