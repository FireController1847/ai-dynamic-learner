// Keep departing views out of keyboard/assistive-technology interaction while
// their visual exit finishes. Session state and timers never wait for motion.
export function leaveReviewPanel(element: Element): void {
  if (!(element instanceof HTMLElement)) return;
  element.inert = true;
  element.setAttribute('aria-hidden', 'true');
}

export function restoreReviewPanel(element: Element): void {
  if (!(element instanceof HTMLElement)) return;
  element.inert = false;
  element.removeAttribute('aria-hidden');
}

export function enterReviewPanel(element: Element): void {
  if (!(element instanceof HTMLElement)) return;
  restoreReviewPanel(element);
  if (element.contains(document.activeElement)) return;
  const target = element.querySelector<HTMLElement>('[data-review-focus]') ?? element;
  if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
  target.focus({ preventScroll: true });
}
