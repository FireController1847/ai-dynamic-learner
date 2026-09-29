/** Read form values through a checked DOM boundary shared by render components. */
export function inputValue(event: Event): string {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
    ? target.value : '';
}

export interface FocusHandle { focus(): void }
