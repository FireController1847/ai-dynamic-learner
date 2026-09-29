const { h } = window.Vue;

// Small inline SVGs keep essential controls independent of icon fonts or CDNs.
const paths = {
  folder: 'M3 5h6l2 2h10v13H3Z',
  document: 'M6 3h9l4 4v14H6ZM15 3v5h5M9 12h6M9 16h6',
  cards: 'M6 3h15v14H6ZM3 7v14h14M9 8h9M9 12h6',
  pencil: 'm4 16-1 5 5-1L20 8l-4-4ZM14 6l4 4',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  plus: 'M12 5v14M5 12h14',
  search: 'M17 10a7 7 0 1 1-14 0 7 7 0 1 1 14 0M15 15l6 6',
  settings: 'M10 3h4l.5 3 2 1.2 2.8-1 2 3.5-2.3 2v2.6l2.3 2-2 3.5-2.8-1-2 1.2-.5 3h-4l-.5-3-2-1.2-2.8 1-2-3.5 2.3-2v-2.6l-2.3-2 2-3.5 2.8 1 2-1.2ZM15 13a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z',
  duplicate: 'M8 8h13v13H8ZM16 8V3H3v13h5',
  flip: 'M4 8a8 8 0 0 1 14-2l3 3M21 3v6h-6M20 16a8 8 0 0 1-14 2l-3-3M3 21v-6h6',
  rotate: 'M20 8V3m0 0h-5m5 0-4 4a8 8 0 1 0 2.3 8.7',
  shuffle: 'M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 5-6m2-3c2-2 3-3 5-3h3m-4-4 4 4-4 4',
  chevron: 'm9 5 7 7-7 7',
  'panel-close': 'M3 3h18v18H3ZM8 3v18m9-14-4 5 4 5',
  'panel-open': 'M3 3h18v18H3ZM8 3v18m5-14 4 5-4 5',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  loading: 'M21 12a9 9 0 1 1-9-9',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  lightbulb: 'M9 18h6M10 22h4M8.5 15.2A7 7 0 1 1 15.5 15.2C14.5 16.1 14 16.9 14 18h-4c0-1.1-.5-1.9-1.5-2.8Z',
};

export const Icon = {
  name: 'Icon',
  props: { name: { type: String, required: true } },
  setup(props) {
    return () => h('svg', {
      class: 'ui-icon', viewBox: '0 0 24 24', width: 20, height: 20,
      fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'aria-hidden': 'true', focusable: 'false',
    }, props.name === 'word-search' ? [
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
};
