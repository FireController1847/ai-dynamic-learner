import { computed, defineComponent, h, nextTick, ref, watch, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import type { NotebookDocument } from './document-types.ts';
import type { GraphDisplay } from './display-options.ts';
import { parseGraphExpression } from './graph-expression.ts';
import type { GraphTool } from './graph-interaction.ts';
import {
  GRAPH_COLORS, MAX_EXPRESSIONS, MAX_EXPRESSION_LENGTH, MAX_GRAPH_SCALE, MIN_GRAPH_SCALE, MAX_GRAPH_CENTER,
  createGraphExpression, defaultGraphView, defaultGraphAnnotations, graphInk, graphZoom, cleanGraphNumber,
  type GraphAnnotations,
  type GraphColor, type GraphDivision, type GraphExpression, type GraphPoint, type GraphSelection, type GraphView, type GraphVisual,
} from './graph-model.ts';
import { GraphPaper } from './graph-paper.ts';
import { GraphTools, graphToolHelp, type GraphToolsHandle } from './graph-tools.ts';
import { measureGraphDrawing } from './graph-measurements.ts';
import { cloneGraphVisual, removeGraphSelection, stepGraphUnits } from './graph-visual.ts';
import { graphNumber, paperGeometry, type RenderPlot } from './graph-scene.ts';

type GraphDocument = Extract<NotebookDocument, { type: 'graph' }>;

export const GraphEditor = defineComponent({
  name: 'NotebookGraphEditor',
  props: {
    document: { type: Object as PropType<GraphDocument>, required: true },
    options: { type: Object as PropType<GraphDisplay>, required: true },
  },
  setup(props) {
    const root = ref<HTMLElement | null>(null);
    const tools = ref<GraphToolsHandle | null>(null);
    const tool = ref<GraphTool>('select');
    const snap = ref(true), scrubby = ref(true), color = ref<GraphColor>('blue');
    const snapDivisions = ref<GraphDivision>(1), subdivisions = ref<GraphDivision>(1);
    const selection = ref<GraphSelection>(null);
    const coordinate = ref<{ x: number; y: number } | null>(null);
    const message = ref('');
    const data = computed(() => props.document.data);
    const blankVisual: GraphVisual = { points: [], connections: [] };
    const visual = computed(() => data.value.visual ?? blankVisual);
    const defaultAnnotations = defaultGraphAnnotations();
    const annotations = computed(() => data.value.annotations ?? defaultAnnotations);
    const measurements = computed(() => measureGraphDrawing(visual.value));
    const paper = computed(() => paperGeometry(props.options));
    const scaleText = ref('1');
    const undo = ref<GraphVisual[]>([]), redo = ref<GraphVisual[]>([]);
    let beforeEdit: GraphVisual | null = null;
    const selectedPoint = computed(() => selection.value?.kind === 'point'
      ? visual.value.points.find(point => point.id === selection.value?.id) ?? null : null);
    const selectedLine = computed(() => selection.value?.kind === 'connection'
      ? visual.value.connections.find(line => line.id === selection.value?.id) ?? null : null);
    const selectedMeasurement = computed(() => measurements.value.segments.find(line => line.id === selectedLine.value?.id) ?? null);
    watch(() => data.value.view.unitsPerSquare, value => { scaleText.value = cleanGraphNumber(value).toString(); }, { immediate: true });
    const parsed = computed(() => data.value.expressions.map(expression => ({ expression,
      ...parseGraphExpression(expression.source) })));
    const plots = computed(() => {
      const visible: RenderPlot[] = [];
      for (const entry of parsed.value) {
        if (entry.plot && !entry.expression.hidden) visible.push({ plot: entry.plot, color: entry.expression.color });
      }
      return visible;
    });
    function beginEdit() { if (!beforeEdit) beforeEdit = cloneGraphVisual(visual.value); }
    function endEdit() {
      if (!beforeEdit) return;
      if (JSON.stringify(beforeEdit) !== JSON.stringify(visual.value)) {
        undo.value.push(beforeEdit);
        if (undo.value.length > 50) undo.value.shift();
        redo.value = [];
      }
      beforeEdit = null;
    }
    function commitVisual(next: GraphVisual) { beginEdit(); data.value.visual = next; endEdit(); }
    function restoreDrawing(back: boolean) {
      const source = back ? undo : redo, destination = back ? redo : undo;
      const previous = source.value.pop();
      if (!previous) return;
      destination.value.push(cloneGraphVisual(visual.value));
      data.value.visual = cloneGraphVisual(previous);
      selection.value = null;
      tool.value = 'select';
    }
    async function focusExpression(id: string) {
      await nextTick();
      root.value?.querySelector<HTMLInputElement>(`#graph-source-${id}`)?.focus();
    }
    function add(source = '') {
      if (data.value.expressions.length >= MAX_EXPRESSIONS) return;
      const expression = createGraphExpression(data.value.expressions.length, source);
      data.value.expressions.push(expression);
      void focusExpression(expression.id);
    }
    async function remove(expression: GraphExpression) {
      const index = data.value.expressions.findIndex(item => item.id === expression.id);
      if (index < 0) return;
      data.value.expressions.splice(index, 1);
      const neighbor = data.value.expressions[index] ?? data.value.expressions[index - 1];
      if (neighbor) await focusExpression(neighbor.id);
      else { await nextTick(); root.value?.querySelector<HTMLButtonElement>('.graph-add-expression')?.focus(); }
    }
    function setScale(value: number) {
      if (!Number.isFinite(value) || value < MIN_GRAPH_SCALE || value > MAX_GRAPH_SCALE) {
        message.value = `Choose a scale from ${MIN_GRAPH_SCALE} to ${MAX_GRAPH_SCALE} units per square.`;
        scaleText.value = cleanGraphNumber(data.value.view.unitsPerSquare).toString(); return;
      }
      data.value.view.unitsPerSquare = cleanGraphNumber(value);
      scaleText.value = data.value.view.unitsPerSquare.toString(); message.value = '';
    }
    function stepScale(direction: number, large = false) {
      const typed = Number(scaleText.value);
      const current = Number.isFinite(typed) && typed >= MIN_GRAPH_SCALE && typed <= MAX_GRAPH_SCALE
        ? typed : data.value.view.unitsPerSquare;
      setScale(Math.max(MIN_GRAPH_SCALE, Math.min(MAX_GRAPH_SCALE, stepGraphUnits(current, direction, large))));
    }
    function updatePoint(point: GraphPoint) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > MAX_GRAPH_CENTER || Math.abs(point.y) > MAX_GRAPH_CENTER) {
        message.value = `Point coordinates must be between −${MAX_GRAPH_CENTER} and ${MAX_GRAPH_CENTER}.`; return;
      }
      commitVisual({ ...visual.value, points: visual.value.points.map(item => item.id === point.id
        ? { ...point, x: cleanGraphNumber(point.x), y: cleanGraphNumber(point.y) } : item) });
      message.value = '';
    }
    function changeColor(ink: GraphColor) {
      color.value = ink;
      if (selectedPoint.value) updatePoint({ ...selectedPoint.value, color: ink });
      else if (selectedLine.value) commitVisual({ ...visual.value,
        connections: visual.value.connections.map(line => line.id === selectedLine.value?.id ? { ...line, color: ink } : line) });
    }
    function expressionRow(entry: typeof parsed.value[number], index: number) {
      const { expression, error } = entry;
      const sourceId = `graph-source-${expression.id}`;
      return h('li', { key: expression.id, class: ['graph-expression', { 'is-hidden': expression.hidden }],
        style: { '--expression-ink': graphInk(expression.color) } }, [
        h('div', { class: 'graph-expression-heading' }, [
          h('button', { type: 'button', class: 'graph-expression-toggle',
            'aria-label': `${expression.hidden ? 'Show' : 'Hide'} expression ${index + 1}`,
            'aria-pressed': !expression.hidden, title: expression.hidden ? 'Show plot' : 'Hide plot',
            onClick: () => { expression.hidden = !expression.hidden; } }, [h('span', { 'aria-hidden': 'true' }, `${index + 1}`)]),
          h('label', { class: 'visually-hidden', for: `graph-color-${expression.id}` }, `Expression ${index + 1} color`),
          h('select', { id: `graph-color-${expression.id}`, class: 'graph-expression-color', value: expression.color,
            onChange: (event: Event) => {
              const choice = GRAPH_COLORS.find(color => color.id === inputValue(event));
              if (choice) expression.color = choice.id;
            } }, GRAPH_COLORS.map(ink => h('option', { value: ink.id }, ink.label))),
          h('button', { type: 'button', class: 'quiet-button graph-expression-remove',
            'aria-label': `Remove expression ${index + 1}`, onClick: () => void remove(expression) }, '×'),
        ]),
        h('label', { class: 'visually-hidden', for: sourceId }, `Expression ${index + 1}`),
        h('input', { id: sourceId, class: 'graph-expression-source', value: expression.source,
          placeholder: 'y = x^2', maxlength: MAX_EXPRESSION_LENGTH, spellcheck: false, autocapitalize: 'off',
          autocomplete: 'off', 'aria-invalid': !!error,
          'aria-describedby': error ? `graph-error-${expression.id}` : undefined,
          onInput: (event: Event) => { expression.source = inputValue(event); } }),
        error ? h('p', { id: `graph-error-${expression.id}`, class: 'graph-expression-error' }, error) : null,
      ]);
    }
    function expressionPanel() {
      return h('aside', { class: 'graph-expression-panel', 'aria-label': 'Graph expressions' }, [
        h('header', { class: 'graph-panel-heading' }, [h('h3', 'Expressions'), h('span', `${data.value.expressions.length} / ${MAX_EXPRESSIONS}`)]),
        h('p', { class: 'graph-panel-description' }, 'Write a function, plot a point, or start with an example.'),
        h('ol', { class: 'graph-expression-list' }, parsed.value.map(expressionRow)),
        h('div', { class: 'graph-expression-actions' }, [
          h('button', { type: 'button', class: 'quiet-button graph-add-expression',
            disabled: data.value.expressions.length >= MAX_EXPRESSIONS, onClick: () => add() }, '+ Expression'),
          data.value.expressions.length === 0 ? h('button', { type: 'button', class: 'quiet-button', onClick: () => {
            for (const source of ['y = sin(x)', 'y = x^2 / 4', '(2, 3)']) data.value.expressions.push(createGraphExpression(data.value.expressions.length, source));
            void focusExpression(data.value.expressions[0]!.id);
          } }, 'Try examples') : null,
        ]),
        h('details', { class: 'graph-formula-help' }, [
          h('summary', 'What can I plot?'),
          h('p', 'Functions: y = x^2, y = 2x + 1, sin(x). Vertical lines: x = 3. Points: (2, 3).'),
          h('p', 'Use + − * / ^ and parentheses. Constants: pi (π), e. Functions: sin, cos, tan, asin, acos, atan, sqrt, abs, exp, ln, log (base 10), floor, ceil, round, sign. Angles use radians.'),
        ]),
      ]);
    }
    return () => h('div', { ref: root, class: 'graph-editor' }, [
      h('div', { class: 'graph-view-toolbar', role: 'group', 'aria-label': 'Graph commands' }, [
        h('button', { type: 'button', class: 'quiet-button', title: 'Return to 100% zoom',
          'aria-label': `Zoom ${graphZoom(data.value.view)} percent. Return to 100 percent`,
          onClick: () => { data.value.view.zoom = 100; } }, `${graphZoom(data.value.view)}%`),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => {
          data.value.view = { ...defaultGraphView(), unitsPerSquare: data.value.view.unitsPerSquare };
        } }, 'Reset view'),
        h('div', { class: 'graph-scale' }, [
          h('label', { for: `graph-scale-${props.document.id}` }, 'Units / square'),
          h('div', { class: 'graph-scale-spinner' }, [h('input', {
            id: `graph-scale-${props.document.id}`, type: 'number', step: 'any', min: MIN_GRAPH_SCALE, max: MAX_GRAPH_SCALE,
            value: scaleText.value, onInput: (event: Event) => { scaleText.value = inputValue(event); },
            onChange: () => setScale(Number(scaleText.value)),
            onKeydown: (event: KeyboardEvent) => {
              if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); stepScale(event.key === 'ArrowUp' ? 1 : -1, event.shiftKey); }
            },
          }), h('div', { class: 'graph-scale-arrows' }, [1, -1].map(direction => h('button', {
            type: 'button', 'aria-label': direction === 1 ? 'Increase units per square' : 'Decrease units per square',
            onPointerdown: (event: PointerEvent) => event.preventDefault(), onClick: () => stepScale(direction),
          }, direction === 1 ? '▴' : '▾')))]),
        ]),
        h('button', { type: 'button', class: 'quiet-button', disabled: !undo.value.length,
          onClick: () => restoreDrawing(true) }, 'Undo'), h('button', { type: 'button', class: 'quiet-button', disabled: !redo.value.length,
          onClick: () => restoreDrawing(false) }, 'Redo'),
      ]),
      h('div', { class: 'graph-editor-layout' }, [
        expressionPanel(),
        h('section', { class: 'graph-sheet-panel', 'aria-label': 'Graph Paper sheet' }, [
          h('p', { class: 'graph-paper-description' }, `${paper.value.label} · ${paper.value.ruling} at 100% zoom.`),
          h('div', { class: 'graph-sheet-workspace' }, [
            h('div', { class: 'graph-sheet-scroll' }, [h(GraphPaper, { view: data.value.view, options: props.options,
              plots: plots.value, visual: visual.value, tool: tool.value,
              annotations: annotations.value, measurements: measurements.value,
              color: color.value, snap: snap.value, scrubby: scrubby.value, selection: selection.value, title: data.value.title,
              snapDivisions: snapDivisions.value, subdivisions: subdivisions.value,
              onView: (view: GraphView) => { data.value.view = view; },
              onVisual: (next: GraphVisual) => { data.value.visual = next; }, onEditStart: beginEdit, onEditEnd: endEdit,
              onSelection: (next: GraphSelection) => { selection.value = next; },
              onOptions: async () => { tool.value = 'select'; await nextTick(); await tools.value?.openOptions(); },
              onTitle: (title: string) => { data.value.title = title; }, onMessage: (text: string) => { message.value = text; },
              onCoordinate: (point: { x: number; y: number } | null) => { coordinate.value = point; },
            })]),
            h(GraphTools, { ref: tools, tool: tool.value, color: color.value, snap: snap.value, scrubby: scrubby.value,
              annotations: annotations.value, measurements: measurements.value, line: selectedMeasurement.value,
              snapDivisions: snapDivisions.value, subdivisions: subdivisions.value,
              point: selectedPoint.value, selection: selection.value, selectedColor: selectedPoint.value?.color ?? selectedLine.value?.color ?? null,
              onTool: (next: GraphTool) => { tool.value = next; }, onColor: changeColor, onPoint: updatePoint,
              onSnap: (enabled: boolean) => { snap.value = enabled; }, onScrubby: (enabled: boolean) => { scrubby.value = enabled; },
              onSnapDivisions: (value: GraphDivision) => { snapDivisions.value = value; },
              onSubdivisions: (value: GraphDivision) => { subdivisions.value = value; },
              onAnnotations: (value: GraphAnnotations) => { data.value.annotations = value; },
              onRemove: () => { commitVisual(removeGraphSelection(visual.value, selection.value)); selection.value = null; },
            }),
          ]),
          h('p', { class: 'graph-tool-description' }, graphToolHelp(tool.value)),
          h('div', { class: 'graph-sheet-caption' }, [
            h('span', `${plots.value.length} visible ${plots.value.length === 1 ? 'plot' : 'plots'} · ${visual.value.points.length} drawn points · ${visual.value.connections.length} connections`),
            h('span', `1 square = ${cleanGraphNumber(data.value.view.unitsPerSquare)} units`),
            h('output', { 'aria-label': 'Pointer coordinates', 'aria-live': 'off' }, coordinate.value
              ? `(${graphNumber(coordinate.value.x)}, ${graphNumber(coordinate.value.y)})` : 'Move over the paper to read coordinates'),
          ]),
          h('div', { class: 'graph-notes' }, [h('label', { for: `graph-notes-${props.document.id}` }, 'Notes'),
            h('textarea', { id: `graph-notes-${props.document.id}`, rows: 4, maxlength: 20000, placeholder: 'What do you notice?',
              value: data.value.notes, onInput: (event: Event) => { data.value.notes = inputValue(event); } }),
          ]),
        ]),
      ]),
      message.value ? h('p', { class: 'graph-editor-message', role: 'status' }, message.value) : null,
    ]);
  },
});
