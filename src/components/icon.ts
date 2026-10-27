import { defineComponent, type PropType, h } from 'vue';

// Small inline SVGs keep essential controls independent of icon fonts or CDNs.
const paths: Record<string, string> = {
  calculator: 'M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM7 6h10v4H7M8 14h1M12 14h1M16 14h1M8 18h1M12 18h1M16 18h1',
  folder: 'M3 5h6l2 2h10v13H3Z',
  check: 'm5 12 4 4L19 6',
  lock: 'M5 10h14v12H5ZM8 10V6a4 4 0 0 1 8 0v4M12 15v3',
  'help-circle': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM9.1 9a3 3 0 1 1 5.1 2.2c-.9.8-2.2 1.3-2.2 3.1M12 18h.01',
  'arrow-left': 'M20 12H4m7-7-7 7 7 7',
  'arrow-right': 'M4 12h16m-7-7 7 7-7 7',
  'arrow-up': 'M12 20V4m-7 7 7-7 7 7',
  'arrow-down': 'M12 4v16m-7-7 7 7 7-7',
  flame: 'M13 2c1 5-5 6-5 10 0 2 1 3 2 4-4 0-6-3-6-6C1 17 5 22 12 22s10-5 8-10c-1-3-4-6-7-10ZM12 14c2 2 3 3 3 5a3 3 0 0 1-6 0c0-2 2-3 3-5Z',
  coffee: 'M4 8h12v7a6 6 0 0 1-12 0ZM16 8h2a3 3 0 0 1 0 6h-2M3 22h15M7 3v2M12 3v2',
  statistics: 'M3 21h18M5 21V12h3v9M11 21V7h3v14M17 21V3h3v18',
  checklist: 'M9 5h12M9 12h12M9 19h12M2 5l2 2 3-4M2 12l2 2 3-4M2 19l2 2 3-4',
  grid: 'M3 3h18v18H3ZM12 3v18M3 12h18',
  tag: 'M3 3h8l10 10-8 8L3 11ZM7 7h.01',
  bookmark: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z',
  flag: 'M5 22V3M5 4h13l-3 5 3 5H5',
  archive: 'M3 3h18v5H3ZM5 8v13h14V8M9 12h6',
  document: 'M6 3h9l4 4v14H6ZM15 3v5h5M9 12h6M9 16h6',
  cards: 'M6 3h15v14H6ZM3 7v14h14M9 8h9M9 12h6',
  pencil: 'm4 16-1 5 5-1L20 8l-4-4ZM14 6l4 4',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M17 10a7 7 0 1 1-14 0 7 7 0 1 1 14 0M15 15l6 6',
  settings: 'M10 3h4l.5 3 2 1.2 2.8-1 2 3.5-2.3 2v2.6l2.3 2-2 3.5-2.8-1-2 1.2-.5 3h-4l-.5-3-2-1.2-2.8 1-2-3.5 2.3-2v-2.6l-2.3-2 2-3.5 2.8 1 2-1.2ZM15 13a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z',
  duplicate: 'M8 8h13v13H8ZM16 8V3H3v13h5',
  flip: 'M4 8a8 8 0 0 1 14-2l3 3M21 3v6h-6M20 16a8 8 0 0 1-14 2l-3-3M3 21v-6h6',
  rotate: 'M20 8V3m0 0h-5m5 0-4 4a8 8 0 1 0 2.3 8.7',
  // Two opposing curved arrows read as Refresh, unlike a circle with one outward arrow.
  'refresh-cw': 'M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5',
  shuffle: 'M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 5-6m2-3c2-2 3-3 5-3h3m-4-4 4 4-4 4',
  repeat: 'm17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15m-14 16-4-4 4-4m14-3v2a3 3 0 0 1-3 3H3',
  'repeat-1': 'm17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15m-14 16-4-4 4-4m14-3v2a3 3 0 0 1-3 3H3M11 10h1v4',
  chevron: 'm9 5 7 7-7 7',
  'chevron-up': 'm5 15 7-7 7 7',
  'chevron-down': 'm5 9 7 7 7-7',
  grip: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  'panel-close': 'M3 3h18v18H3ZM8 3v18m9-14-4 5 4 5',
  'panel-open': 'M3 3h18v18H3ZM8 3v18m5-14 4 5-4 5',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  loading: 'M21 12a9 9 0 1 1-9-9',
  clock: 'M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0ZM12 7v5l3 2',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  printer: 'M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6ZM17 11h1',
  'page-portrait': 'M5 2h14v20H5ZM8 6h8M8 10h8',
  'page-landscape': 'M2 5h20v14H2ZM6 9h12M6 13h8',
  'page-margins': 'M4 2h16v20H4ZM7 5h10v14H7M2 8h4M18 8h4M2 16h4M18 16h4',
  'page-layout': 'M3 3h18v18H3ZM6 6h12M6 10h4v8H6ZM14 10h4v8h-4',
  'text-font': 'M3 19 9 4l6 15M5 14h8M17 19V9h5M17 13h4',
  'text-size': 'M3 5h12M9 5v15M5 20h8M16 10h6M19 10v10M17 20h4',
  lightbulb: 'M9 18h6M10 22h4M8.5 15.2A7 7 0 1 1 15.5 15.2C14.5 16.1 14 16.9 14 18h-4c0-1.1-.5-1.9-1.5-2.8Z',
  ai: 'M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5ZM19 13l.8 2.2L22 16l-2.2.8L19 19l-.8-2.2L16 16l2.2-.8ZM5 15l.7 1.8L8 17.5l-2.3.7L5 20l-.7-1.8L2 17.5l2.3-.7Z',
};

