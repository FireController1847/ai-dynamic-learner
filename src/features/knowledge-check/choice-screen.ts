import { h, type VNodeChild } from 'vue';
import { Icon } from '../../components/icon.ts';

interface ReviewChoice<Id extends string> {
  id: Id;
  label: string;
  description: string;
  icon: string;
  disabled?: boolean;
  detail?: VNodeChild;
}

/** Review and Publish share the same screen, cards, and responsive styles. */
export function reviewChoiceScreen<Id extends string>(options: {
  key?: string;
  eyebrow: string;
  title: string;
  description: string;
  choices: readonly ReviewChoice<Id>[];
  onChoose: (id: Id) => void;
  onBack?: () => void;
  footer?: VNodeChild;
}): VNodeChild {
  return h('section', { key: options.key, class: 'knowledge-check-builder', 'aria-label': options.eyebrow }, [
    h('header', { class: 'knowledge-choice-screen-header' }, [
      h('div', { class: 'knowledge-check-builder-intro' }, [
        h('p', { class: 'knowledge-check-builder-eyebrow' }, options.eyebrow),
        h('h2', { 'data-review-focus': '', tabindex: -1 }, options.title),
        h('p', options.description),
      ]),
      options.onBack ? h('button', { type: 'button', class: 'quiet-button', onClick: options.onBack }, 'Back') : null,
    ]),
    h('div', { class: 'knowledge-check-type-grid' }, options.choices.map(choice =>
      h('button', {
        key: choice.id, type: 'button', class: 'knowledge-check-type-card', disabled: choice.disabled,
        'data-review-choice': choice.id, onClick: () => options.onChoose(choice.id),
      }, [
        h(Icon, { name: choice.icon, class: 'knowledge-check-type-icon' }),
        h('span', { class: 'knowledge-check-type-copy' }, [
          h('strong', choice.label), h('span', choice.description), choice.detail,
        ]),
      ]))),
    options.footer,
  ]);
}
