import { Marked } from 'marked';
import DOMPurify from 'dompurify';

import { h } from 'vue';
import type { VNodeChild } from 'vue';
import { markdownMathExtensions, renderLatexAttribute } from './latex-module.ts';

export interface MarkdownHeading {
  id: string;
  level: number;
  title: string;
}
const parser = new Marked({ gfm: true, breaks: false, async: false });
parser.use({ extensions: markdownMathExtensions });
const allowedTags = [
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'dd', 'del', 'details',
  'div', 'dl', 'dt', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img',
  'input', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre', 'q', 's', 'samp', 'small',
  'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'th', 'thead',
  'tfoot', 'tr', 'u', 'ul', 'var', 'wbr',
];
const allowedAttributes = [
  'href', 'src', 'alt', 'title', 'align', 'colspan', 'rowspan', 'start', 'reversed',
  'type', 'checked', 'disabled', 'open', 'data-dl-latex',
];
const booleanAttributes = new Set(['checked', 'disabled', 'open', 'reversed']);

function previewNode(node: Node, headings: MarkdownHeading[], headingPrefix: string): VNodeChild {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (!(node instanceof Element)) return null;

  const tag = node.localName;
  if ((tag === 'span' || tag === 'div') && node.hasAttribute('data-dl-latex')) {
    const encoded = node.getAttribute('data-dl-latex') ?? '';
    const html = renderLatexAttribute(encoded, tag === 'div');
    if (html !== null) return h(tag, {
      class: tag === 'div' ? 'markdown-latex-block' : 'markdown-latex-inline',
      innerHTML: html,
    });
    return h('code', encoded);
  }
  // HTML inputs are display-only task checkboxes, never interactive form controls.
  if (tag === 'input' && node.getAttribute('type') !== 'checkbox') return null;
  const props: Record<string, string | boolean> = {};
  for (const attribute of node.attributes) {
    // Copy only these DOM attributes: never let HTML supply Vue props or handlers.
    if (allowedAttributes.includes(attribute.name)) {
      props[attribute.name] = booleanAttributes.has(attribute.name) ? true : attribute.value;
    }
  }
  if (tag === 'input') props.disabled = true;
  if (tag === 'a' && typeof props.href === 'string' && !props.href.startsWith('#')) {
    props.target = '_blank';
    props.rel = 'noopener noreferrer';
  }
  if (tag === 'img') {
    props.loading = 'lazy';
    props.referrerpolicy = 'no-referrer';
  }
  if (tag === 'li' && node.querySelector(':scope > input[type="checkbox"]')) {
    props.class = 'markdown-task-item';
  }
  if (/^h[1-6]$/.test(tag)) {
    props.id = `${headingPrefix}-${headings.length + 1}`;
    props.tabindex = '-1';
    headings.push({ id: props.id, level: Number(tag[1]), title: (node.textContent ?? '').trim() });
  }
  const children = Array.from(node.childNodes, (child) => previewNode(child, headings, headingPrefix)).filter((child) => child !== null);
  return h(tag, props, children);
}

export function renderMarkdown(markdown: string, headings: MarkdownHeading[] = [], headingPrefix = 'markdown-heading'): VNodeChild[] {
  if (!markdown.trim()) {
    return [h('p', { class: 'markdown-preview-empty' }, 'Start typing Markdown to see the preview.')];
  }
  const fragment = DOMPurify.sanitize(parser.parse(markdown, { async: false }), {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttributes,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  return Array.from(fragment.childNodes, (node) => previewNode(node, headings, headingPrefix)).filter((node) => node !== null);
}
