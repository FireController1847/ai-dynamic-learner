import { computed, ref, type Ref } from 'vue';
import type { TargetSelector, Placement, TipStep } from './types.ts';

interface Rect { left: number; top: number; right: number; bottom: number; width: number; height: number }
const SPOTLIGHT_PADDING = 8;
const CARD_GAP = 14;
const VIEWPORT_MARGIN = 12;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function selectorList(target?: TargetSelector) {
  if (!target) return [];
  return Array.isArray(target) ? target : [target];
}

export function visibleTarget(selectors?: TargetSelector) {
  for (const selector of selectorList(selectors)) {
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    if (element.closest('[aria-hidden="true"], [inert]')) continue;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (rect.width > 0 && rect.height > 0 && style.display !== 'none' &&
        style.visibility !== 'hidden') return element;
  }
  }
  return null;
}

export function useTipsPosition(openState: Ref<boolean>, mode: Ref<string>, step: Readonly<Ref<TipStep | null>>) {
  const card = ref<HTMLElement | null>(null);
  const targetRect = ref<Rect | null>(null);
  const cardPlacement = ref('center');
  const cardStyle = ref(centeredCardStyle());
  const dragging = ref(false);
  let currentTarget: HTMLElement | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let updateFrame = 0;
  const manualPosition = ref(false);
  let dragPointerId: number | null = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  const scrims = computed(() => {
    const rect = targetRect.value;
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (!rect) return [{ top: 0, left: 0, width, height }];
    return [
      { top: 0, left: 0, width, height: rect.top },
      { top: rect.bottom, left: 0, width, height: Math.max(0, height - rect.bottom) },
      { top: rect.top, left: 0, width: rect.left, height: Math.max(0, rect.bottom - rect.top) },
      { top: rect.top, left: rect.right, width: Math.max(0, width - rect.right), height: Math.max(0, rect.bottom - rect.top) },
    ];
  });

  function centeredCardStyle() {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  function requestPositionUpdate() {
    cancelAnimationFrame(updateFrame);
    updateFrame = requestAnimationFrame(updatePosition);
  }

  function trackTarget(element: HTMLElement | null) {
    if (element === currentTarget) return;
    resizeObserver?.disconnect();
    currentTarget = element;
    if (currentTarget && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(requestPositionUpdate);
      resizeObserver.observe(currentTarget);
    }
  }

  function spotlightRect(element: Element): Rect {
    const source = element.getBoundingClientRect();
    const left = clamp(source.left - SPOTLIGHT_PADDING, 0, window.innerWidth);
    const top = clamp(source.top - SPOTLIGHT_PADDING, 0, window.innerHeight);
    const right = clamp(source.right + SPOTLIGHT_PADDING, 0, window.innerWidth);
    const bottom = clamp(source.bottom + SPOTLIGHT_PADDING, 0, window.innerHeight);
    return {
      left, top, right, bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }

  function overlapArea(first: Pick<Rect, 'left' | 'top' | 'right' | 'bottom'>, second: Rect) {
    const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
    const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
    return width * height;
  }

  function candidatePosition(rect: Rect, placement: Placement, cardWidth: number, cardHeight: number) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - cardWidth - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, viewportHeight - cardHeight - VIEWPORT_MARGIN);
    const centerX = (rect.left + rect.right) / 2;
    const centerY = (rect.top + rect.bottom) / 2;
    let left;
    let top;

    if (placement === 'right') {
      left = rect.right + CARD_GAP;
      top = centerY - cardHeight / 2;
    } else if (placement === 'left') {
      left = rect.left - CARD_GAP - cardWidth;
      top = centerY - cardHeight / 2;
    } else if (placement === 'bottom') {
      left = centerX - cardWidth / 2;
      top = rect.bottom + CARD_GAP;
    } else if (placement === 'top') {
      left = centerX - cardWidth / 2;
      top = rect.top - CARD_GAP - cardHeight;
    } else {
      left = (viewportWidth - cardWidth) / 2;
      top = (viewportHeight - cardHeight) / 2;
    }

    left = clamp(left, VIEWPORT_MARGIN, maxLeft);
    top = clamp(top, VIEWPORT_MARGIN, maxTop);
    return {
      placement,
      left,
      top,
      right: left + cardWidth,
      bottom: top + cardHeight,
    };
  }

  function clampManualCard() {
    const element = card.value;
    if (!element || !manualPosition.value) return;
    const bounds = element.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - bounds.width - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - bounds.height - VIEWPORT_MARGIN);
    cardStyle.value = {
      top: `${Math.round(clamp(bounds.top, VIEWPORT_MARGIN, maxTop))}px`,
      left: `${Math.round(clamp(bounds.left, VIEWPORT_MARGIN, maxLeft))}px`,
      transform: 'none',
    };
  }

  function positionCard(rect: Rect | null) {
    const element = card.value;
    if (!element || !rect) {
      cardPlacement.value = 'center';
      cardStyle.value = centeredCardStyle();
      return;
    }
    if (manualPosition.value) {
      clampManualCard();
      return;
    }

    const bounds = element.getBoundingClientRect();
    const cardWidth = bounds.width;
    const cardHeight = bounds.height;
    const compact = window.innerWidth <= 560;
    const targetCenterY = (rect.top + rect.bottom) / 2;
    const compactPrimary = targetCenterY < window.innerHeight / 2 ? 'bottom' : 'top';
    const preferred = compact ? compactPrimary : step.value?.placement;
    const placements: Placement[] = compact
      ? [compactPrimary, compactPrimary === 'bottom' ? 'top' : 'bottom']
      : ([preferred, 'right', 'left', 'bottom', 'top'] as (Placement | undefined)[])
        .filter((value, index, values): value is Placement => Boolean(value) && values.indexOf(value) === index);

    const fits: Record<Placement, boolean> = {
      center: false,
      right: window.innerWidth - rect.right - CARD_GAP - VIEWPORT_MARGIN >= cardWidth,
      left: rect.left - CARD_GAP - VIEWPORT_MARGIN >= cardWidth,
      bottom: window.innerHeight - rect.bottom - CARD_GAP - VIEWPORT_MARGIN >= cardHeight,
      top: rect.top - CARD_GAP - VIEWPORT_MARGIN >= cardHeight,
    };

    let choice = placements.find((placement) => fits[placement]);
    if (!choice) {
      const center = candidatePosition(rect, 'center', cardWidth, cardHeight);
      const centerOverlap = overlapArea(center, rect);

      if (centerOverlap === 0) {
        choice = 'center';
      } else {
        const alternatives = placements.map((placement, index) => {
          const candidate = candidatePosition(rect, placement, cardWidth, cardHeight);
          return {
            ...candidate,
            overlap: overlapArea(candidate, rect),
            preference: index,
          };
        });
        alternatives.sort((a, b) => a.overlap - b.overlap || a.preference - b.preference);
        choice = alternatives[0]?.placement ?? 'center';
      }
    }

    const candidate = candidatePosition(rect, choice, cardWidth, cardHeight);
    cardPlacement.value = choice;
    cardStyle.value = {
      top: `${Math.round(candidate.top)}px`,
      left: `${Math.round(candidate.left)}px`,
      transform: 'none',
    };
  }

  function beginCardDrag(event: PointerEvent) {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button, a, input, select, textarea'))) return;
    const element = card.value;
    if (!element) return;

    const bounds = element.getBoundingClientRect();
    manualPosition.value = true;
    dragging.value = true;
    dragPointerId = event.pointerId;
    dragOffsetX = event.clientX - bounds.left;
    dragOffsetY = event.clientY - bounds.top;
    cardPlacement.value = 'manual';
    cardStyle.value = {
      top: `${Math.round(bounds.top)}px`,
      left: `${Math.round(bounds.left)}px`,
      transform: 'none',
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function dragCard(event: PointerEvent) {
    if (!dragging.value || event.pointerId !== dragPointerId || !card.value) return;
    const bounds = card.value.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - bounds.width - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - bounds.height - VIEWPORT_MARGIN);
    cardStyle.value = {
      top: `${Math.round(clamp(event.clientY - dragOffsetY, VIEWPORT_MARGIN, maxTop))}px`,
      left: `${Math.round(clamp(event.clientX - dragOffsetX, VIEWPORT_MARGIN, maxLeft))}px`,
      transform: 'none',
    };
  }

  function endCardDrag(event: PointerEvent) {
    if (!dragging.value || event.pointerId !== dragPointerId) return;
    dragging.value = false;
    dragPointerId = null;
    if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    }
  }

  function updatePosition() {
    if (!openState.value) return;
    if (manualPosition.value && mode.value !== 'tour') {
      clampManualCard();
      return;
    }
    if (mode.value !== 'tour') return;
    const element = visibleTarget(step.value?.target);
    trackTarget(element);

    if (!element) {
      targetRect.value = null;
      if (manualPosition.value) clampManualCard();
      else positionCard(null);
      return;
    }

    let rect = element.getBoundingClientRect();
    const outside = rect.bottom < 0 || rect.top > window.innerHeight ||
      rect.right < 0 || rect.left > window.innerWidth;
    if (outside) {
      element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      rect = element.getBoundingClientRect();
    }

    targetRect.value = spotlightRect(element);
    positionCard(targetRect.value);
  }

  function resetTracking() {
    resizeObserver?.disconnect();
    resizeObserver = null;
    currentTarget = null;
    cancelAnimationFrame(updateFrame);
    updateFrame = 0;
    targetRect.value = null;
  }
  return { card, targetRect, cardPlacement, cardStyle, dragging, manualPosition, scrims, centeredCardStyle, trackTarget, requestPositionUpdate, updatePosition, beginCardDrag, dragCard, endCardDrag, resetTracking };
}
