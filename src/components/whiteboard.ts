import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Icon } from './icon.ts';

type WhiteboardTool = 'marker' | 'eraser';
type MarkerColor = '#252525' | '#2463a7' | '#bd3430' | '#24804b';
type SnapZone = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface DrawPoint {
  x: number;
  y: number;
  pressure: number;
}

interface DrawStroke {
  tool: WhiteboardTool;
  color: MarkerColor;
  size: number;
  eraserWidth?: number;
  eraserHeight?: number;
  points: DrawPoint[];
}

interface StoredWhiteboard {
  version: 1;
  x: number;
  y: number;
  width: number;
  height: number;
  snap?: SnapZone | null;
  tool: WhiteboardTool;
  color: MarkerColor;
  size: number;
  strokes: DrawStroke[];
}

interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WhiteboardHandle {
  open(trigger?: EventTarget | null): void;
  close(): void;
}

const STORAGE_KEY = 'dynamic-learner.whiteboard.v1';
const COLORS: MarkerColor[] = ['#252525', '#2463a7', '#bd3430', '#24804b'];
const SIZES = [2, 4, 7] as const;
const SNAP_ZONES: SnapZone[] = [
  'left', 'right', 'top', 'bottom',
  'top-left', 'top-right', 'bottom-left', 'bottom-right',
];
const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;
const VIEWPORT_GAP = 8;
const ERASER_SIZE = 34;
const SNAP_THRESHOLD = 52;
const SHAKE_WINDOW_MS = 850;
const SHAKE_REVERSALS = 4;
const SHAKE_TRAVEL = 180;
const SHAKE_STEP = 7;

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPoint(value: unknown): value is DrawPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return finite(point.x) && point.x >= 0 && point.x <= 1
    && finite(point.y) && point.y >= 0 && point.y <= 1
    && finite(point.pressure) && point.pressure >= 0 && point.pressure <= 1;
}

function isSnapZone(value: unknown): value is SnapZone {
  return typeof value === 'string' && SNAP_ZONES.includes(value as SnapZone);
}

function isStroke(value: unknown): value is DrawStroke {
  if (!value || typeof value !== 'object') return false;
  const stroke = value as Record<string, unknown>;
  const eraserWidth = stroke.eraserWidth;
  const eraserHeight = stroke.eraserHeight;
  return (stroke.tool === 'marker' || stroke.tool === 'eraser')
    && COLORS.includes(stroke.color as MarkerColor)
    && finite(stroke.size) && stroke.size >= 1 && stroke.size <= 20
    && (eraserWidth === undefined || (finite(eraserWidth) && eraserWidth > 0 && eraserWidth <= 1))
    && (eraserHeight === undefined || (finite(eraserHeight) && eraserHeight > 0 && eraserHeight <= 1))
    && Array.isArray(stroke.points) && stroke.points.every(isPoint);
}

function readStored(): StoredWhiteboard | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    if (value.version !== 1 || !finite(value.x) || !finite(value.y) || !finite(value.width) || !finite(value.height)
      || (value.snap !== undefined && value.snap !== null && !isSnapZone(value.snap))
      || (value.tool !== 'marker' && value.tool !== 'eraser') || !COLORS.includes(value.color as MarkerColor)
      || !SIZES.includes(value.size as (typeof SIZES)[number]) || !Array.isArray(value.strokes) || !value.strokes.every(isStroke)) return null;
    return value as unknown as StoredWhiteboard;
  } catch {
    return null;
  }
}