export const Icon = defineComponent({
  name: 'Icon',
  props: { name: { type: String, required: true } },
  setup(props) {
    return () => h('svg', {
      class: 'ui-icon', viewBox: '0 0 24 24', width: 20, height: 20,
      fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'aria-hidden': 'true', focusable: 'false',
    }, props.name === 'theme' ? [
      h('circle', { cx: 12, cy: 12, r: 9 }),
      h('path', { d: 'M12 3a9 9 0 0 1 0 18Z', fill: 'currentColor', stroke: 'none', 'fill-opacity': 0.22 }),
      h('path', { d: 'M12 3v18' }),
    ] : props.name === 'verified' ? [
      h('path', {
        d: 'm12 2 2.1 1.8 2.8-.2 1.2 2.5 2.5 1.2-.2 2.8L22 12l-1.8 2.1.2 2.8-2.5 1.2-1.2 2.5-2.8-.2L12 22l-2.1-1.8-2.8.2-1.2-2.5-2.5-1.2.2-2.8L2 12l1.8-2.1-.2-2.8 2.5-1.2 1.2-2.5 2.8.2Z',
        fill: 'none',
      }),
      h('path', { d: 'm7.4 12.2 2.8 2.8 6.4-6.4', fill: 'none', 'stroke-width': 2 }),
    ] : props.name === 'blank-add' ? [
      h('path', { d: 'M3 6h4M17 6h4' }),
      h('rect', { x: 9, y: 3.5, width: 6, height: 5, rx: 1.5, fill: 'currentColor', 'fill-opacity': 0.16 }),
      h('rect', { x: 9, y: 3.5, width: 6, height: 5, rx: 1.5 }),
      h('path', { d: 'M12 10.5v5M9.5 13l2.5 2.5 2.5-2.5' }),
      h('path', { d: 'M6 20h12' }),
    ] : props.name === 'blank-remove' ? [
      h('path', { d: 'M6 4h12' }),
      h('path', { d: 'M12 8.5v5M9.5 11l2.5 2.5 2.5-2.5' }),
      h('path', { d: 'M3 19h5M16 19h5' }),
      h('rect', { x: 9, y: 16.5, width: 6, height: 5, rx: 1.5, fill: 'currentColor', 'fill-opacity': 0.16 }),
      h('rect', { x: 9, y: 16.5, width: 6, height: 5, rx: 1.5 }),
    ] : props.name === 'crossword' ? [
      h('rect', { x: 2, y: 2, width: 20, height: 20, rx: 1 }),
      ...[7, 12, 17].flatMap((position) => [
        h('path', { d: `M${position} 2v20` }),
        h('path', { d: `M2 ${position}h20` }),
      ]),
      h('rect', { x: 7, y: 2, width: 5, height: 5, fill: 'currentColor', stroke: 'none' }),
      h('rect', { x: 17, y: 7, width: 5, height: 5, fill: 'currentColor', stroke: 'none' }),
      h('rect', { x: 2, y: 12, width: 5, height: 5, fill: 'currentColor', stroke: 'none' }),
      h('rect', { x: 12, y: 17, width: 5, height: 5, fill: 'currentColor', stroke: 'none' }),
    ] : props.name === 'word-search' ? [
      h('rect', { x: 1.5, y: 1.5, width: 21, height: 7, rx: 3.5 }),
      h('rect', {
        x: 1.5, y: 1.5, width: 21, height: 7, rx: 3.5,
        fill: 'currentColor', 'fill-opacity': 0.12, stroke: 'none',
      }),
      ...['CAT', 'ORE', 'WSN'].flatMap((row, rowIndex) => [...row].map((letter, column) =>
        h('text', {
          x: 5 + column * 7, y: 7 + rowIndex * 7,
          fill: 'currentColor', stroke: 'none', 'text-anchor': 'middle',
          'font-family': 'monospace', 'font-size': 5.5, 'font-weight': 700,
        }, letter))),
    ] : [h('path', { d: paths[props.name] })]);
  },
});
