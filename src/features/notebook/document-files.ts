import { MAX_NAME_LENGTH } from './library-model.js';

export const MAX_MARKDOWN_FILE_BYTES = 8 * 1024 * 1024;

export function markdownFilename(name: string): string {
  const base = name.replace(/\.md$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '').trim() || 'document';
  return `${/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base) ? '_' : ''}${base}.md`;
}

export async function readMarkdownFile(file: File): Promise<{ name: string; markdown: string }> {
  if (!/\.md$/i.test(file.name)) throw new Error('Choose a Markdown (.md) file.');
  if (file.size > MAX_MARKDOWN_FILE_BYTES) throw new Error('Markdown files must be 8 MB or smaller.');
  let markdown;
  try { markdown = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
  catch { throw new Error('This file could not be read as UTF-8 Markdown.'); }
  if (markdown.includes('\0')) throw new Error('This appears to be a binary file. Choose a text Markdown file.');
  return { name: file.name.replace(/\.md$/i, '').trim().slice(0, MAX_NAME_LENGTH) || 'Imported document', markdown };
}
