import { defineComponent, h, ref } from 'vue';
import { Icon } from './icon.ts';

/** Shows how to share source material in an external AI chat. */
export const AiSourceIntro = defineComponent({
  name: 'AiSourceIntro',
  props: {
    continueLabel: { type: String, default: 'I shared my notes — continue' },
    showImportShortcut: Boolean,
  },
  emits: { next: () => true, import: () => true },
  setup(props, { emit }) {
    const sourceMode = ref<'upload' | 'paste'>('upload');
    return () => h('div', { class: 'ai-source-intro' }, [
      h('div', { class: 'ai-source-ai-choice' }, [
        h('div', [h('strong', 'First, open a separate AI chat'), h('span', 'For example, ChatGPT in another browser tab — Dynamic Learner does not connect to it automatically.')]),
        h('a', { class: 'quiet-button ai-exchange-open-link', href: 'https://chatgpt.com/', target: '_blank', rel: 'noopener noreferrer' }, [
          h(Icon, { name: 'ai' }), 'Open ChatGPT', h(Icon, { name: 'chevron' }),
        ]),
      ]),
            h('div', { class: 'ai-source-tutorial' }, [
              h('div', { class: 'ai-source-tutorial-toolbar' }, [
                h('span', 'How will you share it?'),
                h('div', { class: 'ai-source-tutorial-modes', role: 'group', 'aria-label': 'Study material format' }, [
                  h('button', { type: 'button', class: 'quiet-button', 'aria-pressed': sourceMode.value === 'upload',
                    onClick: () => { sourceMode.value = 'upload'; } }, [h(Icon, { name: 'upload' }), 'Upload a file']),
                  h('button', { type: 'button', class: 'quiet-button', 'aria-pressed': sourceMode.value === 'paste',
                    onClick: () => { sourceMode.value = 'paste'; } }, [h(Icon, { name: 'document' }), 'Paste text']),
                ]),
              ]),
              h('div', { class: 'ai-source-tutorial-scene', 'aria-hidden': 'true' }, [
                h('div', { class: 'ai-source-tutorial-document' }, [
                  h(Icon, { name: sourceMode.value === 'upload' ? 'document' : 'pencil' }),
                  h('span', sourceMode.value === 'upload' ? 'Lecture notes.pdf' : 'Your class notes'),
                ]),
                h('span', { class: 'ai-source-tutorial-arrow' }, [h(Icon, { name: 'chevron' })]),
                h('div', { class: 'ai-source-tutorial-chat' }, [
                  h('div', { class: 'ai-source-tutorial-chat-title' }, [h(Icon, { name: 'ai' }), 'Your AI chat']),
                  h('div', { class: 'ai-source-message-label' }, 'MESSAGE 1 · SEND FIRST'),
                  h('div', { key: sourceMode.value, class: 'ai-source-tutorial-message' }, [
                    h(Icon, { name: sourceMode.value === 'upload' ? 'document' : 'check' }),
                    h('span', sourceMode.value === 'upload' ? 'Lecture notes.pdf' : 'Chapter notes pasted'),
                    h(Icon, { name: 'check' }),
                  ]),
                  h('div', { class: 'ai-source-next-message' }, [
                    h('span', 'MESSAGE 2 · SEND LATER'),
                    h('div', [h(Icon, { name: 'document' }), 'Instructions from Dynamic Learner']),
                  ]),
                ]),
              ]),
              h('div', { class: 'ai-source-send-first', role: 'note' }, [
                h(Icon, { name: 'check' }),
                h('div', [
                  h('strong', 'Send ONLY your study material first'),
                  h('p', sourceMode.value === 'upload'
                    ? 'Upload your notes, PDF, or slides to ChatGPT and send the attachment by itself. Do not add a prompt or instructions.'
                    : 'Paste your notes into ChatGPT and send them as their own message. Do not add a prompt or instructions.'),
                  h('p', 'After you send that message, Dynamic Learner will create the instructions for your SECOND message.'),
                ]),
              ]),
            ]),
            h('div', { class: 'ai-exchange-actions' }, [
              h('button', { type: 'button', class: 'card-primary-button', onClick: () => emit('next') }, [
                props.continueLabel, h(Icon, { name: 'chevron' }),
              ]),
              props.showImportShortcut ? h('button', { type: 'button', class: 'ai-exchange-link', onClick: () => emit('import') }, 'Already have an AI response?') : null,
            ]),

    ]);
  },
});
