import { Marked } from '../../core/vendor/marked/marked.js';
import DOMPurify from '../../core/vendor/dompurify/purify.js';

const { h } = window.Vue;
const parser = new Marked({ gfm: true, breaks: false, async: false });
const allowedTags = [
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'dd', 'del', 'details',
  'div', 'dl', 'dt', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img',
  'input', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre', 'q', 's', 'samp', 'small',
  'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'th', 'thead',
  'tfoot', 'tr', 'u', 'ul', 'var', 'wbr',
];
const allowedAttributes = [
  'href', 'src', 'alt', 'title', 'align', 'colspan', 'rowspan', 'start', 'reversed',
  'type', 'checked', 'disabled', 'open',
];
const booleanAttributes = new Set(['checked', 'disabled', 'open', 'reversed']);

function previewNode(node, headings) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const tag = node.localName;
  // HTML inputs are display-only task checkboxes, never interactive form controls.
  if (tag === 'input' && node.getAttribute('type') !== 'checkbox') return null;
  const props = {};
  for (const attribute of node.attributes) {
    // Copy only these DOM attributes: never let HTML supply Vue props or handlers.
    if (allowedAttributes.includes(attribute.name)) {
      props[attribute.name] = booleanAttributes.has(attribute.name) ? true : attribute.value;
    }
  }
  if (tag === 'input') props.disabled = true;
  if (tag === 'a' && props.href && !props.href.startsWith('#')) {
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
    props.id = `notebook-heading-${headings.length + 1}`;
    props.tabindex = -1;
    headings.push({ id: props.id, level: Number(tag[1]), title: node.textContent.trim() });
  }
  const children = Array.from(node.childNodes, (child) => previewNode(child, headings)).filter((child) => child !== null);
  return h(tag, props, children);
}

export function renderMarkdown(markdown, headings = []) {
  if (!markdown.trim()) {
    return [h('p', { class: 'markdown-preview-empty' }, 'Start typing Markdown to see the preview.')];
  }
  const fragment = DOMPurify.sanitize(parser.parse(markdown), {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttributes,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  return Array.from(fragment.childNodes, (node) => previewNode(node, headings)).filter((node) => node !== null);
}
