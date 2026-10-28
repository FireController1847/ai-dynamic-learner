import { computed, defineComponent, h, ref, watch, type PropType, type VNode } from 'vue';
import type { AtlasLayer, AtlasShape, AtlasStructure, AtlasView } from './atlas-model.ts';
import { Icon } from '../../components/icon.ts';

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

export const AnatomyViewer = defineComponent({
  name: 'AnatomyViewer',
  props: {
    view: { type: Object as PropType<AtlasView>, required: true },
    layers: { type: Array as PropType<readonly AtlasLayer[]>, required: true },
    shapes: { type: Array as PropType<readonly AtlasShape[]>, required: true },
    structures: { type: Array as PropType<readonly AtlasStructure[]>, required: true },
    selectedId: { type: String, default: '' },
    selectedStructure: { type: Object as PropType<AtlasStructure | null>, default: null },
  },
  emits: { select: (_structureId: string) => true, clearSelection: () => true },
  setup(props, { emit }) {
    const zoom = ref(1);
    const panX = ref(0);
    const panY = ref(0);
    const svg = ref<SVGSVGElement | null>(null);
    let drag: { pointerId: number; x: number; y: number } | null = null;
    const structureNames = computed(() => new Map(props.structures.map(item => [item.id, item.name])));
    const orderedShapes = computed(() => {
      const order = new Map(props.layers.map((layer, index) => [layer.id, index]));
      return [...props.shapes].sort((a, b) => (order.get(a.layerId) ?? 0) - (order.get(b.layerId) ?? 0));
    });
    const viewport = computed(() => {
      const width = props.view.width / zoom.value;
      const height = props.view.height / zoom.value;
      return [
        (props.view.width - width) / 2 + panX.value,
        (props.view.height - height) / 2 + panY.value,
        width, height,
      ];
    });

    function reset() { zoom.value = 1; panX.value = 0; panY.value = 0; drag = null; }
    watch(() => props.view.id, reset);
    function setZoom(value: number) {
      zoom.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
      if (zoom.value === 1) { panX.value = 0; panY.value = 0; }
    }
    function pointerDown(event: PointerEvent) {
      if (event.button !== 0 || !svg.value || zoom.value <= 1) return;
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      svg.value.setPointerCapture(event.pointerId);
    }
    function pointerMove(event: PointerEvent) {
      if (!drag || drag.pointerId !== event.pointerId || !svg.value) return;
      const bounds = svg.value.getBoundingClientRect();
      const scale = Math.min(bounds.width / viewport.value[2], bounds.height / viewport.value[3]);
      if (scale > 0) {
        panX.value -= (event.clientX - drag.x) / scale;
        panY.value -= (event.clientY - drag.y) / scale;
      }
      drag.x = event.clientX;
      drag.y = event.clientY;
    }
    function pointerEnd(event: PointerEvent) {
      if (drag?.pointerId !== event.pointerId) return;
      drag = null;
      if (svg.value?.hasPointerCapture(event.pointerId)) svg.value.releasePointerCapture(event.pointerId);
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
        onPointerdown: (event: PointerEvent) => event.stopPropagation(),
        onClick: () => emit('select', shape.structureId),
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
          h('path', { d: shape.geometry.d, class: ['anatomy-shape', 'is-stroke', { 'is-selected': selected }] }),
          h('path', { d: shape.geometry.d, class: 'anatomy-stroke-hit', 'aria-hidden': 'true' }),
        ]);
      }
      return h(geometry.tag, {
        ...geometry.attrs, ...interaction, key: shape.id, transform,
        class: ['anatomy-shape', { 'is-selected': selected }],
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
      h('div', { class: 'anatomy-viewer-controls', 'aria-label': 'Diagram zoom' }, [
        h('button', { class: 'icon-button', type: 'button', title: 'Zoom out', 'aria-label': 'Zoom out',
          disabled: zoom.value <= MIN_ZOOM, onClick: () => setZoom(zoom.value / 1.4) }, [h(Icon, { name: 'minus' })]),
        h('span', { class: 'anatomy-zoom-value', 'aria-live': 'off' }, Math.round(zoom.value * 100) + '%'),
        h('button', { class: 'icon-button', type: 'button', title: 'Zoom in', 'aria-label': 'Zoom in',
          disabled: zoom.value >= MAX_ZOOM, onClick: () => setZoom(zoom.value * 1.4) }, [h(Icon, { name: 'plus' })]),
        h('button', { class: 'quiet-button', type: 'button', disabled: zoom.value === 1,
          onClick: reset }, 'Fit'),
      ]),
      h('div', { class: 'anatomy-diagram-stage' }, [
        h('svg', {
          ref: svg,
          class: 'anatomy-diagram',
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
          ...(props.shapes.length ? [] : [placeholder()]),
          ...orderedShapes.value.map(shape => {
            const tabbable = !tabStops.has(shape.structureId);
            if (shape.renderMode !== 'etch' && shape.renderMode !== 'cutout') tabStops.add(shape.structureId);
            return shapeNode(shape, tabbable);
          }),
        ]),
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
