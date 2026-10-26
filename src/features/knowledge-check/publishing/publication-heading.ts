import { h, type VNodeChild } from 'vue';
import type { PublicationMetadata } from './publication-model.ts';

/** Blank identification fields are independent of question/answer content. */
export function publicationFields(metadata: PublicationMetadata, cover = false): VNodeChild {
  const fields = (['name', 'date', 'class'] as const).filter(field => metadata[field]);
  if (!fields.length) return null;
  return h('div', { class: cover ? 'study-cover-fields' : 'study-metadata-fields' }, fields.map(field => {
    const label = field[0]!.toUpperCase() + field.slice(1);
    return h('div', { class: cover ? 'study-cover-field' : ['study-metadata-field', { 'is-name': field === 'name' }] }, [
      h('span', { class: cover ? 'study-cover-field-label' : undefined }, cover ? label : `${label}:`),
      h('span', { class: cover ? 'study-cover-field-line' : 'study-metadata-line',
        'aria-label': `Write your ${field}` }, '\u00a0'),
    ]);
  }));
}

/** Render once at a section's opening, with independently optional metadata. */
export function documentHeading(title: string, setTitle: string, metadata: PublicationMetadata,
  classes: string[], note: VNodeChild = null): VNodeChild {
  const fields = publicationFields(metadata);
  if (!metadata.headerLeft && !metadata.headerRight && !metadata.title && !fields && (!metadata.notes || !note)) return null;
  return h('header', { class: ['study-document-heading', ...classes, { 'study-heading-has-fields': Boolean(fields) }] }, [
    metadata.headerLeft || metadata.headerRight ? h('p', { class: 'study-document-eyebrow' }, [
      metadata.headerLeft ? h('span', 'DYNAMIC LEARNER / REVIEW') : null,
      metadata.headerRight ? h('span', { class: 'study-document-edition' }, title) : null,
    ]) : null,
    metadata.title ? h('h1', setTitle) : null,
    fields,
    metadata.notes ? note : null,
  ]);
}
