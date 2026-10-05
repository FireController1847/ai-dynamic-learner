import type { Card } from './card-model.ts';
import { inputValue } from '../../core/dom.ts';
import { MAX_CARD_TEXT_LENGTH, MAX_CARD_TITLE_LENGTH } from './card-model.ts';
import { parseFillBlankTemplate } from './fill-blank-model.ts';

import { defineComponent, type PropType, h, onMounted, ref } from 'vue';

const CARET_ANCHOR = '\u200B';

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

function blankAnswer(blank: HTMLElement): string {
  return blank.dataset.answer ?? '';
}

function stripCaretAnchors(value: string): string {
  return value.replaceAll(CARET_ANCHOR, '');
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return stripCaretAnchors(node.textContent ?? '');
  if (!(node instanceof HTMLElement)) return '';

  if (node.classList.contains('fill-blank-author-blank')) {
    const answer = blankAnswer(node).replace(/\s+/g, ' ').trim();
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
    side: { type: String as PropType<'front' | 'back'>, default: 'front' },
  },
  emits: { 'message': (_message: string) => true },
  setup(props, { emit, expose }) {
    const editor = ref<HTMLElement | null>(null);
    let activeBlank: HTMLElement | null = null;

    function selectBlank(blank: HTMLElement | null) {
      if (activeBlank && activeBlank !== blank) activeBlank.classList.remove('is-selected');
      activeBlank = blank;
      activeBlank?.classList.add('is-selected');
    }

    function createBlankElement(index: number, answer: string) {
      const blank = document.createElement('span');
      blank.className = 'fill-blank-author-blank';
      blank.dataset.blank = String(index + 1);
      blank.dataset.answer = answer;
      blank.contentEditable = 'false';

      const number = document.createElement('sub');
      number.className = 'fill-blank-number';
      number.textContent = String(index + 1);

      const line = document.createElement('span');
      line.className = 'fill-blank-author-line';
      const width = Math.max(4, Math.min(18, answer.length + 1));
      line.style.setProperty('--blank-width', `${width}ch`);

      blank.append(number, line);
      return blank;
    }

    function renumberBlanks() {
      editor.value?.querySelectorAll<HTMLElement>('.fill-blank-author-blank').forEach((blank, index) => {
        blank.dataset.blank = String(index + 1);
        const number = blank.querySelector<HTMLElement>('.fill-blank-number');
        if (number) number.textContent = String(index + 1);
      });
    }

    function trailingCaretNode(target: HTMLElement) {
      const last = target.lastChild;
      if (!(last instanceof HTMLElement) || !last.classList.contains('fill-blank-author-blank')) return null;
      const anchor = document.createTextNode(CARET_ANCHOR);
      target.append(anchor);
      return anchor;
    }

    function renderSource(source = props.card.front) {
      const target = editor.value;
      if (!target) return;
      activeBlank = null;
      target.replaceChildren();
      const template = parseFillBlankTemplate(source);
      for (const segment of template.segments) {
        if (segment.type === 'text') target.append(document.createTextNode(segment.text));
        else target.append(createBlankElement(segment.index, segment.answer));
      }
      trailingCaretNode(target);
    }

    function syncFromEditor() {
      const target = editor.value;
      if (!target) return false;
      renumberBlanks();
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
      const answer = stripCaretAnchors(range.toString());
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

      range.deleteContents();
      const blank = createBlankElement(existing.length, answer.trim());
      range.insertNode(blank);
      target.normalize();
      selectBlank(blank);

      if (!syncFromEditor()) return;
      const nextRange = document.createRange();
      const nextNode = blank.nextSibling;
      if (nextNode?.nodeType === Node.TEXT_NODE) {
        const text = nextNode as Text;
        if (!text.data.length) text.data = CARET_ANCHOR;
        nextRange.setStart(text, text.data.startsWith(CARET_ANCHOR) ? 1 : 0);
      } else if (!nextNode) {
        const anchor = document.createTextNode(CARET_ANCHOR);
        blank.after(anchor);
        nextRange.setStart(anchor, 1);
      } else {
        nextRange.setStartAfter(blank);
      }
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      target.focus();
      emit('message', 'Blank created.');
    }

    function removeBlank() {
      const context = selectionInEditor();
      const target = editor.value;
      if (!target) return;

      let blank = context
        ? blankAncestor(context.range.startContainer, target) ?? blankAncestor(context.range.endContainer, target)
        : null;
      if (!blank && context) {
        blank = Array.from(target.querySelectorAll<HTMLElement>('.fill-blank-author-blank'))
          .find((candidate) => context.selection.containsNode(candidate, true)) ?? null;
      }
      blank ??= activeBlank && target.contains(activeBlank) ? activeBlank : null;

      if (!blank) {
        emit('message', 'Select a blank on the card before removing it.');
        editor.value?.focus();
        return;
      }

      const answer = blankAnswer(blank);
      const text = document.createTextNode(answer);
      blank.replaceWith(text);
      selectBlank(null);
      target.normalize();
      if (!syncFromEditor()) return;

      const selection = window.getSelection();
      if (selection) {
        const nextRange = document.createRange();
        nextRange.setStart(text, text.length);
        nextRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(nextRange);
      }
      target.focus();
      emit('message', 'Blank removed.');
    }

    function insertPlainText(text: string) {
      const context = selectionInEditor();
      if (!context) return;
      const { selection, range } = context;
      range.deleteContents();
      const node = document.createTextNode(stripCaretAnchors(text));
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

    return () => {
      const template = parseFillBlankTemplate(props.card.front);
      return h('div', {
        class: ['card-flipper', 'fill-blank-edit-flipper', { 'is-back': props.side === 'back' }],
      }, [
        h('div', {
          class: 'card-face card-face--front fill-blank-face fill-blank-editor-card',
          inert: props.side === 'back',
          'aria-hidden': props.side === 'back',
        }, [
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
            h('span', { class: 'card-face-side' }, 'Prompt'),
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
            onClick: (event: MouseEvent) => {
              const target = event.target instanceof Element
                ? event.target.closest<HTMLElement>('.fill-blank-author-blank')
                : null;
              selectBlank(target && editor.value?.contains(target) ? target : null);
            },
            onKeydown: () => selectBlank(null),
            onPaste: (event: ClipboardEvent) => {
              event.preventDefault();
              insertPlainText(event.clipboardData?.getData('text/plain') ?? '');
            },
          }),
        ]),
        h('div', {
          class: 'card-face card-face--back fill-blank-face fill-blank-answer-key-card',
          inert: props.side !== 'back',
          'aria-hidden': props.side !== 'back',
        }, [
          h('div', { class: 'card-face-heading fill-blank-back-heading' }, [
            h('span', { class: 'card-face-number', 'aria-hidden': 'true' }, String(props.position).padStart(2, '0')),
          ]),
          template.answers.length
            ? h('ol', { class: 'fill-blank-answer-key' }, template.answers.map((answer, index) =>
              h('li', { key: `${index}-${answer}` }, [
                h('span', { class: 'fill-blank-answer-key-number', 'aria-hidden': 'true' }, `${index + 1}.`),
                h('span', answer),
              ])))
            : h('p', { class: 'fill-blank-answer-key-empty' }, 'No blanks on this card yet.'),
        ]),
      ]);
    };
  },
});
