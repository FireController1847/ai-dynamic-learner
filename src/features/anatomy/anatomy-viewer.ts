import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType, type VNode } from 'vue';
import type { AtlasLayer, AtlasShape, AtlasStructure, AtlasView } from './atlas-model.ts';
import type { AnatomyRegion } from './anatomy-regions.ts';
import { Icon } from '../../components/icon.ts';

// 100% is a normal zoom level, not the minimum. Fit adds comfortable
// breathing room while keeping the whole figure in view.
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;
const FIT_ZOOM = 0.91;

export const AnatomyViewer = defineComponent({
  name: 'AnatomyViewer',
  props: {
    view: { type: Object as PropType<AtlasView>, required: true },
    focus: { type: Object as PropType<AnatomyRegion>, default: undefined },
    layers: { type: Array as PropType<readonly AtlasLayer[]>, required: true },
    shapes: { type: Array as PropType<readonly AtlasShape[]>, required: true },
    structures: { type: Array as PropType<readonly AtlasStructure[]>, required: true },
    selectedId: { type: String, default: '' },
    selectedStructure: { type: Object as PropType<AtlasStructure | null>, default: null },
    occludedIds: { type: Array as PropType<readonly string[]>, default: () => [] },
    showPlaceholder: { type: Boolean, default: true },
  },
  emits: { select: (_structureId: string) => true, clearSelection: () => true },
  setup(props, { emit, slots }) {
    const zoom = ref(FIT_ZOOM);
    const panX = ref(0);
    const panY = ref(0);
    const svg = ref<SVGSVGElement | null>(null);
    const zHeld = ref(false);
    let suppressClick = false;
    interface Drag {
      id: number; kind: 'pan' | 'scrub'; clientX: number; clientY: number;
      zoom: number; panX: number; panY: number; moved: boolean;
      anchorX: number; anchorY: number; stageX: number; stageY: number;
    }
    let drag: Drag | null = null;
    function keyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'z') {
        zHeld.value = true;
      }
    }
    function keyUp(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'z') zHeld.value = false;
    }
    onMounted(() => {
      window.addEventListener('keydown', keyDown);
      window.addEventListener('keyup', keyUp);
      window.addEventListener('blur', clearKey);
    });
    function clearKey() { zHeld.value = false; drag = null; }
    onBeforeUnmount(() => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', clearKey);
    });
    const structureNames = computed(() => new Map(props.structures.map(item => [item.id, item.name])));
    const occluded = computed(() => new Set(props.occludedIds));
    const orderedShapes = computed(() => {
      const order = new Map(props.layers.map((layer, index) => [layer.id, index]));
      return [...props.shapes].sort((a, b) => (order.get(a.layerId) ?? 0) - (order.get(b.layerId) ?? 0));
    });
    const area = computed(() => props.focus ?? {
      x: 0, y: 0, width: props.view.width, height: props.view.height,
    });
    const viewport = computed(() => {
      const width = area.value.width / zoom.value;
      const height = area.value.height / zoom.value;
      return [area.value.x + (area.value.width - width) / 2 + panX.value,
        area.value.y + (area.value.height - height) / 2 + panY.value,
        width, height];
    });
    function reset() { zoom.value = FIT_ZOOM; panX.value = 0; panY.value = 0; drag = null; }
    watch(() => props.view.id, reset);
    function sizeFor(value: number) {
      const vw = area.value.width / value, vh = area.value.height / value;
      const box = svg.value?.getBoundingClientRect();
      if (!box || !box.width || !box.height) return null;
      const scale = Math.min(box.width / vw, box.height / vh);
      return { box, vw, vh, scale,
        padX: (box.width - vw * scale) / 2,
        padY: (box.height - vh * scale) / 2 };
    }
    function worldAt(value: number, px: number, py: number, x: number, y: number) {
      const scene = sizeFor(value);
      if (!scene) return { x: area.value.x + area.value.width / 2,
        y: area.value.y + area.value.height / 2 };
      return {
        x: area.value.x + (area.value.width - scene.vw) / 2 + x
          + (px - scene.padX) / scene.scale,
        y: area.value.y + (area.value.height - scene.vh) / 2 + y
          + (py - scene.padY) / scene.scale,
      };
    }
    function zoomAt(value: number, worldX: number, worldY: number, px: number, py: number) {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
      const scene = sizeFor(next);
      if (!scene) { zoom.value = next; return; }
      panX.value = worldX - area.value.x - (area.value.width - scene.vw) / 2
        - (px - scene.padX) / scene.scale;
      panY.value = worldY - area.value.y - (area.value.height - scene.vh) / 2
        - (py - scene.padY) / scene.scale;
      zoom.value = next;
    }
    function setZoom(value: number) {
      const previous = sizeFor(zoom.value);
      if (!previous) { zoom.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)); return; }
      const px = previous.box.width / 2, py = previous.box.height / 2;
      const anchor = worldAt(zoom.value, px, py, panX.value, panY.value);
      zoomAt(value, anchor.x, anchor.y, px, py);
    }
    function pointerDown(event: PointerEvent) {
      if (event.button !== 0 || !svg.value || drag) return;
      suppressClick = false;
      const box = svg.value.getBoundingClientRect();
      const px = event.clientX - box.left, py = event.clientY - box.top;
      const world = worldAt(zoom.value, px, py, panX.value, panY.value);
      drag = {
        id: event.pointerId, kind: zHeld.value ? 'scrub' : 'pan',
        clientX: event.clientX, clientY: event.clientY,
        zoom: zoom.value, panX: panX.value, panY: panY.value, moved: false,
        anchorX: world.x, anchorY: world.y, stageX: px, stageY: py,
      };
      if (drag.kind === 'scrub') svg.value.setPointerCapture(event.pointerId);
    }
    function pointerMove(event: PointerEvent) {
      if (!drag || drag.id !== event.pointerId || !svg.value) return;
      const dx = event.clientX - drag.clientX, dy = event.clientY - drag.clientY;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      suppressClick = true;
      if (!svg.value.hasPointerCapture(event.pointerId)) svg.value.setPointerCapture(event.pointerId);
      if (drag.kind === 'scrub') {
        // Match Graph Paper's exponential scrub-zoom along the horizontal axis.
        zoomAt(drag.zoom * Math.exp(dx / 240), drag.anchorX, drag.anchorY,
          drag.stageX, drag.stageY);
      } else {
        const scene = sizeFor(drag.zoom);
        if (!scene) return;
        panX.value = drag.panX - dx / scene.scale;
        panY.value = drag.panY - dy / scene.scale;
      }
    }
    function pointerEnd(event: PointerEvent) {
      if (!drag || drag.id !== event.pointerId) return;
      const current = drag;
      if (event.type === 'pointerup' && current.kind === 'scrub' && !current.moved) {
        zoomAt(current.zoom * 1.3, current.anchorX, current.anchorY,
          current.stageX, current.stageY);
        suppressClick = true;
      }
      if (svg.value?.hasPointerCapture(event.pointerId)) svg.value.releasePointerCapture(event.pointerId);
      drag = null;
    }
    function wheel(event: WheelEvent) {
      if (!svg.value || event.target instanceof Element
        && event.target.closest('.anatomy-selected-inspector')) return;
      // Wheel scrolls through the scene, as a native page scroll would.
      // Ctrl+wheel zooms about the cursor and Shift+wheel pans horizontally.
      event.preventDefault();
      const scene = sizeFor(zoom.value);
      if (!scene) return;
      const multiplier = event.deltaMode === 1 ? 16
        : event.deltaMode === 2 ? scene.box.height : 1;
      if (event.ctrlKey) {
        const box = scene.box;
        const px = event.clientX - box.left, py = event.clientY - box.top;
        const world = worldAt(zoom.value, px, py, panX.value, panY.value);
        zoomAt(zoom.value * Math.exp(-event.deltaY * multiplier / 240),
          world.x, world.y, px, py);
      } else {
        panX.value += (event.deltaX + (event.shiftKey ? event.deltaY : 0)) * multiplier / scene.scale;
        panY.value += (event.shiftKey ? 0 : event.deltaY) * multiplier / scene.scale;
      }
    }
    function shapeNode(shape: AtlasShape, tabbable: boolean): VNode {
      const transform = shape.mirrorX ? 'translate(' + props.view.width + ' 0) scale(-1 1)' : undefined;
      const geometry = shape.geometry.kind === 'path'
        ? { tag: 'path', attrs: { d: shape.geometry.d } }
        : { tag: 'ellipse', attrs: {
          cx: shape.geometry.cx, cy: shape.geometry.cy, rx: shape.geometry.rx, ry: shape.geometry.ry,
        } };
      if (shape.renderMode === 'etch' || shape.renderMode === 'cutout') {
        return h(geometry.tag, {
          ...geometry.attrs,
          key: shape.id, transform,
          class: shape.renderMode === 'etch' ? 'anatomy-bone-etch' : 'anatomy-bone-cutout',
          'aria-hidden': 'true', 'pointer-events': 'none',
        });
      }
      const name = structureNames.value.get(shape.structureId) ?? shape.structureId;
      const interaction = {
        role: 'button',
        tabindex: tabbable ? 0 : -1,
        'aria-label': 'Select ' + name,
        'aria-pressed': props.selectedId === shape.structureId,
        onClick: () => {
          if (!suppressClick && !zHeld.value) emit('select', shape.structureId);
        },
        onKeydown: (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            emit('select', shape.structureId);
          }
        },
      };
      const selected = props.selectedId === shape.structureId;
      if (shape.renderMode === 'stroke' && shape.geometry.kind === 'path') {
        // Separate touch hit target from the thin visual line.
        return h('g', { ...interaction, key: shape.id, transform, class: 'anatomy-stroke-group' }, [
          h('path', { d: shape.geometry.d, class: ['anatomy-shape', 'is-stroke', { 'is-selected': selected, 'is-occluded': occluded.value.has(shape.structureId) }] }),
          h('path', { d: shape.geometry.d, class: 'anatomy-stroke-hit', 'aria-hidden': 'true' }),
        ]);
      }
      return h(geometry.tag, {
        ...geometry.attrs, ...interaction, key: shape.id, transform,
        class: ['anatomy-shape', { 'is-selected': selected, 'is-occluded': occluded.value.has(shape.structureId) }],
      });
    }

    function placeholder(): VNode {
      // A neutral orientation guide, not an anatomical illustration or data.
      return h('g', { class: 'anatomy-guide-figure', 'aria-hidden': 'true' }, [
        h('ellipse', { cx: 160, cy: 58, rx: 29, ry: 38 }),
        h('path', { d: 'M133 96 Q112 100 104 121 L78 208 L59 256 Q53 270 64 275 Q73 280 79 267 L111 204 L126 159 L129 270 L111 380 L107 506 Q108 527 123 528 Q139 528 140 509 L155 390 L160 302 L165 390 L180 509 Q181 528 196 528 Q212 527 213 506 L209 380 L191 270 L194 159 L209 204 L241 267 Q247 280 256 275 Q267 270 261 256 L242 208 L216 121 Q208 100 187 96 Z' }),
        h('path', { d: 'M145 96 L175 96 M160 96 V274', fill: 'none' }),
      ]);
    }

    return () => {
      const tabStops = new Set<string>();
      return h('div', { class: 'anatomy-viewer' }, [
      h('div', { class: 'anatomy-viewer-controls' }, [
        ...(slots.toolbar?.() ?? []),
        h('div', { class: 'anatomy-viewer-zoom', role: 'group', 'aria-label': 'Diagram zoom' }, [
          h('button', { class: 'icon-button', type: 'button', title: 'Zoom out', 'aria-label': 'Zoom out',
            disabled: zoom.value <= MIN_ZOOM, onClick: () => setZoom(zoom.value / 1.3) }, [h(Icon, { name: 'minus' })]),
          h('span', { class: 'anatomy-zoom-value', 'aria-live': 'off' }, Math.round(zoom.value * 100) + '%'),
          h('button', { class: 'icon-button', type: 'button', title: 'Zoom in', 'aria-label': 'Zoom in',
            disabled: zoom.value >= MAX_ZOOM, onClick: () => setZoom(zoom.value * 1.3) }, [h(Icon, { name: 'plus' })]),
          h('button', { class: 'quiet-button', type: 'button',
            title: 'Fit whole figure',
            disabled: zoom.value === FIT_ZOOM && panX.value === 0 && panY.value === 0,
            onClick: reset }, 'Fit'),
        ]),
      ]),
      h('div', { class: 'anatomy-diagram-stage', onWheel: wheel }, [
        h('svg', {
          ref: svg,
          class: ['anatomy-diagram', { 'is-scrubbing': zHeld.value, 'is-dragging': drag?.moved }],
          viewBox: viewport.value.join(' '),
          preserveAspectRatio: 'xMidYMid meet',
          role: 'group',
          'aria-label': props.view.name + ' interactive diagram',
          onPointerdown: pointerDown,
          onPointermove: pointerMove,
          onPointerup: pointerEnd,
          onPointercancel: pointerEnd,
          onLostpointercapture: () => { drag = null; },
        }, [
          ...(props.shapes.length || !props.showPlaceholder ? [] : [placeholder()]),
          ...orderedShapes.value.map(shape => {
            const tabbable = !tabStops.has(shape.structureId);
            if (shape.renderMode !== 'etch' && shape.renderMode !== 'cutout') tabStops.add(shape.structureId);
            return shapeNode(shape, tabbable);
          }),
        ]),
        !props.shapes.length && !props.showPlaceholder
          ? h('p', { class: 'anatomy-no-visible-bones', role: 'status' },
            'No bones visible from this direction in this region. Choose Both for deeper structures.')
          : null,
        props.selectedStructure ? h('section', {
          key: props.selectedStructure.id,
          class: 'anatomy-selected-inspector',
          role: 'region',
          'aria-label': 'Selected anatomical structure',
          'aria-live': 'polite',
        }, [
          h('button', {
            type: 'button',
            class: 'icon-button anatomy-inspector-dismiss',
            title: 'Clear selected structure',
            'aria-label': 'Clear selected structure',
            onClick: () => emit('clearSelection'),
          }, [h(Icon, { name: 'x' })]),
          h('div', { class: 'anatomy-selected-copy' }, [
            h('strong', { class: 'anatomy-selected-name' }, props.selectedStructure.name),
            h('span', { class: 'anatomy-selected-type' }, props.selectedStructure.classification),
            props.selectedStructure.description
              ? h('p', props.selectedStructure.description)
              : null,
          ]),
        ]) : null,
      ]),
    ]);
    };
  },
});
