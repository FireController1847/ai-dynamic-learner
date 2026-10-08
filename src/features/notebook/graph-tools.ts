import { computed, defineComponent, h, nextTick, ref, type PropType } from 'vue';
import { createId } from '../../core/ids.ts';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import type { GraphTool } from './graph-interaction.ts';
import { GRAPH_COLORS, GRAPH_DIVISIONS, MAX_GRAPH_CENTER,
  type GraphAnnotations, type GraphColor, type GraphDivision, type GraphPoint, type GraphSelection } from './graph-model.ts';
import { measurementNumber, pointPosition, type GraphMeasurements, type GraphSegmentMeasurement } from './graph-measurements.ts';

export interface GraphToolsHandle { openOptions(): Promise<void> }
const ANNOTATION_LABELS: Record<keyof GraphAnnotations, string> = {
  names: 'Point names', coordinates: 'Point positions', lengths: 'Segment lengths', areas: 'Enclosed areas',
};

const TOOL_LABELS: Record<GraphTool, string> = {
  select: 'Select and move points', point: 'Add points', connect: 'Connect points', erase: 'Erase points or connections',
  pan: 'Pan graph', zoom: 'Zoom graph',
};
const TOOL_PATHS: Partial<Record<GraphTool, string>> = {
  select: 'M5 3v17l5-5 4 7 3-2-4-7h7Z',
  point: 'M15 7a5 5 0 1 1-10 0 5 5 0 1 1 10 0M17 13v8M13 17h8',
  connect: 'M7 17 17 7M7 17a3 3 0 1 1-6 0 3 3 0 1 1 6 0M23 7a3 3 0 1 1-6 0 3 3 0 1 1 6 0',
  pan: 'M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4',
};
export function graphToolHelp(tool: GraphTool): string {
  if (tool === 'select') return 'Drag points to move them. Right-click or long-press a point for options and measurements. Arrow keys nudge; Delete removes the selection.';
  if (tool === 'point') return 'Click or drag to place a point. Drag an existing point to move it.';
  if (tool === 'connect') return 'Click points in sequence, or drag between them. Empty space adds a point. Escape or Enter ends the chain.';
  if (tool === 'erase') return 'Click a point or connection to remove it. Undo restores your drawing.';
  if (tool === 'pan') return 'Drag to pan. Focus the paper and use arrow keys; Shift moves five squares.';
  return 'Click to magnify, right-click to zoom out. Scrub right to zoom in and left to zoom out. Units per square stay unchanged.';
}
function toolIcon(tool: GraphTool) {
  if (tool === 'zoom') return h(Icon, { name: 'search' });
  if (tool === 'erase') return h(Icon, { name: 'trash' });
  const attributes = { class: 'ui-icon', viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none',
    stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
  return tool === 'select' ? [
    h('svg', { ...attributes, class: 'ui-icon graph-select-arrow' }, [h('path', { d: TOOL_PATHS.select })]),
    h('svg', { ...attributes, class: 'ui-icon graph-select-circle' }, [h('circle', { cx: 12, cy: 12, r: 8 })]),
  ] : [h('svg', attributes, [h('path', { d: TOOL_PATHS[tool] })])];
}

export const GraphTools = defineComponent({
  name: 'NotebookGraphTools',
  props: {
    tool: { type: String as PropType<GraphTool>, required: true },
    color: { type: String as PropType<GraphColor>, required: true }, snap: Boolean, scrubby: Boolean,
    snapDivisions: { type: Number as PropType<GraphDivision>, required: true },
    subdivisions: { type: Number as PropType<GraphDivision>, required: true },
    annotations: { type: Object as PropType<GraphAnnotations>, required: true },
    measurements: { type: Object as PropType<GraphMeasurements>, required: true },
    point: { type: Object as PropType<GraphPoint | null>, default: null },
    line: { type: Object as PropType<GraphSegmentMeasurement | null>, default: null },
    selection: { type: Object as PropType<GraphSelection>, default: null },
    selectedColor: { type: String as PropType<GraphColor | null>, default: null },
  },
  emits: { tool: (_tool: GraphTool) => true, color: (_color: GraphColor) => true,
    snap: (_enabled: boolean) => true, scrubby: (_enabled: boolean) => true,
    snapDivisions: (_divisions: GraphDivision) => true, subdivisions: (_divisions: GraphDivision) => true,
    annotations: (_annotations: GraphAnnotations) => true,
    point: (_point: GraphPoint) => true, remove: () => true },
  setup(props, { emit, expose }) {
    const optionsOpen = ref(false);
    const optionsButton = ref<HTMLButtonElement | null>(null);
    const optionsPanel = ref<HTMLDivElement | null>(null);
    const panelId = `graph-tool-options-${createId()}`;
    async function closeOptions() { optionsOpen.value = false; await nextTick(); optionsButton.value?.focus(); }
    async function openOptions() {
      optionsOpen.value = true; await nextTick();
      optionsPanel.value?.querySelector<HTMLInputElement>(props.point ? '.graph-point-label input' : 'input')?.focus();
    }
    expose({ openOptions });
    const areas = computed(() => {
      const selected = props.selection;
      return props.measurements.areas.filter(area => !selected ||
        (selected.kind === 'point' ? area.pointIds : area.connectionIds).includes(selected.id));
    });
    function measurements() {
      const entries: [string, string][] = [];
      if (props.point) entries.push(['Position', pointPosition(props.point)],
        ['Distance to origin', `${measurementNumber(Math.hypot(props.point.x, props.point.y))} units`]);
      if (props.line) {
        const line = props.line;
        entries.push(['Endpoints', `${line.from.label || 'Point'} ${pointPosition(line.from)} → ${line.to.label || 'Point'} ${pointPosition(line.to)}`],
          ['Length', `${measurementNumber(line.length)} units`], ['Δx / Δy', `${measurementNumber(line.dx)} / ${measurementNumber(line.dy)}`],
          ['Slope', line.slope === null ? 'Undefined' : measurementNumber(line.slope)],
          ['Angle from x-axis', line.angle === null ? 'Undefined' : `${measurementNumber(line.angle)}°`],
          ['Midpoint', pointPosition(line.midpoint)]);
      }
      return h('section', { class: 'graph-measurements', 'aria-label': 'Drawing measurements' }, [
        h('strong', 'Measurements'),
        entries.length ? h('dl', entries.flatMap(([label, value]) => [h('dt', label), h('dd', value)])) : null,
        h('p', `Drawing length: ${measurementNumber(props.measurements.totalLength)} units`),
        props.point ? h('dl', props.measurements.segments.filter(line => line.from.id === props.point?.id || line.to.id === props.point?.id)
          .flatMap(line => {
            const other = line.from.id === props.point?.id ? line.to : line.from;
            return [h('dt', `To ${other.label || pointPosition(other)}`), h('dd', `${measurementNumber(line.length)} units`)];
          })) : null,
        ...areas.value.map(area => h('div', { class: 'graph-area-measurement', key: area.id }, [
          h('strong', `Region ${props.measurements.areas.indexOf(area) + 1}`), h('dl', [
            h('dt', 'Area'), h('dd', `${measurementNumber(area.area)} units²`),
            h('dt', 'Perimeter'), h('dd', `${measurementNumber(area.perimeter)} units`),
          ]),
        ])),
        !areas.value.length ? h('p', props.selection
          ? 'No closed region touches this selection. Area needs a closed outline with shared intersection points.'
          : 'Connect points into a closed outline to measure its area and perimeter.') : null,
      ]);
    }
    function coordinate(axis: 'x' | 'y') {
      const point = props.point;
      if (!point) return null;
      return h('label', { class: 'graph-point-coordinate' }, [h('span', axis), h('input', {
        type: 'number', step: 'any', min: -MAX_GRAPH_CENTER, max: MAX_GRAPH_CENTER, value: point[axis],
        onChange: (event: Event) => emit('point', { ...point, [axis]: Number(inputValue(event)) }),
      })]);
    }
    function pointOptions() {
      const point = props.point;
      if (!point) return null;
      return [
        h('label', { class: 'graph-point-label' }, ['Point label', h('input', { value: point.label, maxlength: 60,
          onChange: (event: Event) => { if (props.point) emit('point', { ...props.point, label: inputValue(event) }); } })]),
        h('div', { class: 'graph-point-coordinates' }, [coordinate('x'), coordinate('y')]),
        h('label', { class: 'graph-tool-precision' }, ['This point’s position label', h('select', {
          value: point.showCoordinates === undefined ? 'sheet' : point.showCoordinates ? 'show' : 'hide',
          onChange: (event: Event) => {
            if (!props.point) return;
            const value = inputValue(event), updated = { ...props.point };
            if (value === 'sheet') delete updated.showCoordinates;
            else if (value === 'show' || value === 'hide') updated.showCoordinates = value === 'show';
            else return;
            emit('point', updated);
          },
        }, [h('option', { value: 'sheet' }, 'Use sheet setting'), h('option', { value: 'show' }, 'Show'), h('option', { value: 'hide' }, 'Hide')])]),
      ];
    }
    return () => h('aside', { class: 'graph-tools', 'aria-label': 'Graph editing tools' }, [
      h('div', { class: 'graph-tool-rail', role: 'toolbar', 'aria-label': 'Graph tools', 'aria-orientation': 'vertical' }, [
        ...(['select', 'pan', 'zoom', 'point', 'connect', 'erase'] as const)
          .map(tool => h('button', { type: 'button', class: 'graph-tool-button', title: TOOL_LABELS[tool],
            'aria-label': TOOL_LABELS[tool], 'aria-pressed': props.tool === tool,
            onClick: () => emit('tool', tool) }, toolIcon(tool))),
        h('button', { ref: optionsButton, type: 'button', class: 'graph-tool-button graph-tool-options-toggle', title: 'Options and measurements',
          'aria-label': 'Options and measurements', 'aria-expanded': optionsOpen.value, 'aria-controls': panelId,
          onClick: () => { optionsOpen.value = !optionsOpen.value; } }, [h(Icon, { name: 'settings' })]),
      ]),
      optionsOpen.value ? h('div', { ref: optionsPanel, id: panelId, class: 'graph-tool-options', role: 'group', 'aria-label': 'Graph options and measurements',
        onKeydown: (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); void closeOptions(); } },
      }, [
        h('header', [h('strong', props.point ? 'Point options' : props.line ? 'Segment options' : 'Graph options'),
          h('button', { type: 'button', class: 'quiet-button', 'aria-label': 'Close graph options', onClick: () => void closeOptions() }, '×')]),
        h('label', { class: 'graph-tool-color' }, ['Ink', h('select', { value: props.selectedColor ?? props.color,
          onChange: (event: Event) => {
            const color = GRAPH_COLORS.find(color => color.id === inputValue(event));
            if (color) emit('color', color.id);
          } }, GRAPH_COLORS.map(color => h('option', { value: color.id }, color.label)))]),
        pointOptions(), measurements(),
        props.selection ? h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('remove') },
          props.selection.kind === 'point' ? 'Delete point' : 'Delete connection') : null,
        h('fieldset', { class: 'graph-annotation-options' }, [h('legend', 'Show on the graph'),
          ...(Object.keys(ANNOTATION_LABELS) as (keyof GraphAnnotations)[]).map(key =>
            h('label', { class: 'graph-tool-check' }, [h('input', { type: 'checkbox', checked: props.annotations[key],
              onChange: (event: Event) => {
                if (event.target instanceof HTMLInputElement) emit('annotations', { ...props.annotations, [key]: event.target.checked });
              } }), ANNOTATION_LABELS[key]])),
        ]),
        h('label', { class: 'graph-tool-check' }, [h('input', { type: 'checkbox', checked: props.scrubby,
          onChange: (event: Event) => { if (event.target instanceof HTMLInputElement) emit('scrubby', event.target.checked); } }), 'Scrubby zoom']),
        h('label', { class: 'graph-tool-check' }, [h('input', { type: 'checkbox', checked: props.snap,
          onChange: (event: Event) => { if (event.target instanceof HTMLInputElement) emit('snap', event.target.checked); } }), 'Snap to grid']),
        h('label', { class: 'graph-tool-precision' }, ['Snap spacing', h('select', {
          value: props.snapDivisions, disabled: !props.snap,
          onChange: (event: Event) => {
            const choice = GRAPH_DIVISIONS.find(choice => String(choice.value) === inputValue(event));
            if (choice) emit('snapDivisions', choice.value);
          },
        }, GRAPH_DIVISIONS.map(choice => h('option', { value: choice.value }, choice.label)))]),
        h('label', { class: 'graph-tool-precision' }, ['Grid subdivisions', h('select', {
          value: props.subdivisions,
          onChange: (event: Event) => {
            const choice = GRAPH_DIVISIONS.find(choice => String(choice.value) === inputValue(event));
            if (choice) emit('subdivisions', choice.value);
          },
        }, GRAPH_DIVISIONS.map(choice => h('option', { value: choice.value },
          choice.value === 1 ? 'None' : `${choice.value} per square`)))]),
        props.subdivisions > 1 ? h('p', 'Very fine subdivision lines appear as you zoom in. Snapping keeps the precision you choose.') : null,
        h('p', graphToolHelp(props.tool)),
      ]) : null,
    ]);
  },
});
