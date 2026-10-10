import { parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { Icon } from '../../components/icon.ts';
import { MAX_TEXT, type Question } from './question-model.ts';
import { defineComponent, h, onMounted, ref, type PropType } from 'vue';

const CARET_ANCHOR = '\u200B';

function blankAncestor(node: Node | null, editor: HTMLElement): HTMLElement | null {
  const element = node instanceof HTMLElement ? node : node?.parentElement ?? null;
  const blank = element?.closest<HTMLElement>('.knowledge-fill-blank-author-blank') ?? null;
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
  if (node.classList.contains('knowledge-fill-blank-author-blank')) {
    const answer = blankAnswer(node).replace(/\s+/g, ' ').trim();
    return answer ? `{{${answer}}}` : '';
  }
  if (node.tagName === 'BR') return '\n';

  let value = Array.from(node.childNodes).map(serializeNode).join('');
  if ((node.tagName === 'DIV' || node.tagName === 'P') && node.nextSibling && !value.endsWith('\n')) value += '\n';
  return value;
}

export const ReviewFillBlankEditor = defineComponent({
  name: 'ReviewFillBlankEditor',
  props: { question: { type: Object as PropType<Question>, required: true } },
  emits: { message: (_message: string) => true },
  setup(props, { emit }) {
    const editor = ref<HTMLElement | null>(null);
    let activeBlank: HTMLElement | null = null;

    function selectBlank(blank: HTMLElement | null) {
      if (activeBlank && activeBlank !== blank) activeBlank.classList.remove('is-selected');
      activeBlank = blank;
      activeBlank?.classList.add('is-selected');
    }

    function createBlankElement(index: number, answer: string) {
      const blank = document.createElement('span');
      blank.className = 'knowledge-fill-blank-author-blank';
      blank.dataset.answer = answer;
      blank.contentEditable = 'false';

      const number = document.createElement('sub');
      number.className = 'knowledge-fill-blank-number';
      number.textContent = String(index + 1);

      const line = document.createElement('span');
      line.className = 'knowledge-fill-blank-author-line';
      line.textContent = answer;
      line.setAttribute('aria-hidden', 'true');
      line.style.setProperty('--blank-width', `${Math.max(4, Math.min(18, answer.length + 1))}ch`);

      blank.append(number, line);
      return blank;
    }

    function renumberBlanks() {
      editor.value?.querySelectorAll<HTMLElement>('.knowledge-fill-blank-author-blank').forEach((blank, index) => {
        const number = blank.querySelector<HTMLElement>('.knowledge-fill-blank-number');
        if (number) number.textContent = String(index + 1);
      });
    }

    function trailingCaretNode(target: HTMLElement) {
      const last = target.lastChild;
      if (!(last instanceof HTMLElement) || !last.classList.contains('knowledge-fill-blank-author-blank')) return;
      target.append(document.createTextNode(CARET_ANCHOR));
    }

    function renderSource() {
      const target = editor.value;
      if (!target) return;
      activeBlank = null;
      target.replaceChildren();
      const template = parseFillBlankTemplate(props.question.prompt);
      for (const segment of template.segments) {
        target.append(segment.type === 'text'
          ? document.createTextNode(segment.text)
          : createBlankElement(segment.index, segment.answer));
      }
      trailingCaretNode(target);
    }

    function syncFromEditor() {
      const target = editor.value;
      if (!target) return false;
      renumberBlanks();
      const source = Array.from(target.childNodes).map(serializeNode).join('');
      if (source.length > MAX_TEXT) {
        renderSource();
        emit('message', `Question text can be at most ${MAX_TEXT} characters.`);
        return false;
      }
      props.question.prompt = source;
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

      const existing = Array.from(target.querySelectorAll<HTMLElement>('.knowledge-fill-blank-author-blank'));
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
      const target = editor.value;
      if (!target) return;
      const context = selectionInEditor();
      let blank = context
        ? blankAncestor(context.range.startContainer, target) ?? blankAncestor(context.range.endContainer, target)
        : null;
      if (!blank && context) {
        blank = Array.from(target.querySelectorAll<HTMLElement>('.knowledge-fill-blank-author-blank'))
          .find((candidate) => context.selection.containsNode(candidate, true)) ?? null;
      }
      blank ??= activeBlank && target.contains(activeBlank) ? activeBlank : null;
      if (!blank) {
        emit('message', 'Select a blank before removing it.');
        target.focus();
        return;
      }

      const text = document.createTextNode(blankAnswer(blank));
      blank.replaceWith(text);
      selectBlank(null);
      target.normalize();
      if (!syncFromEditor()) return;

      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.setStart(text, text.length);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
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

    function preserveSelection(event: MouseEvent) {
      event.preventDefault();
    }

    onMounted(renderSource);

    return () => {
      const template = parseFillBlankTemplate(props.question.prompt);
      return h('div', { class: 'knowledge-fill-blank-editor' }, [
        h('p', { class: 'knowledge-muted' }, 'Write the question, select a word or phrase, then make it a blank.'),
        h('div', {
          ref: editor,
          class: 'knowledge-fill-blank-author',
          contenteditable: 'true',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': 'Fill in the Blanks question',
          'data-placeholder': 'Write a sentence or question…',
          spellcheck: true,
          onInput: syncFromEditor,
          onClick: (event: MouseEvent) => {
            const target = event.target instanceof Element
              ? event.target.closest<HTMLElement>('.knowledge-fill-blank-author-blank')
              : null;
            selectBlank(target && editor.value?.contains(target) ? target : null);
          },
          onKeydown: () => selectBlank(null),
          onPaste: (event: ClipboardEvent) => {
            event.preventDefault();
            insertPlainText(event.clipboardData?.getData('text/plain') ?? '');
          },
        }),
        h('div', { class: 'knowledge-fill-blank-actions', 'aria-label': 'Blank controls' }, [
          h('button', { type: 'button', class: 'quiet-button', onMousedown: preserveSelection, onClick: makeBlank },
            [h(Icon, { name: 'blank-add' }), 'Make blank']),
          h('button', { type: 'button', class: 'quiet-button', onMousedown: preserveSelection, onClick: removeBlank },
            [h(Icon, { name: 'blank-remove' }), 'Remove blank']),
        ]),
        template.answers.length
          ? h('ol', { class: 'knowledge-fill-blank-answer-key', 'aria-label': 'Blank answer key' },
            template.answers.map((answer, index) => h('li', { key: `${index}-${answer}` }, [
              h('span', { class: 'knowledge-fill-blank-answer-number', 'aria-hidden': 'true' }, `${index + 1}.`),
              h('span', answer),
            ])))
          : h('p', { class: 'knowledge-muted' }, 'Create at least one blank before saving this question.'),
      ]);
    };
  },
});