export const Whiteboard = defineComponent({
  name: 'Whiteboard',
  props: { disabled: Boolean },
  setup(props, { expose }) {
    const stored = readStored();
    const openState = ref(false);
    const frame = ref<HTMLElement | null>(null);
    const surface = ref<HTMLElement | null>(null);
    const canvas = ref<HTMLCanvasElement | null>(null);
    const x = ref(stored?.x ?? 80);
    const y = ref(stored?.y ?? 72);
    const width = ref(stored?.width ?? 640);
    const height = ref(stored?.height ?? 420);
    const snapZone = ref<SnapZone | null>(stored?.snap ?? null);
    const snapPreview = ref<SnapZone | null>(null);
    const tool = ref<WhiteboardTool>(stored?.tool ?? 'marker');
    const color = ref<MarkerColor>(stored?.color ?? COLORS[0]);
    const size = ref<number>(stored?.size ?? 4);
    const strokes = ref<DrawStroke[]>(stored?.strokes ?? []);
    const eraserCursor = ref<{ x: number; y: number } | null>(null);
    const clearConfirm = ref(false);
    const clearCancel = ref<HTMLButtonElement | null>(null);
    const clearAccept = ref<HTMLButtonElement | null>(null);
    let clearReturnFocus: HTMLElement | null = null;
    let trigger: HTMLElement | null = null;
    let activePointer: number | null = null;
    let activeStroke: DrawStroke | null = null;
    let resizeObserver: ResizeObserver | null = null;

    function persist() {
      try {
        const value: StoredWhiteboard = {
          version: 1,
          x: x.value,
          y: y.value,
          width: width.value,
          height: height.value,
          snap: snapZone.value,
          tool: tool.value,
          color: color.value,
          size: size.value,
          strokes: strokes.value,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        // Drawing remains available for the current session if browser storage is unavailable.
      }
    }

    function clampGeometry() {
      const minWidth = Math.min(MIN_WIDTH, Math.max(220, window.innerWidth - VIEWPORT_GAP * 2));
      const minHeight = Math.min(MIN_HEIGHT, Math.max(180, window.innerHeight - VIEWPORT_GAP * 2));
      const maxWidth = Math.max(minWidth, window.innerWidth - VIEWPORT_GAP * 2);
      const maxHeight = Math.max(minHeight, window.innerHeight - VIEWPORT_GAP * 2);
      width.value = Math.min(Math.max(minWidth, width.value), maxWidth);
      height.value = Math.min(Math.max(minHeight, height.value), maxHeight);
      x.value = Math.min(Math.max(VIEWPORT_GAP, x.value), Math.max(VIEWPORT_GAP, window.innerWidth - width.value - VIEWPORT_GAP));
      y.value = Math.min(Math.max(VIEWPORT_GAP, y.value), Math.max(VIEWPORT_GAP, window.innerHeight - height.value - VIEWPORT_GAP));
    }

    function snapGeometry(zone: SnapZone): WindowGeometry {
      const availableWidth = Math.max(1, window.innerWidth - VIEWPORT_GAP * 2);
      const availableHeight = Math.max(1, window.innerHeight - VIEWPORT_GAP * 2);
      const halfWidth = availableWidth / 2;
      const halfHeight = availableHeight / 2;
      const thirdWidth = availableWidth / 3;
      const thirdHeight = availableHeight / 3;
      const left = VIEWPORT_GAP;
      const top = VIEWPORT_GAP;

      switch (zone) {
        case 'left': return { x: left, y: top, width: thirdWidth, height: availableHeight };
        case 'right': return { x: left + availableWidth - thirdWidth, y: top, width: thirdWidth, height: availableHeight };
        case 'top': return { x: left, y: top, width: availableWidth, height: thirdHeight };
        case 'bottom': return { x: left, y: top + availableHeight - thirdHeight, width: availableWidth, height: thirdHeight };
        case 'top-left': return { x: left, y: top, width: halfWidth, height: halfHeight };
        case 'top-right': return { x: left + halfWidth, y: top, width: halfWidth, height: halfHeight };
        case 'bottom-left': return { x: left, y: top + halfHeight, width: halfWidth, height: halfHeight };
        case 'bottom-right': return { x: left + halfWidth, y: top + halfHeight, width: halfWidth, height: halfHeight };
      }
    }

    function detectSnap(clientX: number, clientY: number): SnapZone | null {
      const nearLeft = clientX <= SNAP_THRESHOLD;
      const nearRight = clientX >= window.innerWidth - SNAP_THRESHOLD;
      const nearTop = clientY <= SNAP_THRESHOLD;
      const nearBottom = clientY >= window.innerHeight - SNAP_THRESHOLD;

      if (nearTop && nearLeft) return 'top-left';
      if (nearTop && nearRight) return 'top-right';
      if (nearBottom && nearLeft) return 'bottom-left';
      if (nearBottom && nearRight) return 'bottom-right';
      if (nearLeft) return 'left';
      if (nearRight) return 'right';
      if (nearTop) return 'top';
      if (nearBottom) return 'bottom';
      return null;
    }

    function applySnap(zone: SnapZone) {
      const geometry = snapGeometry(zone);
      snapZone.value = zone;
      x.value = geometry.x;
      y.value = geometry.y;
      width.value = geometry.width;
      height.value = geometry.height;
      snapPreview.value = null;
      void nextTick(fitCanvas);
    }

    function snapPreviewStyle() {
      if (!snapPreview.value) return {};
      const geometry = snapGeometry(snapPreview.value);
      return {
        left: `${geometry.x}px`,
        top: `${geometry.y}px`,
        width: `${geometry.width}px`,
        height: `${geometry.height}px`,
      };
    }

    function context() {
      const element = canvas.value;
      if (!element) return null;
      return element.getContext('2d');
    }

    function eraserDimensions(stroke: DrawStroke, rect: DOMRect) {
      return {
        width: stroke.eraserWidth ? stroke.eraserWidth * rect.width : ERASER_SIZE,
        height: stroke.eraserHeight ? stroke.eraserHeight * rect.height : ERASER_SIZE,
      };
    }

    function drawDot(ctx: CanvasRenderingContext2D, stroke: DrawStroke, point: DrawPoint, rect: DOMRect) {
      const centerX = point.x * rect.width;
      const centerY = point.y * rect.height;
      ctx.save();
      ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.fillStyle = stroke.color;

      if (stroke.tool === 'eraser') {
        const eraser = eraserDimensions(stroke, rect);
        ctx.fillRect(centerX - eraser.width / 2, centerY - eraser.height / 2, eraser.width, eraser.height);
      } else {
        const pressure = Math.max(0.35, point.pressure);
        ctx.beginPath();
        ctx.arc(centerX, centerY, stroke.size * 0.5 * pressure, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawSegment(ctx: CanvasRenderingContext2D, stroke: DrawStroke, from: DrawPoint, to: DrawPoint, rect: DOMRect) {
      if (stroke.tool === 'eraser') {
        const eraser = eraserDimensions(stroke, rect);
        const fromX = from.x * rect.width;
        const fromY = from.y * rect.height;
        const toX = to.x * rect.width;
        const toY = to.y * rect.height;
        const distance = Math.hypot(toX - fromX, toY - fromY);
        const steps = Math.max(1, Math.ceil(distance / Math.max(2, Math.min(eraser.width, eraser.height) * 0.22)));
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        for (let index = 0; index <= steps; index += 1) {
          const progress = index / steps;
          const centerX = fromX + (toX - fromX) * progress;
          const centerY = fromY + (toY - fromY) * progress;
          ctx.fillRect(centerX - eraser.width / 2, centerY - eraser.height / 2, eraser.width, eraser.height);
        }
        ctx.restore();
        return;
      }

      const pressure = Math.max(0.35, (from.pressure + to.pressure) / 2);
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size * pressure;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(from.x * rect.width, from.y * rect.height);
      ctx.lineTo(to.x * rect.width, to.y * rect.height);
      ctx.stroke();
      ctx.restore();
    }

    function redraw() {
      const element = canvas.value;
      const ctx = context();
      if (!element || !ctx) return;
      const rect = element.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      for (const stroke of strokes.value) {
        if (!stroke.points.length) continue;
        drawDot(ctx, stroke, stroke.points[0]!, rect);
        for (let index = 1; index < stroke.points.length; index += 1) {
          drawSegment(ctx, stroke, stroke.points[index - 1]!, stroke.points[index]!, rect);
        }
      }
    }

    function fitCanvas() {
      const element = canvas.value;
      if (!element || !openState.value) return;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      let migratedEraser = false;
      for (const stroke of strokes.value) {
        if (stroke.tool !== 'eraser' || (stroke.eraserWidth && stroke.eraserHeight)) continue;
        stroke.eraserWidth = ERASER_SIZE / rect.width;
        stroke.eraserHeight = ERASER_SIZE / rect.height;
        migratedEraser = true;
      }

      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const pixelWidth = Math.max(1, Math.round(rect.width * ratio));
      const pixelHeight = Math.max(1, Math.round(rect.height * ratio));
      if (element.width !== pixelWidth || element.height !== pixelHeight) {
        element.width = pixelWidth;
        element.height = pixelHeight;
      }
      const ctx = context();
      ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
      redraw();
      if (migratedEraser) persist();
    }

    function eventPoint(event: PointerEvent): DrawPoint | null {
      const element = canvas.value;
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return {
        x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
        pressure: event.pointerType === 'pen' ? Math.min(1, Math.max(0.05, event.pressure || 0.5)) : 1,
      };
    }

    function trackEraserCursor(event: PointerEvent) {
      if (tool.value !== 'eraser') {
        eraserCursor.value = null;
        return;
      }
      const element = canvas.value;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      eraserCursor.value = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }

    function appendPointer(event: PointerEvent) {
      if (!activeStroke) return;
      const point = eventPoint(event);
      const element = canvas.value;
      const ctx = context();
      if (!point || !element || !ctx) return;
      const previous = activeStroke.points.at(-1);
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0008) return;
      activeStroke.points.push(point);
      const rect = element.getBoundingClientRect();
      if (previous) drawSegment(ctx, activeStroke, previous, point, rect);
      else drawDot(ctx, activeStroke, point, rect);
    }

    function pointerDown(event: PointerEvent) {
      if (activePointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      trackEraserCursor(event);
      activePointer = event.pointerId;
      canvas.value?.setPointerCapture(event.pointerId);
      const rect = canvas.value?.getBoundingClientRect();
      activeStroke = {
        tool: tool.value,
        color: color.value,
        size: size.value,
        eraserWidth: tool.value === 'eraser' && rect?.width ? ERASER_SIZE / rect.width : undefined,
        eraserHeight: tool.value === 'eraser' && rect?.height ? ERASER_SIZE / rect.height : undefined,
        points: [],
      };
      strokes.value.push(activeStroke);
      appendPointer(event);
    }

    function pointerMove(event: PointerEvent) {
      trackEraserCursor(event);
      if (activePointer !== event.pointerId || !activeStroke) return;
      event.preventDefault();
      const coalesced = event.getCoalescedEvents?.();
      for (const sample of coalesced?.length ? coalesced : [event]) appendPointer(sample);
    }

    function finishStroke(event: PointerEvent) {
      if (activePointer !== event.pointerId) return;
      event.preventDefault();
      trackEraserCursor(event);
      appendPointer(event);
      if (activeStroke && !activeStroke.points.length) strokes.value.pop();
      activePointer = null;
      activeStroke = null;
      if (canvas.value?.hasPointerCapture(event.pointerId)) canvas.value.releasePointerCapture(event.pointerId);
      persist();
    }

    async function requestClearBoard(returnFocus: HTMLElement | null = frame.value) {
      if (!strokes.value.length) return;
      clearReturnFocus = returnFocus;
      clearConfirm.value = true;
      await nextTick();
      clearCancel.value?.focus();
    }

    async function cancelClearBoard() {
      clearConfirm.value = false;
      await nextTick();
      clearReturnFocus?.focus();
      clearReturnFocus = null;
    }

    async function clearBoard() {
      strokes.value = [];
      clearConfirm.value = false;
      redraw();
      persist();
      await nextTick();
      (clearReturnFocus ?? frame.value)?.focus();
      clearReturnFocus = null;
    }

    function dragStart(event: PointerEvent) {
      if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button, input, select'))) return;
      event.preventDefault();
      const target = event.currentTarget as HTMLElement;
      target.setPointerCapture(event.pointerId);

      snapZone.value = null;
      const startX = event.clientX;
      const startY = event.clientY;
      const initialX = x.value;
      const initialY = y.value;
      const shakeEligible = (event.pointerType === 'mouse' || event.pointerType === 'pen') && strokes.value.length > 0;
      let shakeStartedAt = performance.now();
      let shakeTravel = 0;
      let shakeReversals = 0;
      let lastDirection = 0;
      let lastClientX = event.clientX;
      let lastClientY = event.clientY;
      let shakeTriggered = false;

      const cleanup = () => {
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', end);
        target.removeEventListener('pointercancel', end);
        if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
      };

      const trackShake = (next: PointerEvent) => {
        if (!shakeEligible || shakeTriggered) return false;
        const now = performance.now();
        if (now - shakeStartedAt > SHAKE_WINDOW_MS) {
          shakeStartedAt = now;
          shakeTravel = 0;
          shakeReversals = 0;
          lastDirection = 0;
        }

        const dx = next.clientX - lastClientX;
        const dy = next.clientY - lastClientY;
        lastClientX = next.clientX;
        lastClientY = next.clientY;
        const dominant = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
        if (Math.abs(dominant) < SHAKE_STEP) return false;

        const direction = Math.sign(dominant);
        shakeTravel += Math.abs(dominant);
        if (lastDirection && direction !== lastDirection) shakeReversals += 1;
        lastDirection = direction;

        if (shakeReversals >= SHAKE_REVERSALS && shakeTravel >= SHAKE_TRAVEL) {
          shakeTriggered = true;
          return true;
        }
        return false;
      };

      const move = (next: PointerEvent) => {
        x.value = initialX + next.clientX - startX;
        y.value = initialY + next.clientY - startY;
        clampGeometry();
        snapPreview.value = detectSnap(next.clientX, next.clientY);

        if (trackShake(next)) {
          snapPreview.value = null;
          cleanup();
          persist();
          void requestClearBoard(frame.value);
        }
      };

      const end = (next: PointerEvent) => {
        cleanup();
        if (shakeTriggered) return;
        const zone = snapPreview.value ?? detectSnap(next.clientX, next.clientY);
        if (zone) applySnap(zone);
        else {
          snapPreview.value = null;
          clampGeometry();
        }
        persist();
      };

      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', end);
      target.addEventListener('pointercancel', end);
    }

    function resizeStart(event: PointerEvent) {
      event.preventDefault();
      snapZone.value = null;
      snapPreview.value = null;
      const target = event.currentTarget as HTMLElement;
      target.setPointerCapture(event.pointerId);
      const startX = event.clientX;
      const startY = event.clientY;
      const initialWidth = width.value;
      const initialHeight = height.value;
      const move = (next: PointerEvent) => {
        width.value = initialWidth + next.clientX - startX;
        height.value = initialHeight + next.clientY - startY;
        clampGeometry();
      };
      const end = () => {
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', end);
        target.removeEventListener('pointercancel', end);
        fitCanvas();
        persist();
      };
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', end);
      target.addEventListener('pointercancel', end);
    }

    async function open(source?: EventTarget | null) {
      if (props.disabled) return;
      trigger = source instanceof HTMLElement ? source : document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (snapZone.value) applySnap(snapZone.value);
      else clampGeometry();
      openState.value = true;
      await nextTick();
      fitCanvas();
      frame.value?.focus();
    }

    async function close() {
      if (!openState.value) return;
      clearConfirm.value = false;
      clearReturnFocus = null;
      snapPreview.value = null;
      eraserCursor.value = null;
      openState.value = false;
      persist();
      await nextTick();
      trigger?.focus();
    }

    function viewportResize() {
      if (snapZone.value) applySnap(snapZone.value);
      else clampGeometry();
      fitCanvas();
    }

    watch(() => props.disabled, (disabled) => { if (disabled) void close(); });
    watch(tool, (nextTool) => {
      if (nextTool !== 'eraser') eraserCursor.value = null;
    });

    onMounted(() => {
      if (snapZone.value) applySnap(snapZone.value);
      else clampGeometry();
      resizeObserver = new ResizeObserver(fitCanvas);
      if (surface.value) resizeObserver.observe(surface.value);
      window.addEventListener('resize', viewportResize);
    });
    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', viewportResize);
    });

    expose({ open, close });

    return () => h('section', {
      ref: frame,
      class: ['whiteboard-window', { 'is-snapped': Boolean(snapZone.value) }],
      hidden: !openState.value,
      tabindex: -1,
      style: { left: `${x.value}px`, top: `${y.value}px`, width: `${width.value}px`, height: `${height.value}px` },
      'aria-label': 'Whiteboard',
      onKeydown: (event: KeyboardEvent) => {
        if (clearConfirm.value && event.key === 'Tab') {
          const controls = [clearCancel.value, clearAccept.value].filter((control): control is HTMLButtonElement => Boolean(control));
          const currentIndex = controls.indexOf(document.activeElement as HTMLButtonElement);
          const nextIndex = event.shiftKey
            ? currentIndex <= 0 ? controls.length - 1 : currentIndex - 1
            : currentIndex < 0 || currentIndex >= controls.length - 1 ? 0 : currentIndex + 1;
          if (controls[nextIndex]) {
            event.preventDefault();
            controls[nextIndex].focus();
          }
          return;
        }
        if (event.key !== 'Escape') return;
        event.preventDefault();
        if (clearConfirm.value) void cancelClearBoard();
        else void close();
      },
    }, [
      snapPreview.value ? h('div', {
        class: 'whiteboard-snap-preview',
        style: snapPreviewStyle(),
        'aria-hidden': 'true',
      }) : null,
      h('header', { class: 'whiteboard-titlebar', inert: clearConfirm.value, onPointerdown: dragStart }, [
        h('div', { class: 'whiteboard-title' }, [
          h(Icon, { name: 'whiteboard' }),
          h('strong', 'Whiteboard'),
          h('span', { class: 'whiteboard-drag-handle', 'aria-hidden': 'true' }, '···'),
        ]),
        h('button', { type: 'button', class: 'whiteboard-close', 'aria-label': 'Close whiteboard', onClick: close }, 'Close'),
      ]),
      h('div', { class: 'whiteboard-toolbar', inert: clearConfirm.value }, [
        h('button', { type: 'button', class: ['whiteboard-tool-button', { 'is-active': tool.value === 'marker' }],
          'aria-pressed': tool.value === 'marker', onClick: () => { tool.value = 'marker'; persist(); } }, [
          h(Icon, { name: 'pencil' }),
          h('span', 'Marker'),
        ]),
        h('button', { type: 'button', class: ['whiteboard-tool-button', { 'is-active': tool.value === 'eraser' }],
          'aria-pressed': tool.value === 'eraser', onClick: () => { tool.value = 'eraser'; persist(); } }, [
          h(Icon, { name: 'eraser' }),
          h('span', 'Eraser'),
        ]),
        h('div', { class: 'whiteboard-colors', role: 'group', 'aria-label': 'Marker color' },
          COLORS.map((entry, index) => h('button', {
            type: 'button',
            class: ['whiteboard-color', { 'is-active': color.value === entry }],
            style: { '--marker-color': entry },
            title: ['Black', 'Blue', 'Red', 'Green'][index],
            'aria-label': `${['Black', 'Blue', 'Red', 'Green'][index]} marker`,
            'aria-pressed': color.value === entry,
            onClick: () => { color.value = entry; tool.value = 'marker'; persist(); },
          }))),
        h('label', { class: 'whiteboard-size' }, ['Size', h('select', {
          value: size.value,
          disabled: tool.value === 'eraser',
          onChange: (event: Event) => {
            const value = Number((event.target as HTMLSelectElement).value);
            if (SIZES.includes(value as (typeof SIZES)[number])) size.value = value;
            persist();
          },
        }, [
          h('option', { value: 2 }, 'Fine'),
          h('option', { value: 4 }, 'Medium'),
          h('option', { value: 7 }, 'Bold'),
        ])]),
        h('span', { class: 'whiteboard-input-hint' }, 'Mouse, touch, or pen'),
        h('button', {
          type: 'button',
          class: 'whiteboard-clear',
          disabled: !strokes.value.length,
          onClick: (event: MouseEvent) => requestClearBoard(event.currentTarget as HTMLElement),
        }, 'Clear board'),
      ]),
      h('div', { ref: surface, class: 'whiteboard-surface', inert: clearConfirm.value }, [
        h('canvas', {
          ref: canvas,
          class: ['whiteboard-canvas', { 'is-eraser': tool.value === 'eraser' }],
          'aria-label': 'Drawing surface',
          onPointerenter: trackEraserCursor,
          onPointerdown: pointerDown,
          onPointermove: pointerMove,
          onPointerup: finishStroke,
          onPointercancel: finishStroke,
          onPointerleave: () => { if (activePointer === null) eraserCursor.value = null; },
        }),
        tool.value === 'eraser' && eraserCursor.value ? h('span', {
          class: 'whiteboard-eraser-cursor',
          style: { left: `${eraserCursor.value.x}px`, top: `${eraserCursor.value.y}px` },
          'aria-hidden': 'true',
        }, [h(Icon, { name: 'eraser' })]) : null,
      ]),
      clearConfirm.value ? h('div', { class: 'whiteboard-confirm-layer' }, [
        h('section', {
          class: 'whiteboard-confirm-card',
          role: 'alertdialog',
          'aria-modal': 'true',
          'aria-labelledby': 'whiteboard-clear-title',
          'aria-describedby': 'whiteboard-clear-description',
          onPointerdown: (event: PointerEvent) => event.stopPropagation(),
        }, [
          h('div', { class: 'whiteboard-confirm-icon' }, [h(Icon, { name: 'eraser' })]),
          h('h2', { id: 'whiteboard-clear-title' }, 'Clear whiteboard?'),
          h('p', { id: 'whiteboard-clear-description' }, 'This removes every mark from the board and cannot be undone.'),
          h('div', { class: 'whiteboard-confirm-actions' }, [
            h('button', { ref: clearCancel, type: 'button', class: 'quiet-button', onClick: cancelClearBoard }, 'Cancel'),
            h('button', { ref: clearAccept, type: 'button', class: 'whiteboard-confirm-danger', onClick: clearBoard }, 'Clear board'),
          ]),
        ]),
      ]) : null,
      h('div', { class: 'whiteboard-resize-handle', inert: clearConfirm.value, role: 'separator', 'aria-label': 'Resize whiteboard', onPointerdown: resizeStart }),
    ]);
  },
});
