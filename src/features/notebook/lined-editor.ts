import { defineComponent, h, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import type { NotebookDocument } from './document-types.ts';
import { defaultLinedDisplay, type LinedDisplay } from './display-options.ts';
import { extendToPage, paginateText, type TextPage } from './lined-pagination.ts';

type LinedDocument = Extract<NotebookDocument, { type: 'lined' }>;
type Area = 'text' | 'marginText';
interface Caret { area: Area; start: number; end: number; direction: 'forward' | 'backward' | 'none' }

export const LinedEditor = defineComponent({
  name: 'NotebookLinedEditor',
  props: {
    document: { type: Object as PropType<LinedDocument>, required: true },
    options: { type: Object as PropType<LinedDisplay>, default: defaultLinedDisplay },
  },
  setup(props) {
    const frame = ref<HTMLElement | null>(null);
    const ranges = ref<Record<Area, TextPage[]>>({ text: [{ start: 0, end: props.document.data.text.length }],
      marginText: [{ start: 0, end: (props.document.data.marginText ?? '').length }] });
    let observer: ResizeObserver | null = null;
    let composing = false;
    let pending: Caret | null = null;
    let revision = 0;
    const source = (area: Area) => props.document.data[area] ?? '';
    const editorAt = (area: Area, page: number) => frame.value?.querySelector<HTMLTextAreaElement>(`textarea[data-area="${area}"][data-page="${page}"]`) ?? null;
    const rangeAt = (area: Area, page: number): TextPage => ranges.value[area][page] ?? { start: source(area).length, end: source(area).length };
    function setPageTitle(page: number, event: Event) {
      const title = inputValue(event);
      if (page === 0) { props.document.data.title = title; return; }
      const titles = [...(props.document.data.additionalTitles ?? [])];
      while (titles.length < page) titles.push('');
      titles[page - 1] = title;
      while (titles.length && titles[titles.length - 1] === '') titles.pop();
      props.document.data.additionalTitles = titles;
    }

    async function restoreCaret(caret: Caret, currentRevision: number) {
      await nextTick();
      if (revision !== currentRevision) return;
      const pages = ranges.value[caret.area];
      let index = pages.findIndex(page => caret.start < page.end);
      if (index < 0) index = pages.length - 1;
      const page = pages[index]!;
      const editor = editorAt(caret.area, index);
      if (!editor) return;
      const changedPage = document.activeElement !== editor;
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(caret.start - page.start, Math.min(caret.end, page.end) - page.start, caret.direction);
      editor.scrollTop = 0;
      if (changedPage) editor.scrollIntoView({ block: 'nearest' });
    }
    function reflow() {
      if (composing) return;
      const main = editorAt('text', 0);
      const margin = editorAt('marginText', 0);
      if (!main || !margin || main.clientHeight === 0 || main.clientWidth === 0) return;
      let caret = pending;
      pending = null;
      const active = document.activeElement;
      if (!caret && active instanceof HTMLTextAreaElement && frame.value?.contains(active)) {
        const area = active.dataset.area === 'marginText' ? 'marginText' : 'text';
        const page = rangeAt(area, Number(active.dataset.page));
        caret = { area, start: page.start + active.selectionStart, end: page.start + active.selectionEnd, direction: active.selectionDirection };
      }
      ranges.value = { text: paginateText(source('text'), main), marginText: paginateText(source('marginText'), margin) };
      revision += 1;
      if (caret) void restoreCaret(caret, revision);
    }
    onMounted(() => {
      observer = new ResizeObserver(reflow);
      if (frame.value) observer.observe(frame.value);
      reflow();
    });
    onActivated(() => { void nextTick(reflow); });
    onBeforeUnmount(() => { observer?.disconnect(); revision += 1; });
    watch(() => [props.document.data.text, props.document.data.marginText, props.options], reflow, { deep: true, flush: 'post' });

    function edit(area: Area, page: number, event: Event) {
      const editor = event.target;
      if (!(editor instanceof HTMLTextAreaElement)) return;
      let text = source(area);
      let range = rangeAt(area, page);
      if (page >= ranges.value[area].length) {
        const first = editorAt(area, 0);
        if (!first) return;
        const extended = extendToPage(text, page, first);
        text = extended.text;
        range = { start: extended.start, end: text.length };
      }
      const next = text.slice(0, range.start) + editor.value + text.slice(range.end);
      const delta = editor.value.length - (range.end - range.start);
      // Keep offsets current during IME composition before the next reflow.
      const pages = ranges.value[area];
      if (pages[page]) {
        pages[page] = { start: range.start, end: range.end + delta };
        for (let index = page + 1; index < pages.length; index++) {
          const later = pages[index]!;
          pages[index] = { start: later.start + delta, end: later.end + delta };
        }
      } else pages[page] = { start: range.start, end: range.start + editor.value.length };
      pending = { area, start: range.start + editor.selectionStart, end: range.start + editor.selectionEnd, direction: editor.selectionDirection };
      props.document.data[area] = next;
    }
    function boundaryKey(area: Area, pageIndex: number, event: KeyboardEvent) {
      const editor = event.target;
      if (!(editor instanceof HTMLTextAreaElement) || composing || event.isComposing || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || editor.selectionStart !== editor.selectionEnd) return;
      const page = rangeAt(area, pageIndex);
      const text = source(area);
      const atStart = editor.selectionStart === 0 && pageIndex > 0;
      const atEnd = editor.selectionStart === editor.value.length && page.end < text.length;
      if (atStart && (event.key === 'ArrowLeft' || event.key === 'ArrowUp')) {
        event.preventDefault();
        const previous = editorAt(area, pageIndex - 1);
        previous?.focus();
        previous?.setSelectionRange(previous.value.length, previous.value.length);
      } else if (atEnd && (event.key === 'ArrowRight' || event.key === 'ArrowDown')) {
        event.preventDefault();
        const next = editorAt(area, pageIndex + 1);
        next?.focus(); next?.setSelectionRange(0, 0);
      } else if ((atStart && event.key === 'Backspace') || (atEnd && event.key === 'Delete')) {
        event.preventDefault();
        const position = atStart ? page.start : page.end;
        const count = atStart ? ([...text.slice(Math.max(0, position - 2), position)].at(-1)?.length ?? 1)
          : (text.codePointAt(position)! > 0xFFFF ? 2 : 1);
        const start = atStart ? position - count : position;
        pending = { area, start, end: start, direction: 'none' };
        props.document.data[area] = text.slice(0, start) + text.slice(start + count);
      }
    }
    function writing(area: Area, page: number) {
      const range = rangeAt(area, page);
      return h('textarea', {
        class: ['lined-paper-writing', area === 'marginText' ? 'lined-paper-margin' : 'lined-paper-main'],
        'data-area': area, 'data-page': page, value: source(area).slice(range.start, range.end), spellcheck: true,
        'aria-label': `${area === 'marginText' ? 'Margin notes' : 'Notes'} for ${props.document.name}, page ${page + 1}`,
        placeholder: area === 'text' && page === 0 ? 'Write your notes…' : undefined,
        onInput: (event: Event) => edit(area, page, event),
        onKeydown: (event: KeyboardEvent) => boundaryKey(area, page, event),
        onCompositionstart: () => { composing = true; },
        onCompositionend: () => { composing = false; void nextTick(reflow); },
      });
    }
    return () => h('section', { class: 'lined-editor', 'aria-label': 'Lined Paper editor' }, [
      h('p', { class: 'lined-paper-description' },
        `${props.options.ruling === 'college' ? 'College' : 'Wide'} ruled · ${props.options.size === 'letter' ? 'US Letter' : 'A4'}. Pages are added as you write.`),
      h('div', { ref: frame, class: 'lined-paper-frame' },
        Array.from({ length: Math.max(ranges.value.text.length, ranges.value.marginText.length,
          1 + (props.document.data.additionalTitles?.length ?? 0)) }, (_, page) =>
          h('div', { key: page, class: 'lined-page' }, [
            h('div', { class: 'lined-paper' }, [
              h('div', { class: 'lined-paper-heading' }, [
                h('input', { class: 'lined-paper-title', type: 'text',
                  value: page === 0 ? props.document.data.title ?? '' : props.document.data.additionalTitles?.[page - 1] ?? '',
                  spellcheck: true, 'aria-label': `Paper title, page ${page + 1}`,
                  onInput: (event: Event) => setPageTitle(page, event) }),
              ]),
              h('div', { class: 'lined-paper-body' }, [writing('marginText', page), writing('text', page)]),
              h('div', { class: 'lined-paper-holes', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]),
            ]),
            h('p', { class: 'lined-page-number' }, `Page ${page + 1}`),
          ]))),
    ]);
  },
});
