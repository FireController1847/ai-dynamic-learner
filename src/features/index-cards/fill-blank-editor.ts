import type { Card } from './card-model.ts';
import { inputValue } from '../../core/dom.ts';
import { MAX_CARD_TEXT_LENGTH, MAX_CARD_TITLE_LENGTH } from './card-model.ts';
import { parseFillBlankTemplate } from './fill-blank-model.ts';

import { defineComponent, type PropType, h, onMounted, ref } from 'vue';

export interface FillBlankEditorHandle {
  focus(): void;
  makeBlank(): void;
  removeBlank(): void;
}

function blankAncestor(node: Node | null, editor: HTMLElement): HTMLElement | null {
  const element = node instanceof HTMLElement ? node : node?.parentElement ?? null;
  const blank = element?.closest<HTMLElement>('.fill-blank-author-blank') ?? null;
  return blank && editor.contains(blank) ? blank : null;
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof HTMLElement)) return '';

  if (node.classList.contains('fill-blank-author-blank')) {
    const answer = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    return answer ? `{{${answer}}}` : '';
  }
  if (node.tagName === 'BR') return '\n';

  let value = Array.from(node.childNodes).map(serializeNode).join('');
  if ((node.tagName === 'DIV' || node.tagName === 'P') && node.nextSibling && !value.endsWith('\n')) {
    value += '\n';
  }
  return value;
}

export const FillBlankEditor = defineComponent({
  name: 'FillBlankEditor',
  props: {
    card: { type: Object as PropType<Card>, required: true },
    position: { type: Number, required: true },
  },
  emits: { 'message': (_message: string) => true },
  setup(props, { emit, expose }) {
    const editor = ref<HTMLElement | null>(null);

    function renderSource(source = props.card.front) {
      const target = editor.value;
      if (!target) return;
      target.replaceChildren();
      const template = parseFillBlankTemplate(source);
      for (const segment of template.segments) {
        if (segment.type === 'text') {
          target.append(document.createTextNode(segment.text));
        } else {
          const blank = document.createElement('span');
          blank.className = 'fill-blank-author-blank';
          blank.dataset.blank = String(segment.index + 1);
          blank.textContent = segment.answer;
          target.append(blank);
        }
      }
    }

    function syncFromEditor() {
      const target = editor.value;
      if (!target) return false;
      const source = Array.from(target.childNodes).map(serializeNode).join('');
      if (source.length > MAX_CARD_TEXT_LENGTH) {
        renderSource(props.card.front);
        emit('message', `Card text can be at most ${MAX_CARD_TEXT_LENGTH} characters.`);
        return false;
      }
      props.card.front = source;
      emit('message', '');
      return true;
    }

    function selectionInEditor() {
      const target = editor.value;
      const selection = window.getSelection();
      if (!target || !selection || !selection.rangeCount) return null;
      const range = selection.getRangeAt(0);
      if (!target.contains(range.startContainer) || !target.contains(range.endContainer)) return null;
      return { target, selection, range };
    }

    function makeBlank() {
      const context = selectionInEditor();
      if (!context || context.range.collapsed) {
        emit('message', 'Select the word or phrase you want to turn into a blank.');
        editor.value?.focus();
        return;
      }

      const { target, selection, range } = context;
      const answer = range.toString();
      if (!answer.trim()) {
        emit('message', 'Select some text before creating a blank.');
        return;
      }
      if (answer.includes('\n')) {
        emit('message', 'A blank needs to stay on one line.');
        return;
      }
      if (/[{}]/.test(answer)) {
        emit('message', 'A blank cannot contain brace characters.');
        return;
      }

      const existing = Array.from(target.querySelectorAll<HTMLElement>('.fill-blank-author-blank'));
      if (blankAncestor(range.startContainer, target) || blankAncestor(range.endContainer, target) ||
          existing.some((blank) => selection.containsNode(blank, true))) {
        emit('message', 'That selection already touches a blank. Remove the existing blank first.');
        return;
      }

      const blank = document.createElement('span');
      blank.className = 'fill-blank-author-blank';
      blank.append(range.extractContents());
      range.insertNode(blank);
      target.normalize();

      if (!syncFromEditor()) return;
      const nextRange = document.createRange();
      nextRange.selectNodeContents(blank);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      target.focus();
      emit('message', 'Blank created.');
    }

    function removeBlank() {
      const context = selectionInEditor();
      if (!context) {
        emit('message', 'Place the cursor inside a blank to remove it.');
        editor.value?.focus();
        return;
      }

      const { target, selection, range } = context;
      let blank = blankAncestor(range.startContainer, target) ?? blankAncestor(range.endContainer, target);
      if (!blank) {
        blank = Array.from(target.querySelectorAll<HTMLElement>('.fill-blank-author-blank'))
          .find((candidate) => selection.containsNode(candidate, true)) ?? null;
      }
      if (!blank) {
        emit('message', 'Place the cursor inside a blank to remove it.');
        return;
      }

      const text = document.createTextNode(blank.textContent ?? '');
      blank.replaceWith(text);
      target.normalize();
      if (!syncFromEditor()) return;

      const nextRange = document.createRange();
      nextRange.setStart(text, text.length);
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      target.focus();
      emit('message', 'Blank removed.');
    }

    function insertPlainText(text: string) {
      const context = selectionInEditor();
      if (!context) return;
      const { selection, range } = context;
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      syncFromEditor();
    }

    expose({
      focus: () => editor.value?.focus(),
      makeBlank,
      removeBlank,
    } satisfies FillBlankEditorHandle);

    onMounted(() => renderSource());

    return () => h('div', { class: 'card-face fill-blank-face fill-blank-editor-card' }, [
      h('div', { class: 'card-face-heading' }, [
        h('input', {
          class: 'card-title-input',
          type: 'text',
          value: props.card.title ?? '',
          maxlength: MAX_CARD_TITLE_LENGTH,
          placeholder: 'Untitled card',
          'aria-label': 'Card title',
          onInput: (event: Event) => { props.card.title = inputValue(event); },
        }),
        h('span', { class: 'card-face-number', 'aria-hidden': 'true' }, String(props.position).padStart(2, '0')),
      ]),
      h('div', {
        ref: editor,
        class: 'fill-blank-visual-editor',
        contenteditable: 'true',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': `Fill in the Blanks card ${props.position}`,
        'data-placeholder': 'Write a sentence, then select words and make them blanks…',
        spellcheck: true,
        onInput: syncFromEditor,
        onPaste: (event: ClipboardEvent) => {
          event.preventDefault();
          insertPlainText(event.clipboardData?.getData('text/plain') ?? '');
        },
      }),
    ]);
  },
});
