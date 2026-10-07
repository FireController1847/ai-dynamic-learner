import { defineComponent, h, nextTick, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import { createSection, MAX_BULLETS, MAX_SECTIONS, MAX_TEXT_LENGTH, type GuideSection, type ListGuideData } from './library-model.ts';

const MAX_BULLET_DEPTH = 7;
function bulletDepth(value: string): number {
  return Math.min(MAX_BULLET_DEPTH, value.match(/^\t*/)?.[0].length ?? 0);
}

function bulletText(value: string): string {
  return value.slice(bulletDepth(value));
}

function withBulletDepth(value: string, depth: number): string {
  return `${'\t'.repeat(Math.max(0, Math.min(MAX_BULLET_DEPTH, depth)))}${value}`;
}

function bulletMarker(depth: number) {
  const level = Math.max(0, Math.min(MAX_BULLET_DEPTH, depth));
  const common = {
    class: 'study-guide-bullet-marker',
    viewBox: '0 0 16 16',
    width: 14,
    height: 14,
    'aria-hidden': 'true',
    focusable: 'false',
  };

  if (level === 0) return h('svg', common, [
    h('circle', { cx: 8, cy: 8, r: 5.25, fill: 'currentColor', stroke: 'none' }),
  ]);
  if (level === 1) return h('svg', common, [
    h('circle', { cx: 8, cy: 8, r: 5.25, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8 }),
  ]);
  if (level === 2) return h('svg', common, [
    h('rect', { x: 2.75, y: 2.75, width: 10.5, height: 10.5, rx: 1, fill: 'currentColor', stroke: 'none' }),
  ]);
  if (level === 3) return h('svg', common, [
    h('rect', { x: 2.75, y: 2.75, width: 10.5, height: 10.5, rx: 1, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8 }),
  ]);
  if (level === 4) return h('svg', common, [
    h('path', { d: 'M8 2.25 13.75 8 8 13.75 2.25 8Z', fill: 'currentColor', stroke: 'none' }),
  ]);
  if (level === 5) return h('svg', common, [
    h('path', { d: 'M8 2.25 13.75 8 8 13.75 2.25 8Z', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }),
  ]);

  const strokeWidth = level === 6 ? 2.5 : 1.55;
  return h('svg', common, [
    h('path', {
      d: 'M8 2.25v11.5M3.02 5.13l9.96 5.74M12.98 5.13l-9.96 5.74',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': strokeWidth,
      'stroke-linecap': 'round',
    }),
  ]);
}

export const StudyGuideListEditor = defineComponent({
  name: 'StudyGuideListEditor',
  props: { data: { type: Object as PropType<ListGuideData>, required: true }, compact: Boolean },
  setup(props) {
    const bulletFields = new Map<string, HTMLInputElement>();
    const titleFields = new Map<string, HTMLInputElement>();
    const bulletCount = () => props.data.sections.reduce((count, section) => count + section.bullets.length, 0);
    const bulletKey = (section: GuideSection, index: number) => `${section.id}:${index}`;

    async function focusBullet(section: GuideSection, index: number, cursor?: number) {
      await nextTick();
      const field = bulletFields.get(bulletKey(section, index));
      if (!field) return;
      field.focus();
      const position = Math.max(0, Math.min(cursor ?? field.value.length, field.value.length));
      field.setSelectionRange(position, position);
    }

    async function focusSection(section: GuideSection) {
      await nextTick();
      titleFields.get(section.id)?.focus();
    }

    async function addBullet(section: GuideSection, index = section.bullets.length) {
      if (bulletCount() >= MAX_BULLETS) return;
      section.bullets.splice(index, 0, '');
      await focusBullet(section, index, 0);
    }

    async function removeBullet(section: GuideSection, index: number) {
      section.bullets.splice(index, 1);
      const previous = index - 1;
      if (previous >= 0) {
        await focusBullet(section, previous, bulletText(section.bullets[previous] ?? '').length);
      } else {
        await focusSection(section);
      }
    }

    async function removeEmptySection(section: GuideSection) {
      const index = props.data.sections.indexOf(section);
      if (index < 0 || props.data.sections.length <= 1 || section.title || section.bullets.length) return;
      props.data.sections.splice(index, 1);
      const target = props.data.sections[index - 1] ?? props.data.sections[index];
      if (!target) return;
      if (target.bullets.length) await focusBullet(target, target.bullets.length - 1);
      else await focusSection(target);
    }

    function handleBulletKeydown(event: KeyboardEvent, section: GuideSection, index: number) {
      if (event.isComposing || !(event.target instanceof HTMLInputElement)) return;
      const stored = section.bullets[index] ?? '';
      const depth = bulletDepth(stored);
      const text = bulletText(stored);
      const start = event.target.selectionStart ?? text.length;
      const end = event.target.selectionEnd ?? start;

      if (event.key === 'Tab') {
        if (event.shiftKey) {
          if (depth === 0) return;
          event.preventDefault();
          section.bullets[index] = withBulletDepth(text, depth - 1);
          void focusBullet(section, index, start);
          return;
        }
        if (index === 0) return;
        const previousDepth = bulletDepth(section.bullets[index - 1] ?? '');
        const maxDepth = Math.min(MAX_BULLET_DEPTH, previousDepth + 1);
        if (depth >= maxDepth) return;
        event.preventDefault();
        section.bullets[index] = withBulletDepth(text, depth + 1);
        void focusBullet(section, index, start);
        return;
      }

      if (event.key === 'Backspace' && start === 0 && end === 0) {
        if (!text) {
          event.preventDefault();
          void removeBullet(section, index);
          return;
        }
        if (depth > 0) {
          event.preventDefault();
          section.bullets[index] = withBulletDepth(text, depth - 1);
          void focusBullet(section, index, 0);
          return;
        }
      }

      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (bulletCount() >= MAX_BULLETS) return;
      const before = text.slice(0, start);
      const after = text.slice(end);
      section.bullets[index] = withBulletDepth(before, depth);
      section.bullets.splice(index + 1, 0, withBulletDepth(after, depth));
      void focusBullet(section, index + 1, 0);
    }

    function handleTitleKeydown(event: KeyboardEvent, section: GuideSection) {
      if (event.isComposing) return;
      if (event.key === 'Backspace' && !section.title && section.bullets.length === 0 &&
          event.target instanceof HTMLInputElement && event.target.selectionStart === 0 && event.target.selectionEnd === 0) {
        event.preventDefault();
        void removeEmptySection(section);
        return;
      }
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (section.bullets.length) void focusBullet(section, 0, 0);
      else void addBullet(section, 0);
    }

    async function addSection() {
      if (props.data.sections.length >= MAX_SECTIONS) return;
      const section = createSection();
      props.data.sections.push(section);
      await focusSection(section);
    }

    return () => h('div', { class: ['study-guide-list-editor', { 'is-compact': props.compact }] }, [
      props.data.sections.length ? h('div', { class: 'study-guide-sections' }, props.data.sections.map((section, si) => h('section', { key: section.id, class: 'study-guide-section' }, [
        h('div', { class: 'study-guide-section-heading' }, [
          h('input', {
            ref: (element) => {
              if (element instanceof HTMLInputElement) titleFields.set(section.id, element);
              else titleFields.delete(section.id);
            },
            class: 'study-guide-section-title', value: section.title, maxlength: MAX_TEXT_LENGTH,
            placeholder: 'Title', 'aria-label': 'Section title',
            onInput: (event: Event) => { section.title = inputValue(event); },
            onKeydown: (event: KeyboardEvent) => handleTitleKeydown(event, section),
          }),
          h('button', {
            type: 'button', class: 'icon-button study-guide-remove', title: 'Remove title', 'aria-label': 'Remove title',
            onClick: () => props.data.sections.splice(si, 1),
          }, '×'),
        ]),
        h('div', { class: 'study-guide-bullets' }, section.bullets.map((bullet, bi) => {
          const depth = bulletDepth(bullet);
          const text = bulletText(bullet);
          return h('div', {
            key: `${section.id}-${bi}`,
            class: 'study-guide-bullet-row',
            style: { paddingLeft: `${depth * 20}px` },
          }, [
            bulletMarker(depth),
            h('input', {
              ref: (element) => {
                const key = bulletKey(section, bi);
                if (element instanceof HTMLInputElement) bulletFields.set(key, element);
                else bulletFields.delete(key);
              },
              value: text,
              maxlength: Math.max(0, MAX_TEXT_LENGTH - depth),
              placeholder: 'Bullet point',
              'aria-label': `Bullet ${bi + 1}, level ${depth + 1}`,
              onInput: (event: Event) => { section.bullets[bi] = withBulletDepth(inputValue(event), depth); },
              onKeydown: (event: KeyboardEvent) => handleBulletKeydown(event, section, bi),
            }),
            h('button', {
              type: 'button', class: 'icon-button study-guide-remove', title: 'Remove bullet', 'aria-label': 'Remove bullet',
              onClick: () => { void removeBullet(section, bi); },
            }, '×'),
          ]);
        })),
        h('button', {
          type: 'button', class: 'quiet-button study-guide-add-bullet', disabled: bulletCount() >= MAX_BULLETS,
          onClick: () => { void addBullet(section); },
        }, '+ Bullet'),
      ]))) : h('div', { class: 'study-guide-list-empty' }, [
        h('p', 'Add a title, then put the things you need to remember underneath it.'),
      ]),
      h('button', {
        type: 'button', class: 'quiet-button study-guide-add-section', disabled: props.data.sections.length >= MAX_SECTIONS,
        onClick: () => { void addSection(); },
      }, '+ Title'),
    ]);
  },
});
