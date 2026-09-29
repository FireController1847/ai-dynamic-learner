import { onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';

export interface DialogLifecycleOptions {
  modal?: boolean | (() => boolean);
  onDeactivate?: () => void;
}

export function useDialog(options: DialogLifecycleOptions = {}) {
  const dialog = ref<HTMLDialogElement | null>(null);

  function close() {
    if (dialog.value?.open) dialog.value.close();
  }

  onMounted(() => {
    const element = dialog.value;
    if (!element) return;
    const modal = typeof options.modal === 'function' ? options.modal() : options.modal ?? true;
    if (modal) element.showModal();
    else element.show();
  });

  onBeforeUnmount(close);
  onDeactivated(() => {
    close();
    options.onDeactivate?.();
  });

  return { dialog, close };
}
