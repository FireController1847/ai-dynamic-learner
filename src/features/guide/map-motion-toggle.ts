import { defineComponent, h } from 'vue';
import { Icon } from '../../components/icon.ts';

/** Presentation-only control; the parent owns the transient pause preference. */
export const GuideMapMotionToggle = defineComponent({
  name: 'GuideMapMotionToggle',
  props: { paused: { type: Boolean, required: true } },
  emits: { toggle: () => true },
  setup(props, { emit }) {
    return () => h('button', {
      type: 'button',
      class: 'guide-map-motion-toggle',
      'aria-label': props.paused ? 'Resume map animations' : 'Pause map animations',
      'aria-pressed': props.paused,
      title: props.paused ? 'Resume map animations' : 'Pause map animations',
      onClick: () => emit('toggle'),
    }, [h(Icon, { name: props.paused ? 'play' : 'pause' })]);
  },
});
