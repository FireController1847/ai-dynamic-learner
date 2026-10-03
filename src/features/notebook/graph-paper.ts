import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import { createId } from '../../core/ids.ts';
import type { GraphDisplay } from './display-options.ts';
import { useGraphInteraction, type GraphTool } from './graph-interaction.ts';
import { defaultGraphAnnotations, type GraphAnnotations, type GraphColor, type GraphDivision,
  type GraphSelection, type GraphView, type GraphVisual } from './graph-model.ts';
import type { GraphMeasurements } from './graph-measurements.ts';
import { graphScene, paperGeometry, pointOnPaper, type RenderPlot } from './graph-scene.ts';

export const GraphPaper = defineComponent({
  name: 'NotebookGraphPaper',
  props: {
    view: { type: Object as PropType<GraphView>, required: true },
    options: { type: Object as PropType<GraphDisplay>, required: true },
    plots: { type: Array as PropType<RenderPlot[]>, default: () => [] },
    visual: { type: Object as PropType<GraphVisual>, default: () => ({ points: [], connections: [] }) },
    annotations: { type: Object as PropType<GraphAnnotations>, default: defaultGraphAnnotations },
    measurements: { type: Object as PropType<GraphMeasurements>, default: undefined },
    tool: { type: String as PropType<GraphTool>, default: 'select' },
    color: { type: String as PropType<GraphColor>, default: 'blue' },
    snap: { type: Boolean, default: true },
    snapDivisions: { type: Number as PropType<GraphDivision>, default: 1 },
    subdivisions: { type: Number as PropType<GraphDivision>, default: 1 },
    scrubby: { type: Boolean, default: true },
    selection: { type: Object as PropType<GraphSelection>, default: null },
    title: { type: String, default: '' },
    preview: Boolean,
  },
  emits: {
    view: (_view: GraphView) => true, visual: (_visual: GraphVisual) => true,
    selection: (_selection: GraphSelection) => true, title: (_title: string) => true,
    coordinate: (_point: { x: number; y: number } | null) => true,
    message: (_message: string) => true, 'edit-start': () => true, 'edit-end': () => true, options: () => true,
  },
  setup(props, { emit }) {
    const paper = computed(() => paperGeometry(props.options));
    const svg = ref<SVGSVGElement | null>(null);
    const screenScale = ref(1);
    let resizeObserver: ResizeObserver | null = null;
    function measurePaper() {
      const width = svg.value?.getBoundingClientRect().width;
      if (width) screenScale.value = width / paper.value.width;
    }
    onMounted(() => {
      measurePaper();
      resizeObserver = new ResizeObserver(measurePaper);
      if (svg.value) resizeObserver.observe(svg.value);
      svg.value?.addEventListener('wheel', interaction.wheel, { passive: false });
      svg.value?.addEventListener('gesturestart', interaction.gestureStart, { passive: false });
      svg.value?.addEventListener('gesturechange', interaction.gestureChange, { passive: false });
      svg.value?.addEventListener('gestureend', interaction.gestureEnd);
    });
    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      svg.value?.removeEventListener('wheel', interaction.wheel);
      svg.value?.removeEventListener('gesturestart', interaction.gestureStart);
      svg.value?.removeEventListener('gesturechange', interaction.gestureChange);
      svg.value?.removeEventListener('gestureend', interaction.gestureEnd);
    });
    watch(() => paper.value.width, measurePaper);
    const marks = computed(() => graphScene(props.view, props.options, props.plots, {
      visual: props.visual, selection: props.selection, subdivisions: props.subdivisions,
      screenScale: screenScale.value, annotations: props.annotations, measurements: props.measurements,
    }));
    const descriptionId = `graph-description-${createId()}`;
    const clipId = `graph-preview-clip-${createId()}`;
    const interaction = useGraphInteraction({
      paper: () => paper.value, view: () => props.view, visual: () => props.visual,
      tool: () => props.tool, selection: () => props.selection,
      color: () => props.color, snap: () => props.snap, snapDivisions: () => props.snapDivisions,
      scrubby: () => props.scrubby, enabled: () => !props.preview,
      updateView: view => emit('view', view), updateVisual: visual => emit('visual', visual),
      select: selection => emit('selection', selection), coordinate: point => emit('coordinate', point),
      message: message => emit('message', message), beginEdit: () => emit('edit-start'), endEdit: () => emit('edit-end'),
      openOptions: () => emit('options'),
    });
    const connectionPreview = computed(() => {
      if (props.tool !== 'connect' || !interaction.hover.value) return null;
      const anchor = props.visual.points.find(point => point.id === interaction.connectionAnchor.value);
      if (!anchor) return null;
      const start = pointOnPaper(anchor, paper.value, props.view), end = interaction.hover.value;
      return h('path', { d: `M${start.x},${start.y}L${end.x},${end.y}`, fill: 'none',
        stroke: '#687f95', 'stroke-width': 2, 'stroke-dasharray': '6 4', 'clip-path': `url(#${clipId})` });
    });
    return () => h('div', { class: ['graph-paper-frame', { 'is-preview': props.preview }],
      style: { maxWidth: `${paper.value.width}px` } }, [
      h('article', { class: 'graph-paper', style: { aspectRatio: `${paper.value.width} / ${paper.value.height}` } }, [
        h('svg', {
          ref: svg,
          class: ['graph-paper-svg', `graph-tool-${props.tool}`, {
            'is-editable': !props.preview, 'is-dragging': interaction.dragging.value || interaction.navigating.value,
          }],
          viewBox: `0 0 ${paper.value.width} ${paper.value.height}`,
          role: props.preview ? 'img' : 'group', tabindex: props.preview ? undefined : 0,
          'aria-label': `Graph Paper, ${props.plots.length} visible plots, ${props.visual.points.length} drawn points`,
          'aria-describedby': descriptionId,
          onPointerdown: interaction.begin, onPointermove: interaction.move, onPointerup: interaction.end,
          onPointercancel: interaction.cancel, onLostpointercapture: interaction.lostCapture,
          onPointerleave: interaction.leave, onKeydown: interaction.keydown, onContextmenu: interaction.contextmenu,
        }, [
          h('desc', { id: descriptionId }, 'Use the tools on the right to select, add or connect points, pan, or zoom. Right-click a point or segment for options and measurements. Pinch to zoom, or use two fingers to pan. Arrow keys move a selected point or pan. Escape ends a connection chain.'),
          h('defs', [h('clipPath', { id: clipId }, [h('rect', { x: paper.value.left, y: paper.value.top,
            width: paper.value.plotWidth, height: paper.value.plotHeight })])]),
          ...marks.value.map((mark, index) => h(mark.tag, { key: index, ...mark.attributes,
            ...(mark.tag === 'circle' || mark.attributes['data-graph-annotation'] ? { 'clip-path': `url(#${clipId})` } : {}),
          }, mark.text)),
          connectionPreview.value,
          !props.preview ? h('rect', { class: 'graph-gesture-surface', x: paper.value.left, y: paper.value.top,
            width: paper.value.plotWidth, height: paper.value.plotHeight, fill: 'transparent',
            'pointer-events': 'all', 'aria-hidden': 'true' }) : null,
        ]),
        h('input', { class: 'graph-paper-title', value: props.title, placeholder: 'Give this page a title',
          maxlength: 120, readonly: props.preview, tabindex: props.preview ? -1 : undefined,
          'aria-label': 'Graph Paper page title',
          style: { left: `${100 * paper.value.left / paper.value.width}%`,
            width: `${100 * paper.value.plotWidth / paper.value.width}%` },
          onInput: (event: Event) => { if (event.target instanceof HTMLInputElement) emit('title', event.target.value); },
        }),
      ]),
    ]);
  },
});
