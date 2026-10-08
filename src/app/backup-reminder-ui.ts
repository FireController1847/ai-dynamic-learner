import { defineComponent, h, type PropType } from 'vue';
import { Icon } from '../components/icon.ts';
import type { BackupReminders } from './backup-reminders.ts';

export const BackupReminderBanner = defineComponent({
  name: 'BackupReminderBanner',
  props: { reminders: { type: Object as PropType<BackupReminders>, required: true } },
  emits: { backup: () => true },
  setup(props, { emit }) {
    return () => props.reminders.showBanner.value ? h('aside', {
      class: ['backup-reminder-banner', `is-stage-${props.reminders.legacy.value ? 1 : props.reminders.stage.value}`],
      role: 'region',
      'aria-label': 'Backup reminder',
    }, [
      h('div', { class: 'backup-reminder-copy' }, [
        h('strong', [
          h(Icon, { name: 'download' }),
          props.reminders.legacy.value ? 'Protect your saved work' :
            props.reminders.stage.value === 3 ? 'Your work needs a backup' :
              props.reminders.stage.value === 2 ? 'Time to back up your changes' : 'Consider making a backup',
        ]),
        h('p', 'Dynamic Learner saves work in this browser. Download a backup so browser changes or lost storage do not erase your progress.'),
      ]),
      h('div', { class: 'backup-reminder-actions' }, [
        h('button', { type: 'button', class: 'card-primary-button', onClick: () => emit('backup') }, 'Back Up Now'),
        h('button', { type: 'button', class: 'quiet-button', onClick: props.reminders.snooze }, 'Remind Me Later'),
        h('button', {
          type: 'button', class: 'icon-button', title: 'Dismiss for this session',
          'aria-label': 'Dismiss backup reminder for this session',
          onClick: props.reminders.dismiss,
        }, '×'),
      ]),
    ]) : null;
  },
});
