import { defineComponent, h, nextTick, onBeforeUnmount, ref, Transition } from 'vue';
import { inputValue } from '../core/dom.ts';
import { Icon } from './icon.ts';

export interface AiPromptExchangeHandle { showImport(): void }

/** Manual AI handoff. The feature supplies its own prompt, validator and preview. */
export const AiPromptExchange = defineComponent({
  name: 'AiPromptExchange',
  props: {
    idPrefix: { type: String, required: true },
    prompt: { type: String, required: true },
    promptHelp: { type: String, required: true },
    importHelp: { type: String, required: true },
    label: { type: String, required: true },
    json: { type: String, default: '' },
    problem: { type: String, default: '' },
    maxLength: { type: Number, default: undefined },
    validateLabel: { type: String, default: 'Check response' },
    hasPreview: Boolean,
    startInImport: Boolean,
    importOnly: Boolean,
  },
  emits: { 'update-json': (_value: string) => true, validate: () => true },
  setup(props, { emit, slots, expose }) {
    const stage = ref<'source' | 'instructions' | 'response'>(props.startInImport || props.importOnly ? 'response' : 'source');
    const sourceMode = ref<'upload' | 'paste'>('upload');
    const shown = ref(false);
    const copiedNotice = ref(false);
    const errorMessage = ref('');
    const input = ref<HTMLTextAreaElement | null>(null);
    const promptText = ref<HTMLTextAreaElement | null>(null);
    const preview = ref<HTMLElement | null>(null);
    let disposed = false;
    let focusResponse = false;
    onBeforeUnmount(() => { disposed = true; });

    function selectResponse() {
      copiedNotice.value = false;
      focusResponse = true;
      stage.value = 'response';
      if (stage.value === 'response') nextTick(() => input.value?.focus({ preventScroll: true }));
    }
    function selectInstructions() {
      if (props.importOnly) return;
      stage.value = 'instructions';
      copiedNotice.value = false;
      errorMessage.value = '';
    }

    function selectSource() {
      if (props.importOnly) return;
      stage.value = 'source';
      copiedNotice.value = false;
      errorMessage.value = '';
    }
    expose({ showImport: selectResponse });

    async function copy() {
      errorMessage.value = '';
      try {
        await navigator.clipboard.writeText(props.prompt);
        if (disposed) return;
        copiedNotice.value = true;
        focusResponse = true;
        stage.value = 'response';
      } catch {
        if (disposed) return;
        shown.value = true;
        errorMessage.value = 'Copying was blocked. Select and copy the instructions shown below instead.';
        await nextTick();
        promptText.value?.focus();
        promptText.value?.select();
      }
    }

    function afterStepEnter() {
      if (!focusResponse || stage.value !== 'response') return;
      focusResponse = false;
      input.value?.focus({ preventScroll: true });
    }

    return () => h('div', { class: 'ai-exchange' }, [
      props.importOnly ? null : h('div', { class: 'ai-exchange-progress', 'aria-label': 'AI creation progress' }, [
        h('span', { class: stage.value === 'source' ? 'is-active' : 'is-complete', 'aria-current': stage.value === 'source' ? 'step' : undefined }, '1 · Source'),
        h(Icon, { name: 'chevron' }),
        h('span', { class: stage.value === 'instructions' ? 'is-active' : stage.value === 'response' ? 'is-complete' : '', 'aria-current': stage.value === 'instructions' ? 'step' : undefined }, '2 · Instructions'),
        h(Icon, { name: 'chevron' }),
        h('span', { class: stage.value === 'response' ? 'is-active' : '', 'aria-current': stage.value === 'response' ? 'step' : undefined }, '3 · Import'),
      ]),
      h('div', { class: 'ai-exchange-frame' }, [
        h(Transition, { name: 'ai-exchange-panel', mode: 'out-in', onAfterEnter: afterStepEnter }, {
          default: () => h('section', {
            key: stage.value, class: 'ai-exchange-panel',
            'aria-labelledby': props.idPrefix + '-step-title',
          }, stage.value === 'source' && !props.importOnly ? [
            h('div', { class: 'ai-exchange-step-heading' }, [
              h('h3', { id: props.idPrefix + '-step-title' }, 'Give your AI something to study'),
              h('p', { class: 'ai-exchange-help' }, 'Open your AI chat and share the material you want to learn from.'),
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
              h('button', { type: 'button', class: 'card-primary-button', onClick: selectInstructions }, [
                'Next: Set up instructions', h(Icon, { name: 'chevron' }),
              ]),
              h('button', { type: 'button', class: 'ai-exchange-link', onClick: selectResponse }, 'Already have an AI response?'),
            ]),
            h('p', { class: 'ai-source-tutorial-note' },
              'Dynamic Learner does not upload your materials. You share them directly in the AI chat you choose.'),
          ] : stage.value === 'instructions' && !props.importOnly ? [
            h('div', { class: 'ai-exchange-step-heading' }, [
              h('h3', { id: props.idPrefix + '-step-title' }, 'Prepare your AI instructions'),
              h('p', { class: 'ai-exchange-help' }, props.promptHelp),
            ]),
            slots.options?.(),
            slots.guidance?.(),
            h('div', { class: 'ai-exchange-actions' }, [
              h('button', { type: 'button', class: 'card-primary-button ai-exchange-copy', onClick: copy }, [
                h(Icon, { name: 'duplicate' }), 'Copy instructions',
              ]),
              h('button', { type: 'button', class: 'quiet-button',
                'aria-expanded': shown.value, 'aria-controls': props.idPrefix + '-prompt',
                onClick: () => { shown.value = !shown.value; },
              }, [h(Icon, { name: shown.value ? 'chevron-up' : 'chevron-down' }), shown.value ? 'Hide instructions' : 'View instructions']),
            ]),
            errorMessage.value ? h('p', { class: 'ai-exchange-error', role: 'alert' }, errorMessage.value) : null,
            h(Transition, { name: 'ai-exchange-reveal' }, {
              default: () => shown.value ? h('textarea', {
                ref: promptText, id: props.idPrefix + '-prompt', readonly: true,
                value: props.prompt, rows: 10, 'aria-label': props.label + ' AI instructions',
              }) : null,
            }),
            h('div', { class: 'ai-exchange-secondary' }, [
              h('button', { type: 'button', class: 'ai-exchange-link', onClick: selectSource }, 'Back to source'),
            ]),
          ] : [
            h('div', { class: 'ai-exchange-step-heading' }, [
              h('h3', { id: props.idPrefix + '-step-title' },
                props.hasPreview ? 'Review the result' : 'Bring your AI response back'),
              h('p', { class: 'ai-exchange-help' }, props.importHelp),
            ]),
            copiedNotice.value ? h('p', { class: 'ai-exchange-copied', role: 'status' }, [
              h(Icon, { name: 'check' }), 'Instructions copied. Send them in the same AI chat, then paste its reply below.',
            ]) : null,
            h('label', { class: 'ai-exchange-field-label', for: props.idPrefix + '-response' }, 'AI response'),
            h('textarea', {
              ref: input, id: props.idPrefix + '-response', value: props.json,
              rows: 9, maxlength: props.maxLength,
              placeholder: 'Paste the AI reply here',
              'aria-invalid': props.problem ? 'true' : undefined,
              'aria-describedby': props.problem ? props.idPrefix + '-error' : undefined,
              onInput: (event: Event) => { copiedNotice.value = false; emit('update-json', inputValue(event)); },
            }),
            props.problem ? h('p', { id: props.idPrefix + '-error', role: 'alert', class: 'ai-exchange-error' }, [
              h('strong', 'That response could not be used. '), props.problem,
            ]) : null,
            h('div', { class: 'ai-exchange-actions' }, [
              h('button', { type: 'button', class: 'card-primary-button', disabled: !props.json.trim(), onClick: () => emit('validate') },
                props.validateLabel),
              !props.importOnly ? h('button', { type: 'button', class: 'quiet-button', onClick: selectInstructions }, 'Back to instructions') : null,
            ]),
            h('details', { class: 'ai-exchange-format-help' }, [
              h('summary', 'Having trouble with the response?'),
              h('p', 'Ask your AI to return only the requested response format, without extra explanation. Dynamic Learner reads structured data (JSON) behind the scenes; you only need to copy and paste it.'),
            ]),
            h(Transition, { name: 'ai-exchange-reveal', onAfterEnter: () => preview.value?.focus({ preventScroll: false }) }, {
              default: () => props.hasPreview ? h('div', {
                ref: preview, class: 'ai-exchange-preview', role: 'region',
                'aria-label': props.label + ' preview', tabindex: -1,
              }, slots.preview?.()) : null,
            }),
          ]),
        }),
      ]),
    ]);
  },
});
