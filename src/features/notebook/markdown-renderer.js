const { h } = window.Vue;

function safeHref(value) {
  const href = value.trim();
  if (/^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(href)) return href;
  return '#';
}

function inlineNodes(text) {
  const pattern = /(\[[^\]]+\]\([^\s)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_)/g;
  const nodes = [];
  let last = 0;
  let match;

  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];

    if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
      if (link) {
        const href = safeHref(link[2]);
        nodes.push(h('a', {
          href,
          target: /^(https?:)/i.test(href) ? '_blank' : undefined,
          rel: /^(https?:)/i.test(href) ? 'noopener noreferrer' : undefined,
        }, inlineNodes(link[1])));
      } else nodes.push(token);
    } else if (token.startsWith('`')) {
      nodes.push(h('code', token.slice(1, -1)));
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(h('strong', inlineNodes(token.slice(2, -2))));
    } else if (token.startsWith('~~')) {
      nodes.push(h('del', inlineNodes(token.slice(2, -2))));
    } else {
      nodes.push(h('em', inlineNodes(token.slice(1, -1))));
    }
    last = pattern.lastIndex;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function isBlockStart(line) {
  return /^\s*(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|```|~~~|---\s*$|\*\*\*\s*$|___\s*$)/.test(line);
}

export function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*(```|~~~)\s*([^\s]*)\s*$/);
    if (fence) {
      const marker = fence[1];
      const language = fence[2];
      const content = [];
      index += 1;
      while (index < lines.length && !new RegExp(`^\\s*${marker}\\s*$`).test(lines[index])) {
        content.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(h('pre', [
        h('code', {
          class: language ? `language-${language.replace(/[^a-z0-9_-]/gi, '')}` : undefined,
        }, content.join('\n')),
      ]));
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(h(`h${level}`, inlineNodes(heading[2].replace(/\s+#+\s*$/, ''))));
      index += 1;
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push(h('hr'));
      index += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      const children = [];
      quote.forEach((part, partIndex) => {
        if (partIndex) children.push(h('br'));
        children.push(...inlineNodes(part));
      });
      blocks.push(h('blockquote', children));
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*[-*+]\s+(.+)$/);
        if (!item) break;
        items.push(h('li', inlineNodes(item[1])));
        index += 1;
      }
      blocks.push(h('ul', items));
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*\d+[.)]\s+(.+)$/);
        if (!item) break;
        items.push(h('li', inlineNodes(item[1])));
        index += 1;
      }
      blocks.push(h('ol', items));
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(h('p', inlineNodes(paragraph.join(' '))));
  }

  return blocks.length
    ? blocks
    : [h('p', { class: 'markdown-preview-empty' }, 'Start typing Markdown to see the preview.')];
}
