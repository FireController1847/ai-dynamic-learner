import { defineComponent, h, nextTick, onBeforeUnmount, ref, Transition, watch } from 'vue';
import { inputValue } from '../core/dom.ts';
import { Icon } from './icon.ts';
import { AiSourceIntro } from './ai-source-intro.ts';

export interface AiPromptExchangeHandle { showImport(): void; goBack(): boolean }

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
    skipSource: Boolean,
    showReviewStep: Boolean,
    preferFileImport: Boolean,
  },
  emits: { 'update-json': (_value: string) => true, validate: () => true },
  setup(props, { emit, slots, expose }) {
    const stage = ref<'source' | 'instructions' | 'send' | 'response'>(props.startInImport || props.importOnly ? 'response' : props.skipSource ? 'instructions' : 'source');
    const shown = ref(false);
    const copied = ref(false);
    const copying = ref(false);
    const errorMessage = ref('');
    const uploadedFile = ref('');
    const fileProblem = ref('');
    const uploading = ref(false);
    const draggingFile = ref(false);
    const pasteExpanded = ref(false);
    const fileInput = ref<HTMLInputElement | null>(null);
    const fileButton = ref<HTMLButtonElement | null>(null);
    const input = ref<HTMLTextAreaElement | null>(null);
    const stepHeading = ref<HTMLElement | null>(null);
    const promptText = ref<HTMLTextAreaElement | null>(null);
    const preview = ref<HTMLElement | null>(null);
    let disposed = false;
    let focusResponse = false;
    let copyTimer: ReturnType<typeof setTimeout> | undefined;
    let copyAttempt = 0;
    let fileAttempt = 0;
    function cancelCopy() {
      clearTimeout(copyTimer);
      copyTimer = undefined;
      copyAttempt++;
      copying.value = false;
    }
    watch(stage, () => {
      cancelCopy();
      if (stage.value === 'instructions') copied.value = false;
    }, { flush: 'sync' });
    onBeforeUnmount(() => { disposed = true; fileAttempt++; cancelCopy(); });

    async function acceptJsonFile(file: File | undefined) {
      if (!file) return;
      const attempt = ++fileAttempt;
      draggingFile.value = false;
      fileProblem.value = '';
      uploadedFile.value = '';
      // Never allow an earlier, previously selected file to be validated
      // after the user deliberately chooses a new one.
      emit('update-json', '');
      if (!file.name.toLowerCase().endsWith('.json')) {
        fileProblem.value = 'Choose a .json file from your AI conversation.';
        return;
      }
      if (props.maxLength !== undefined && file.size > props.maxLength * 4) {
        fileProblem.value = 'This file is too large to import.';
        return;
      }
      uploading.value = true;
      try {
        const contents = await file.text();
        if (props.maxLength !== undefined && contents.length > props.maxLength) {
          throw new Error('The JSON exceeds the supported import size.');
        }
        try { JSON.parse(contents); }
        catch { throw new Error('This file does not contain valid JSON.'); }
        if (disposed || attempt !== fileAttempt) return;
        uploadedFile.value = file.name;
        pasteExpanded.value = false;
        emit('update-json', contents);
      } catch (error) {
        if (disposed || attempt !== fileAttempt) return;
        fileProblem.value = error instanceof Error ? error.message : 'Could not read this JSON file.';
      } finally {
        if (attempt === fileAttempt) uploading.value = false;
      }
    }

    function loadJsonFile(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const file = target.files?.[0];
      target.value = ''; // Reselecting the same file must work after a correction.
      void acceptJsonFile(file);
    }

    function dropJsonFile(event: DragEvent) {
      event.preventDefault();
      draggingFile.value = false;
      if (uploading.value) return;
      void acceptJsonFile(event.dataTransfer?.files[0]);
    }

    function clearJsonFile() {
      fileAttempt++;
      uploading.value = false;
      uploadedFile.value = '';
      fileProblem.value = '';
      emit('update-json', '');
      if (fileInput.value) fileInput.value.value = '';
      nextTick(() => fileButton.value?.focus({ preventScroll: true }));
    }

    function updatePastedJson(event: Event) {
      fileAttempt++;
      uploading.value = false;
      uploadedFile.value = '';
      fileProblem.value = '';
      emit('update-json', inputValue(event));
    }

    function selectResponse() {
      focusResponse = true;
      stage.value = 'response';
    }
    function selectInstructions() {
      if (props.importOnly) return;
      stage.value = 'instructions';
      errorMessage.value = '';
    }

    function selectSource() {
      if (props.importOnly || props.skipSource) return;
      stage.value = 'source';
      errorMessage.value = '';
    }
    function goBack(): boolean {
      if (props.importOnly) return false;
      if (stage.value === 'response') stage.value = 'send';
      else if (stage.value === 'send') stage.value = 'instructions';
      else if (stage.value === 'instructions' && !props.skipSource) stage.value = 'source';
      else return false;
      errorMessage.value = '';
      return true;
    }
    expose({ showImport: selectResponse, goBack });

    async function copy() {
      if (copying.value || copied.value) return;
      const attempt = ++copyAttempt;
      copying.value = true;
      errorMessage.value = '';
      try {
        await navigator.clipboard.writeText(props.prompt);
        if (disposed || attempt !== copyAttempt) return;
        confirmCopied();
      } catch {
        if (disposed || attempt !== copyAttempt) return;
        copying.value = false;
        shown.value = true;
        errorMessage.value = 'Copying was blocked. Select and copy the instructions shown below instead.';
        await nextTick();
        promptText.value?.focus();
        promptText.value?.select();
      }
    }

    function confirmCopied() {
      if (copied.value) return;
      errorMessage.value = '';
      copying.value = false;
      copied.value = true;
      // Keep the success animation visible before starting the step transition.
      copyTimer = setTimeout(() => {
        copyTimer = undefined;
        if (disposed || stage.value !== 'instructions') return;
        focusResponse = true;
        stage.value = 'send';
      }, 1000);
    }

    function afterStepEnter() {
      if (focusResponse && stage.value === 'response') {
        focusResponse = false;
        if (props.preferFileImport) fileButton.value?.focus({ preventScroll: true });
        else input.value?.focus({ preventScroll: true });
      } else stepHeading.value?.focus({ preventScroll: true });
    }

    return () => h('div', { class: 'ai-exchange' }, [
      props.importOnly ? null : h('div', { class: 'ai-exchange-progress', 'aria-label': 'AI creation progress' }, [
        !props.skipSource ? h('span', { class: stage.value === 'source' ? 'is-active' : 'is-complete', 'aria-current': stage.value === 'source' ? 'step' : undefined }, '1 · Source') : null,
        !props.skipSource ? h(Icon, { name: 'chevron' }) : null,
        h('span', { class: stage.value === 'instructions' ? 'is-active' : stage.value === 'send' || stage.value === 'response' ? 'is-complete' : '', 'aria-current': stage.value === 'instructions' ? 'step' : undefined }, props.skipSource ? '1 · Copy' : '2 · Copy'),
        h(Icon, { name: 'chevron' }),
        h('span', { class: stage.value === 'send' ? 'is-active' : stage.value === 'response' ? 'is-complete' : '', 'aria-current': stage.value === 'send' ? 'step' : undefined }, props.skipSource ? '2 · Send' : '3 · Send'),
        h(Icon, { name: 'chevron' }),
        h('span', { class: stage.value === 'response' ? 'is-active' : '', 'aria-current': stage.value === 'response' ? 'step' : undefined }, props.skipSource ? '3 · Return' : '4 · Return'),
        props.showReviewStep ? h(Icon, { name: 'chevron' }) : null,
        props.showReviewStep ? h('span', { 'aria-label': 'Upcoming step' }, props.skipSource ? '4 · Review' : '5 · Review') : null,
      ]),
      h('div', { class: 'ai-exchange-frame' }, [
        h(Transition, { name: 'ai-exchange-panel', mode: 'out-in', onAfterEnter: afterStepEnter }, {
          default: () => h('section', {
            key: stage.value, class: 'ai-exchange-panel',
            'aria-labelledby': props.idPrefix + '-step-title',
          }, stage.value === 'source' && !props.importOnly ? [
            h('div', { class: 'ai-exchange-step-heading' }, [
              h('h3', { id: props.idPrefix + '-step-title', ref: stepHeading, tabindex: -1 }, 'Give your AI something to study'),
              h('p', { class: 'ai-exchange-help' }, 'Open your AI chat and share the material you want to learn from.'),
            ]),
            h(AiSourceIntro, { showImportShortcut: true, onNext: selectInstructions, onImport: selectResponse }),
          ] : stage.value === 'instructions' && !props.importOnly ? [
            h('div', { class: 'ai-exchange-step-heading' }, [
              h('h3', { id: props.idPrefix + '-step-title' }, 'Make instructions for your AI'),
              h('p', { class: 'ai-exchange-help' }, props.promptHelp),
            ]),
            slots.options?.(),
            slots.guidance?.(),
            h('div', { class: 'ai-exchange-actions' }, [
              h('button', {
                type: 'button', class: ['card-primary-button ai-exchange-copy', { 'is-copied': copied.value }],
                disabled: copying.value || copied.value,
                'aria-label': copied.value ? 'Instructions copied to clipboard' : 'Copy instructions for your AI',
                onClick: copy,
              }, [
                h('span', { class: 'ai-exchange-copy-label', 'aria-hidden': 'true' }, [
                  h(Icon, { name: 'duplicate' }), 'Copy instructions for your AI',
                ]),
                h('span', { class: 'ai-exchange-copy-success', 'aria-hidden': 'true' }, [
                  h(Icon, { name: 'check' }), 'Copied!',
                ]),
              ]),
              h('span', { class: 'visually-hidden', role: 'status', 'aria-atomic': 'true' }, copied.value ? 'Instructions copied to clipboard' : ''),
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
            errorMessage.value ? h('button', { type: 'button', class: 'quiet-button', onClick: confirmCopied }, 'I copied the instructions') : null,
            h('div', { class: 'ai-exchange-secondary' }, [
              !props.skipSource ? h('button', { type: 'button', class: 'ai-exchange-link', onClick: selectSource }, 'Back to source') : null,
            ]),
          ] : stage.value === 'send' && !props.importOnly ? [
            h('div', { class: 'ai-exchange-step-heading' }, [
              h('h3', { id: props.idPrefix + '-step-title' }, 'Send the instructions to your AI'),
              h('p', { class: 'ai-exchange-help' }, 'Your instructions are copied. They have NOT been sent to ChatGPT or any other AI yet.'),
            ]),
            h('div', { class: 'ai-send-scene', 'aria-hidden': 'true' }, [
              h('div', { class: 'ai-send-piece' }, [h(Icon, { name: 'duplicate' }), 'Copied instructions']),
              h(Icon, { name: 'chevron' }),
              h('div', { class: 'ai-send-chat' }, [
                h('div', { class: 'ai-send-chat-heading' }, [h(Icon, { name: 'ai' }), 'Your AI conversation']),
                h('div', { class: 'ai-send-bubble' }, [h(Icon, { name: 'document' }), 'Paste instructions here']),
                h('div', { class: 'ai-send-reply' }, [h(Icon, { name: 'check' }), 'AI replies']),
              ]),
            ]),
            h('div', { class: 'ai-send-directions' }, [
              h('strong', 'Back in the same chat where you sent your notes:'),
              h('ol', [h('li', 'Paste the copied instructions into the message box.'), h('li', 'Send the message and let your AI finish answering.')]),
            ]),
            h('div', { class: 'ai-exchange-actions' }, [
              h('button', { type: 'button', class: 'card-primary-button', onClick: selectResponse }, 'I sent the instructions — next'),
              h('a', { class: 'quiet-button ai-exchange-open-link', href: 'https://chatgpt.com/', target: '_blank', rel: 'noopener noreferrer' }, [h(Icon, { name: 'ai' }), 'Open ChatGPT', h(Icon, { name: 'chevron' })]),
            ]),
            h('button', { type: 'button', class: 'ai-exchange-link', onClick: selectInstructions }, 'Back to instructions'),
          ] : [
            h('div', { class: 'ai-exchange-step-heading' }, [
              h('h3', { id: props.idPrefix + '-step-title' },
                props.hasPreview ? 'Review your generated content' : props.preferFileImport ? 'Bring your AI response back' : 'Paste your AI’s reply here'),
              h('p', { class: 'ai-exchange-help' }, props.importHelp),
            ]),
            !props.hasPreview && !props.preferFileImport ? h('div', { class: 'ai-response-path', 'aria-label': 'Final import steps' }, [
              h('span', [h(Icon, { name: 'duplicate' }), '1. Copy the complete AI reply']),
              h(Icon, { name: 'chevron' }),
              h('span', [h(Icon, { name: 'check' }), '2. Check and preview it']),
            ]) : null,
            props.preferFileImport ? h('div', { class: 'ai-json-return' }, [
              h('input', {
                ref: fileInput, id: props.idPrefix + '-file',
                type: 'file', accept: '.json,application/json',
                class: 'ai-json-file-input', tabindex: -1, 'aria-hidden': 'true',
                onChange: loadJsonFile,
              }),
              h('div', {
                class: ['ai-json-dropzone', {
                  'is-dragging': draggingFile.value,
                  'has-file': Boolean(uploadedFile.value || props.json.trim()),
                }],
                role: 'group', 'aria-label': 'Choose a JSON file',
                onDragenter: (event: DragEvent) => {
                  event.preventDefault();
                  draggingFile.value = true;
                },
                onDragover: (event: DragEvent) => {
                  event.preventDefault();
                  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
                  draggingFile.value = true;
                },
                onDragleave: (event: DragEvent) => {
                  const target = event.currentTarget;
                  if (target instanceof HTMLElement &&
                      event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
                  draggingFile.value = false;
                },
                onDrop: dropJsonFile,
              }, [
                h('span', { class: 'ai-json-upload-mark', 'aria-hidden': 'true' }, [
                  h(Icon, { name: uploadedFile.value || props.json.trim() ? 'check' : 'upload' }),
                ]),
                h('div', { class: 'ai-json-upload-copy' }, [
                  h('strong', uploading.value ? 'Reading your file…'
                    : uploadedFile.value || (props.json.trim() ? 'JSON response ready' : 'Add your JSON file')),
                  h('p', { class: 'ai-exchange-help' },
                    uploading.value ? 'Checking the file format locally.'
                      : uploadedFile.value || props.json.trim()
                        ? 'Ready to validate and move on.'
                        : 'Drop a .json file here, or select one from your device.'),
                ]),
                h('div', { class: 'ai-json-upload-actions' }, [
                  h('button', {
                    ref: fileButton, type: 'button', class: 'quiet-button ai-json-choose-button',
                    disabled: uploading.value, onClick: () => fileInput.value?.click(),
                  }, [h(Icon, { name: 'upload' }),
                    uploadedFile.value || props.json.trim() ? 'Replace file' : 'Choose JSON file']),
                  uploadedFile.value || props.json.trim() ? h('button', {
                    type: 'button', class: 'quiet-button ai-json-clear-button',
                    'aria-label': 'Clear selected JSON response', disabled: uploading.value,
                    onClick: clearJsonFile,
                  }, [h(Icon, { name: 'trash' }), 'Clear']) : null,
                ]),
              ]),
              fileProblem.value ? h('p', { class: 'ai-exchange-error', role: 'alert' }, fileProblem.value) : null,
              h('p', { class: 'ai-json-privacy' }, [
                h(Icon, { name: 'check' }), 'Read locally in your browser. Nothing is sent to a server.',
              ]),
              h('div', { class: 'ai-json-fallback' }, [
                h('button', {
                  type: 'button', class: 'ai-exchange-link ai-json-paste-toggle',
                  'aria-expanded': pasteExpanded.value,
                  'aria-controls': props.idPrefix + '-paste-panel',
                  onClick: () => {
                    pasteExpanded.value = !pasteExpanded.value;
                    if (pasteExpanded.value) void nextTick(() => input.value?.focus({ preventScroll: true }));
                  },
                }, [
                  h(Icon, { name: pasteExpanded.value ? 'chevron-up' : 'chevron-down' }),
                  pasteExpanded.value ? 'Hide JSON editor' : 'No file? Paste JSON instead',
                ]),
                h(Transition, { name: 'ai-exchange-reveal' }, {
                  default: () => pasteExpanded.value ? h('div', {
                    class: 'ai-json-paste-panel', id: props.idPrefix + '-paste-panel',
                  }, [
                    h('label', { class: 'ai-exchange-field-label', for: props.idPrefix + '-response' },
                      'Paste your AI response'),
                    h('textarea', {
                      ref: input, id: props.idPrefix + '-response', value: props.json,
                      rows: 6, maxlength: props.maxLength,
                      placeholder: 'Paste the complete JSON response here',
                      'aria-invalid': props.problem ? 'true' : undefined,
                      'aria-describedby': props.problem ? props.idPrefix + '-error' : undefined,
                      onInput: updatePastedJson,
                    }),
                  ]) : null,
                }),
              ]),
            ]) : null,
            !props.preferFileImport ? h('label', { class: 'ai-exchange-field-label', for: props.idPrefix + '-response' }, 'AI response') : null,
            !props.preferFileImport ? h('textarea', {
              ref: input, id: props.idPrefix + '-response', value: props.json,
              rows: 9, maxlength: props.maxLength,
              placeholder: 'Paste everything your AI generated here (including the code block)',
              'aria-invalid': props.problem ? 'true' : undefined,
              'aria-describedby': props.problem ? props.idPrefix + '-error' : undefined,
              onInput: (event: Event) => { emit('update-json', inputValue(event)); },
            }) : null,
            props.problem ? h('p', { id: props.idPrefix + '-error', role: 'alert', class: 'ai-exchange-error' }, [
              h('strong', 'That response could not be used. '), props.problem,
            ]) : null,
            h('div', { class: 'ai-exchange-actions' }, [
              h('button', { type: 'button', class: 'card-primary-button', disabled: !props.json.trim() || uploading.value, onClick: () => emit('validate') },
                props.hasPreview ? 'Check again' : props.validateLabel),
              !props.importOnly && !props.preferFileImport ? h('button', { type: 'button', class: 'quiet-button', onClick: () => { stage.value = 'send'; } }, 'Back to AI chat step') : null,
            ]),
            h('details', { class: 'ai-exchange-format-help' }, [
              h('summary', 'Having trouble with the response?'),
              h('p', props.preferFileImport
                  ? 'Ask your AI for a downloadable .json file containing only the requested JSON. If it responds with text, use the paste option above instead.'
                  : 'Ask your AI to return only the requested response format, without extra explanation. Dynamic Learner reads structured data (JSON) behind the scenes; you only need to copy and paste it.'),
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
