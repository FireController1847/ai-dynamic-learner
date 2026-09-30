/** Page offsets refer to the original string; pagination never changes stored text. */
export interface TextPage { start: number; end: number }

export function paginateText(text: string, editor: HTMLTextAreaElement): TextPage[] {
  if (!text) return [{ start: 0, end: 0 }];
  const bounds = editor.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return [{ start: 0, end: text.length }];
  const style = getComputedStyle(editor);
  const lineHeight = Number.parseFloat(style.lineHeight);
  const topPadding = Number.parseFloat(style.paddingTop);
  // Use every complete ruled row, including the last one. Measure text capacity
  // independently of the partial row or blank space at the sheet's bottom.
  const rows = Math.max(1, Math.floor((editor.clientHeight + 0.01) / lineHeight));
  const writingHeight = topPadding + rows * lineHeight;
  const probe = editor.cloneNode(false);
  if (!(probe instanceof HTMLTextAreaElement)) return [{ start: 0, end: text.length }];
  probe.removeAttribute('id');
  probe.removeAttribute('aria-describedby');
  probe.tabIndex = -1;
  probe.setAttribute('aria-hidden', 'true');
  Object.assign(probe.style, {
    position: 'absolute', visibility: 'hidden', pointerEvents: 'none',
    width: `${bounds.width}px`, height: `${writingHeight}px`, paddingBottom: '0px', inset: '0 auto auto 0',
  });
  editor.parentElement?.append(probe);
  const pages: TextPage[] = [];
  try {
    let start = 0;
    while (start < text.length) {
      const fits = (length: number) => {
        probe.value = text.slice(start, start + length);
        return probe.scrollHeight <= probe.clientHeight;
      };
      const remaining = text.length - start;
      let low = 0;
      let high = Math.min(128, remaining);
      while (fits(high)) {
        low = high;
        if (high === remaining) break;
        high = Math.min(high * 2, remaining);
      }
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (fits(middle)) low = middle;
        else high = middle - 1;
      }
      let length = Math.max(1, low);
      if (length < remaining) {
        // Keep the complete fitting prefix on this sheet rather than moving
        // an already-written word or line forward to seek a word boundary.
        const last = text.charCodeAt(start + length - 1);
        if (last >= 0xD800 && last <= 0xDBFF) length = length > 1 ? length - 1 : 2;
      }
      pages.push({ start, end: start + length });
      start += length;
    }
    return pages;
  } finally {
    probe.remove();
  }
}

/** Fill previously blank sheets when writing margin notes on a later sheet. */
export function extendToPage(text: string, page: number, editor: HTMLTextAreaElement): { text: string; start: number } {
  let pages = paginateText(text, editor);
  while (pages.length <= page) {
    // Newlines preserve intentionally empty writing rows without visible filler.
    text += '\n';
    pages = paginateText(text, editor);
  }
  return { text, start: pages[page]!.start };
}
