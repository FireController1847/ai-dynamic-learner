import { h, ref, shallowRef } from 'vue';
import { aiRepairPrompt, recoverAiCollection, type AiCollectionOptions, type AiCollectionRecovery } from '../core/ai-response-recovery.ts';
import { AiRecoveryHelp } from './ai-recovery-help.ts';

/** Keep recovery drafts local to one guided AI exchange. Only the feature's parser can approve a candidate. */
export function useAiRecovery<T>(
  options: () => AiCollectionOptions<T>,
  label: () => string,
  itemLabel: () => string,
  accept: (value: T) => void,
  clearResponse: () => void,
  appendRepair: boolean | (() => boolean) = true,
) {
  const canAppend = () => typeof appendRepair === 'function' ? appendRepair() : appendRepair;
  const report = shallowRef<AiCollectionRecovery<T> | null>(null);
  const active = ref(false);
  const retrying = ref(false);
  function reset() {
    report.value = null; active.value = false; retrying.value = false;
  }
  function finish() {
    const value = report.value?.candidate;
    if (value === null || value === undefined) return;
    active.value = false;
    retrying.value = false;
    accept(value);
  }
  function check(text: string) {
    const previous = retrying.value ? report.value : null;
    const result = recoverAiCollection(text, { ...options(), previous: canAppend() ? previous : null });
    // Full-response formats retain the old candidate when a replacement fails.
    if (!canAppend() && previous && !result.candidate && previous.accepted > result.accepted) {
      report.value = { ...previous, issues: result.issues, notices: [...previous.notices, ...result.notices] };
    } else report.value = result;
    retrying.value = false;
    active.value = Boolean(report.value.issues.length || report.value.notices.length || !report.value.candidate);
    if (!active.value) finish();
  }
  function panel() {
    const value = report.value;
    if (!active.value || !value) return null;
    const field = options().field;
    const append = canAppend() && Boolean(value.envelope);
    return h(AiRecoveryHelp, {
      report: value, accepted: value.accepted, itemLabel: itemLabel(), canContinue: Boolean(value.candidate), appendRepair: append,
      repairPrompt: aiRepairPrompt(value, label(), field, value.accepted, append),
      onRetry: () => { retrying.value = true; active.value = false; clearResponse(); },
      onReview: finish,
      onBack: () => { active.value = false; },
    });
  }
  return { active, retrying, report, check, reset, panel };
}
