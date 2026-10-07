import { defineComponent, h, nextTick, ref, type PropType } from 'vue';
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
    h('circle', { cx: 8, cy: 8, r: 2.75, fill: 'currentColor', stroke: 'none' }),
  ]);
  if (level === 1) return h('svg', common, [
    h('circle', { cx: 8, cy: 8, r: 2.625, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8 }),
  ]);
  if (level === 2) return h('svg', common, [
    h('rect', { x: 5.375, y: 5.375, width: 5.25, height: 5.25, rx: 1, fill: 'currentColor', stroke: 'none' }),
  ]);
  if (level === 3) return h('svg', common, [
    h('rect', { x: 5.5, y: 5.5, width: 5, height: 5, rx: 1, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8 }),
  ]);
  if (level === 4) return h('svg', common, [
    h('path', { d: 'M8 4.25 11.75 8 8 11.75 4.25 8Z', fill: 'currentColor', stroke: 'none' }),
  ]);
  if (level === 5) return h('svg', common, [
    h('path', { d: 'M8 4.625 11.375 8 8 11.375 4.625 8Z', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }),
  ]);

  const strokeWidth = level === 6 ? 2.5 : 1.55;
  const asteriskPath = level === 6
    ? 'M8 5.25v5.5M5.617 6.625l4.766 2.75M10.383 6.625l-4.766 2.75'
    : 'M8 4.25v7.5M4.752 6.128l6.496 3.744M11.248 6.128l-6.496 3.744';
  return h('svg', common, [
    h('path', {
      d: asteriskPath,
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
    const addSectionButton = ref<HTMLButtonElement | null>(null);
    const message = ref('');
    const bulletCount = () => props.data.sections.reduce((count, section) => count + section.bullets.length, 0);
    const bulletKey = (section: GuideSection, index: number) => `${section.id}:${index}`;
    const sectionLabel = (section: GuideSection) => {
      const index = props.data.sections.indexOf(section);
      const number = index >= 0 ? index + 1 : 1;
      const title = section.title.trim();
      return title ? `Section ${number}, ${title}` : `Section ${number}`;
    };
    function announce(value: string) {
      message.value = '';
      void nextTick(() => { message.value = value; });
    }

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
      announce(`Bullet ${index + 1} added to ${sectionLabel(section)}.`);
      await focusBullet(section, index, 0);
    }

    async function removeBullet(section: GuideSection, index: number) {
      const label = sectionLabel(section);
      section.bullets.splice(index, 1);
      announce(`Bullet ${index + 1} removed from ${label}.`);
      const previous = index - 1;
      if (previous >= 0) {
        await focusBullet(section, previous, bulletText(section.bullets[previous] ?? '').length);
      } else {
        await focusSection(section);
      }
    }

    async function removeSection(section: GuideSection) {
      const index = props.data.sections.indexOf(section);
      if (index < 0) return;
      const label = sectionLabel(section);
      props.data.sections.splice(index, 1);
      announce(`${label} removed.`);
      const target = props.data.sections[index] ?? props.data.sections[index - 1];
      if (target) await focusSection(target);
      else {
        await nextTick();
        addSectionButton.value?.focus();
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

      const indent = event.ctrlKey && !event.altKey && !event.metaKey && event.key === ']';
      const outdent = event.ctrlKey && !event.altKey && !event.metaKey && event.key === '[';
      if (indent || outdent) {
        if (outdent) {
          if (depth === 0) return;
          event.preventDefault();
          section.bullets[index] = withBulletDepth(text, depth - 1);
          announce(`Bullet ${index + 1}, level ${depth}.`);
          void focusBullet(section, index, start);
          return;
        }
        if (index === 0) return;
        const previousDepth = bulletDepth(section.bullets[index - 1] ?? '');
        const maxDepth = Math.min(MAX_BULLET_DEPTH, previousDepth + 1);
        if (depth >= maxDepth) return;
        event.preventDefault();
        section.bullets[index] = withBulletDepth(text, depth + 1);
        announce(`Bullet ${index + 1}, level ${depth + 2}.`);
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
      h('p', { class: 'visually-hidden' },
        'List editor keyboard help. Tab moves between controls. Enter splits or adds a bullet. Control right bracket indents a bullet. Control left bracket outdents a bullet. Backspace on an empty bullet removes it.'),
      props.data.sections.length ? h('div', { class: 'study-guide-sections' }, props.data.sections.map((section, si) => {
        const headingId = `study-guide-section-${section.id}-heading`;
        const sectionName = section.title.trim() || `Section ${si + 1}`;
        return h('section', { key: section.id, class: 'study-guide-section' }, [
          h('h3', { id: headingId, class: 'visually-hidden' }, `Section ${si + 1}: ${section.title.trim() || 'Untitled'}`),
          h('div', { class: 'study-guide-section-heading' }, [
            h('input', {
              ref: (element) => {
                if (element instanceof HTMLInputElement) titleFields.set(section.id, element);
                else titleFields.delete(section.id);
              },
              class: 'study-guide-section-title', value: section.title, maxlength: MAX_TEXT_LENGTH,
              placeholder: 'Title', 'aria-label': `Section ${si + 1} title`,
              onInput: (event: Event) => { section.title = inputValue(event); },
              onKeydown: (event: KeyboardEvent) => handleTitleKeydown(event, section),
            }),
            h('button', {
              type: 'button', class: 'icon-button study-guide-remove', title: 'Remove section',
              'aria-label': `Remove ${sectionLabel(section)}`,
              onClick: () => { void removeSection(section); },
            }, '×'),
          ]),
          h('ul', { class: 'study-guide-bullets', 'aria-label': `Bullets for ${sectionName}` }, section.bullets.map((bullet, bi) => {
            const depth = bulletDepth(bullet);
            const text = bulletText(bullet);
            return h('li', {
              key: `${section.id}-${bi}`,
              class: 'study-guide-bullet-row',
              'aria-level': depth + 1,
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
                'aria-label': `Bullet ${bi + 1} in ${sectionName}, level ${depth + 1}`,
                'aria-keyshortcuts': 'Control+] Control+[',
                onInput: (event: Event) => { section.bullets[bi] = withBulletDepth(inputValue(event), depth); },
                onKeydown: (event: KeyboardEvent) => handleBulletKeydown(event, section, bi),
              }),
              h('button', {
                type: 'button', class: 'icon-button study-guide-remove', title: 'Remove bullet',
                'aria-label': `Remove bullet ${bi + 1} from ${sectionName}`,
                onClick: () => { void removeBullet(section, bi); },
              }, '×'),
            ]);
          })),
          h('button', {
            type: 'button', class: 'quiet-button study-guide-add-bullet', disabled: bulletCount() >= MAX_BULLETS,
            'aria-label': `Add bullet to ${sectionName}`,
            onClick: () => { void addBullet(section); },
          }, '+ Bullet'),
        ]);
      })) : h('div', { class: 'study-guide-list-empty' }, [
        h('p', 'Add a title, then put the things you need to remember underneath it.'),
      ]),
      h('button', {
        ref: addSectionButton,
        type: 'button', class: 'quiet-button study-guide-add-section', disabled: props.data.sections.length >= MAX_SECTIONS,
        onClick: () => { void addSection(); },
      }, '+ Title'),
      h('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, message.value),
    ]);
  },
});
