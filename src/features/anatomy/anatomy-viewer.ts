import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType, type VNode } from 'vue';
import type { AtlasLayer, AtlasShape, AtlasStructure, AtlasView } from './atlas-model.ts';
import type { AnatomyRegion } from './anatomy-regions.ts';
import { Icon } from '../../components/icon.ts';
import type { IdentificationPage } from './anatomy-identification.ts';
import { AnatomyIdentificationOverlay } from './anatomy-identification-overlay.ts';

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
    ghostLayerIds: { type: Array as PropType<readonly string[]>, default: () => [] },
    showPlaceholder: { type: Boolean, default: true },
    identificationPage: { type: Object as PropType<IdentificationPage | null>, default: null },
    identificationAnswers: { type: Object as PropType<Readonly<Record<string, string>>>, default: () => ({}) },
    identificationCheckedIds: { type: Array as PropType<readonly string[]>, default: () => [] },
    identificationSkippedIds: { type: Array as PropType<readonly string[]>, default: () => [] },
    identificationActive: { type: Boolean, default: false },
  },
  emits: {
    select: (_structureId: string) => true,
    clearSelection: () => true,
    identificationAnswer: (_id: string, _answer: string) => true,
    identificationCheck: () => true,
  },
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
    const centralIds = computed(() => new Set(props.structures.filter(item =>
      item.classification === 'Central nervous system').map(item => item.id)));
    const classifications = computed(() =>
      new Map(props.structures.map(item => [item.id, item.classification])));
    const ghostLayers = computed(() => new Set(props.ghostLayerIds));
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

    // Keep the artwork on-screen without constraining legitimate zoom-in
    // inspection. Prior unrestricted wheel/drag offsets could leave only
    // blank canvas visible, even at the default whole-body Fit zoom.
    function boundedPan(x: number, y: number, atZoom = zoom.value) {
      const visibleWidth = area.value.width / atZoom;
      const visibleHeight = area.value.height / atZoom;
      const horizontalLimit = Math.max(0, (area.value.width - visibleWidth) / 2)
        + Math.min(area.value.width, visibleWidth) * 0.12;
      const verticalLimit = Math.max(0, (area.value.height - visibleHeight) / 2)
        + Math.min(area.value.height, visibleHeight) * 0.12;
      panX.value = Math.max(-horizontalLimit, Math.min(horizontalLimit, x));
      panY.value = Math.max(-verticalLimit, Math.min(verticalLimit, y));
    }

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
      const nextX = worldX - area.value.x - (area.value.width - scene.vw) / 2
        - (px - scene.padX) / scene.scale;
      const nextY = worldY - area.value.y - (area.value.height - scene.vh) / 2
        - (py - scene.padY) / scene.scale;
      zoom.value = next;
      boundedPan(nextX, nextY, next);
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
        boundedPan(drag.panX - dx / scene.scale, drag.panY - dy / scene.scale, drag.zoom);
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
      // Only the *actual drawing* owns wheel input. Scrollable overlays,
      // result popups, text fields and the floating inspector live alongside
      // the SVG and must receive native scrolling before the camera does.
      if (!svg.value || !(event.target instanceof Element)
        || !svg.value.contains(event.target)) return;
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
        boundedPan(
          panX.value + (event.deltaX + (event.shiftKey ? event.deltaY : 0)) * multiplier / scene.scale,
          panY.value + (event.shiftKey ? 0 : event.deltaY) * multiplier / scene.scale,
        );
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
      // The assessment must never leak bone names in accessible SVG labels,
      // tooltips, keyboard selection, or the standard detail inspector.
      const interaction = props.identificationActive
        ? {
          'data-anatomy-structure-id': shape.structureId,
          'aria-hidden': 'true',
          role: 'presentation',
        }
        : {
          'data-anatomy-structure-id': shape.structureId,
          role: 'button',
          tabindex: tabbable ? 0 : -1,
          'aria-label': 'Select ' + (structureNames.value.get(shape.structureId) ?? shape.structureId),
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
      const selected = !props.identificationActive && props.selectedId === shape.structureId;
      const quizTarget = props.identificationPage?.items.some(item => item.id === shape.structureId) ?? false;
      const quizMuted = props.identificationActive && !quizTarget;
      const behind = occluded.value.has(shape.structureId) || ghostLayers.value.has(shape.layerId);
      const central = props.view.systemId === 'nervous' && centralIds.value.has(shape.structureId);
      const gland = props.view.systemId === 'endocrine';
      const adrenal = gland && shape.structureId.includes('adrenal-');
      const medulla = gland && shape.structureId.endsWith('adrenal-medulla');
      const parathyroid = gland && shape.structureId.includes('parathyroid-');
      const neural = gland && /hypothalamus|pituitary|pineal/.test(shape.structureId);
      const pancreatic = gland && shape.structureId.endsWith('pancreatic-islets');
      const gonadal = gland && /\.(ovary|testis)$/.test(shape.structureId);
      const circulation = props.view.systemId === 'cardiovascular';
      const family = circulation ? (classifications.value.get(shape.structureId) ?? '') : '';
      // Vessels are colored by oxygenation, not simply artery vs vein:
      // pulmonary arteries are oxygen-poor and pulmonary veins oxygen-rich.
      const oxygenRich = circulation && (family === 'Systemic artery'
        || family === 'Coronary artery' || family === 'Pulmonary vein'
        || family === 'Heart chamber' && /\.left-(atrium|ventricle)$/.test(shape.structureId));
      const oxygenPoor = circulation && (family === 'Systemic vein'
        || family === 'Coronary vein' || family === 'Pulmonary artery'
        || family === 'Heart chamber' && /\.right-(atrium|ventricle)$/.test(shape.structureId));
      const subtypes = { 'is-adrenal': adrenal, 'is-medulla': medulla,
        'is-parathyroid': parathyroid, 'is-neuroendocrine': neural,
        'is-pancreatic': pancreatic, 'is-gonadal': gonadal,
        'is-oxygen-rich': oxygenRich, 'is-oxygen-poor': oxygenPoor,
        'is-heart-chamber': circulation && family === 'Heart chamber' };
      if (shape.renderMode === 'stroke' && shape.geometry.kind === 'path') {
        // Separate touch hit target from the thin visual line.
        return h('g', { ...interaction, key: shape.id, transform,
          class: ['anatomy-stroke-group', { 'is-central': central }] }, [
          h('path', { d: shape.geometry.d, class: ['anatomy-shape', 'is-stroke', { 'is-selected': selected,
            'is-occluded': behind, 'is-central': central,
            'is-identification-target': quizTarget && props.identificationActive,
            'is-identification-muted': quizMuted, ...subtypes }] }),
          h('path', { d: shape.geometry.d, class: 'anatomy-stroke-hit', 'aria-hidden': 'true' }),
        ]);
      }
      return h(geometry.tag, {
        ...geometry.attrs, ...interaction, key: shape.id, transform,
        class: ['anatomy-shape', { 'is-selected': selected, 'is-occluded': behind,
          'is-central': central,
          'is-identification-target': quizTarget && props.identificationActive,
          'is-identification-muted': quizMuted, ...subtypes }],
      });
    }

    function bodySilhouette(): VNode {
      // Neutral orientation guide behind the separately selectable muscles.
      // Not anatomical structure data: no invisible bones/extra muscles.
      const leftArm = 'M106 144 Q98 144 94 164 L85 235 L66 317 '
        + 'Q62 323 69 327 L82 324 L104 249 L119 177 Z';
      const leftLeg = 'M122 317 Q113 329 114 346 L116 446 '
        + 'Q113 462 113 481 L108 595 Q102 610 107 624 '
        + 'L102 650 Q102 662 117 666 L136 666 '
        + 'L136 655 L126 605 L139 471 L146 348 Z';
      return h('g', { class: 'anatomy-body-silhouette', 'aria-hidden': 'true',
        'pointer-events': 'none' }, [
        h('ellipse', { cx: 160, cy: 61, rx: 32, ry: 43 }),
        h('path', { d: 'M145 102 L141 118 Q119 122 110 142 '
          + 'L120 215 L114 275 L105 314 Q126 335 160 338 '
          + 'Q194 335 215 314 L206 275 L200 215 L210 142 '
          + 'Q201 122 179 118 L175 102 Z' }),
        h('path', { d: leftArm }),
        h('path', { d: leftArm, transform: 'translate(320 0) scale(-1 1)' }),
        h('path', { d: leftLeg }),
        h('path', { d: leftLeg, transform: 'translate(320 0) scale(-1 1)' }),
      ]);
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
      return h('div', { class: ['anatomy-viewer', {
        'is-skeletal': props.view.systemId === 'skeletal',
        'is-muscular': props.view.systemId === 'muscular',
        'is-nervous': props.view.systemId === 'nervous',
        'is-endocrine': props.view.systemId === 'endocrine',
        'is-cardiovascular': props.view.systemId === 'cardiovascular',
        'is-identifying': props.identificationActive,
      }] }, [
      h('div', { class: 'anatomy-viewer-controls' }, [
        ...(slots.toolbar?.() ?? []),
        h('div', { class: 'anatomy-viewer-zoom', role: 'group', 'aria-label': 'Diagram zoom and practice' }, [
          ...(slots.zoomAction?.() ?? []),
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
      h('div', { class: 'anatomy-diagram-stage' }, [
        h('svg', {
          ref: svg,
          onWheel: wheel,
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
          // A gentle non-interactive human silhouette grounds the skeleton
          // visually without changing any bone IDs or hit targets.
          ...(['skeletal', 'muscular', 'nervous', 'endocrine', 'cardiovascular']
            .includes(props.view.systemId) ? [bodySilhouette()] : []),
          ...(props.shapes.length || !props.showPlaceholder ? [] : [placeholder()]),
          ...orderedShapes.value.map(shape => {
            const tabbable = !tabStops.has(shape.structureId);
            if (shape.renderMode !== 'etch' && shape.renderMode !== 'cutout') tabStops.add(shape.structureId);
            return shapeNode(shape, tabbable);
          }),
        ]),
        props.identificationPage
          ? h(AnatomyIdentificationOverlay, {
            page: props.identificationPage,
            answers: props.identificationAnswers,
            checkedIds: props.identificationCheckedIds,
            skippedIds: props.identificationSkippedIds,
            cameraKey: viewport.value.join(' '),
            onAnswer: (id: string, answer: string) => emit('identificationAnswer', id, answer),
            onCheck: () => emit('identificationCheck'),
          }) : null,
        ...(!props.identificationPage ? (slots.identificationResult?.() ?? []) : []),
        ...(slots.identificationMenu?.() ?? []),
        !props.shapes.length && !props.showPlaceholder
          ? h('p', { class: 'anatomy-no-visible-bones', role: 'status' },
            props.view.systemId === 'muscular'
              ? 'No illustrated muscles in this region and view.'
              : props.view.systemId === 'nervous'
                ? 'No neural structures illustrated in this region and view.'
                : props.view.systemId === 'endocrine'
                  ? 'No endocrine glands shown here. Try Both or another gonad setting.'
                  : props.view.systemId === 'cardiovascular'
                    ? 'No major vessels illustrated here. Try Both or All vessels.'
                    : 'No bones visible from this direction in this region. Choose Both for deeper structures.')
          : null,
        !props.identificationActive && props.selectedStructure ? h('section', {
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
      ...(slots.footer?.() ?? []),
    ]);
    };
  },
});
