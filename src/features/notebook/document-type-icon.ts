import { h } from 'vue';
import type { DocumentTypeId } from './document-types.ts';

export function DocumentTypeIcon({ type, compact = false }: { type: DocumentTypeId; compact?: boolean }) {
  const common = {
    class: compact ? 'ui-icon' : 'notebook-type-icon',
    viewBox: compact ? '18 6 60 84' : '0 0 96 96',
    width: compact ? 20 : 96,
    height: compact ? 20 : 96,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': compact ? 5 : 2.5,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  };

  const paper = [
    h('path', { d: 'M24 10h36l12 12v64H24Z' }),
    h('path', { d: 'M60 10v14h12' }),
  ];

  if (type === 'markdown') {
    return h('svg', common, [
      ...paper,
      h('path', { d: 'M34 39v24M34 39l8 9 8-9v24M57 48l6 7 6-7M63 55v-16' }),
    ]);
  }

  if (type === 'lined') {
    return h('svg', common, [
      ...paper,
      ...[36, 46, 56, 66].map((y) => h('path', { d: `M34 ${y}h28` })),
    ]);
  }

  return h('svg', common, [
    ...paper,
    ...[36, 44, 52, 60, 68].map((y) => h('path', { d: `M32 ${y}h32`, opacity: 0.7 })),
    ...[36, 44, 52, 60].map((x) => h('path', { d: `M${x} 32v40`, opacity: 0.7 })),
    h('path', { d: 'M32 62l9-9 8 4 13-16', 'stroke-width': 3 }),
  ]);
}

