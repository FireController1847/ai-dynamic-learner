import { defineComponent, h, ref } from 'vue';
import { Icon } from './icon.ts';

/** Shows how to share source material in an external AI chat. */
export const AiSourceIntro = defineComponent({
  name: 'AiSourceIntro',
  props: {
    continueLabel: { type: String, default: 'Next: Set up instructions' },
    showImportShortcut: Boolean,
  },
  emits: { next: () => true, import: () => true },
  setup(props, { emit }) {
    const sourceMode = ref<'upload' | 'paste'>('upload');
    return () => h('div', { class: 'ai-source-intro' }, [
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
                  h('div', { key: sourceMode.value, class: 'ai-source-tutorial-message' }, [
                    h(Icon, { name: sourceMode.value === 'upload' ? 'document' : 'check' }),
                    h('span', sourceMode.value === 'upload' ? 'Lecture notes.pdf' : 'Chapter notes pasted'),
                  ]),
                ]),
              ]),
              h('p', { class: 'ai-source-tutorial-description' }, sourceMode.value === 'upload'
                ? 'In your AI chat, use its attachment or upload button to select your notes, PDF, or slides. Send the file there first.'
                : 'Copy the text from your notes or textbook, paste it into your AI chat, and send that message first.'),
            ]),
            h('div', { class: 'ai-exchange-actions' }, [
              h('button', { type: 'button', class: 'card-primary-button', onClick: () => emit('next') }, [
                props.continueLabel, h(Icon, { name: 'chevron' }),
              ]),
              props.showImportShortcut ? h('button', { type: 'button', class: 'ai-exchange-link', onClick: () => emit('import') }, 'Already have an AI response?') : null,
            ]),
            h('p', { class: 'ai-source-tutorial-note' },
              'Dynamic Learner does not upload your materials. You share them directly in the AI chat you choose.'),
    ]);
  },
});
