const { h } = window.Vue;

// Small inline SVGs keep essential controls independent of icon fonts or CDNs.
const paths = {
  folder: 'M3 5h6l2 2h10v13H3Z',
  cards: 'M6 3h15v14H6ZM3 7v14h14M9 8h9M9 12h6',
  pencil: 'm4 16-1 5 5-1L20 8l-4-4ZM14 6l4 4',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  plus: 'M12 5v14M5 12h14',
  duplicate: 'M8 8h13v13H8ZM16 8V3H3v13h5',
  flip: 'M4 8a8 8 0 0 1 14-2l3 3M21 3v6h-6M20 16a8 8 0 0 1-14 2l-3-3M3 21v-6h6',
  shuffle: 'M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 5-6m2-3c2-2 3-3 5-3h3m-4-4 4 4-4 4',
  chevron: 'm9 5 7 7-7 7',
  'panel-close': 'M3 3h18v18H3ZM8 3v18m9-14-4 5 4 5',
  'panel-open': 'M3 3h18v18H3ZM8 3v18m5-14 4 5-4 5',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
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
    }, [h('path', { d: paths[props.name] })]);
  },
};
