import type { TipsHandle } from '../../packages/tips/src/index.ts';
import '../styles/index.css';
import { appConfig } from './app-config.ts';
import { features } from '../features/feature-registry.ts';
import { NavigationDrawer } from './navigation-drawer.ts';
import { pageHref, useNavigation } from './navigation.ts';
import { useWorkspace } from './workspace.ts';
import { provideStatistics } from '../components/statistics-context.ts';
import { GlobalStatistics } from '../components/global-statistics.ts';
import { WorkspaceTools } from './workspace-tools.ts';
import { BackupReminderBanner } from './backup-reminder-ui.ts';
import { ThemeMenu, type ThemeMenuHandle } from './theme-menu.ts';
import { initializeTheme } from './theme.ts';
import { HomePage } from './home-page.ts';
import { TipsExperience } from '../../packages/tips/src/index.ts';
import { tipsCatalog } from './tips-content.ts';
import { Icon } from '../components/icon.ts';
import { AppIcon } from './app-icon.ts';

import { defineComponent, type PropType, computed, createApp, h, KeepAlive, nextTick, ref } from 'vue';

initializeTheme();

const homeTipsFeature = Object.freeze({ id: 'home', label: appConfig.name });

const navigationItems = features.filter((feature) => !feature.hidden).map((item) => ({
  ...item,
  href: pageHref(item.path),
}));

if (!document.title) document.title = appConfig.name;

const App = defineComponent({
  name: 'App',
  setup() {
    const workspace = useWorkspace();
    provideStatistics({
      data: () => workspace.state.value.statistics,
      setData: data => { workspace.state.value.statistics = data; },
      inventory: () => {
        const models = workspace.state.value.features;
        return { notebook: models.notebook.items, 'todo-list': models['todo-list'].items,
          'index-cards': models['index-cards'].items, 'word-search': models['word-search'].items,
          crossword: models.crossword.items, guide: models.guide.items,
          'knowledge-check': models['knowledge-check'].items, calculator: [] };
      },
    });
    const statisticsOpen = ref(false);
    const statisticsButton = ref<HTMLButtonElement | null>(null);
    const backupMessage = ref('');
    const backupBusy = ref(false);
    async function backUpNow() {
      if (backupBusy.value) return;
      backupBusy.value = true;
      backupMessage.value = '';
      try {
        await workspace.downloadBackup();
        backupMessage.value = 'Backup download started. Check your Downloads folder to confirm the file was saved.';
      } catch (error) {
        backupMessage.value = error instanceof Error ? error.message : 'The backup could not be downloaded.';
      } finally {
        backupBusy.value = false;
      }
    }
    const sidebarOpen = ref(false);
    const menuButton = ref<HTMLButtonElement | null>(null);
    const tipsExperience = ref<TipsHandle | null>(null);
    const themeMenu = ref<ThemeMenuHandle | null>(null);
    const main = ref<HTMLElement | null>(null);
    let focusContentOnClose = false;
    const { currentPath, navigate } = useNavigation(onNavigate);
    const activeFeature = computed(() => features.find((feature) => feature.path === currentPath.value));
    const tipsFeature = computed(() => {
      const feature = activeFeature.value ?? (currentPath.value === '/' ? homeTipsFeature : null);
      return feature && tipsCatalog[feature.id]?.sections.length ? feature : null;
    });
    function closeSidebar() {
      focusContentOnClose = false;
      sidebarOpen.value = false;
    }

    async function onNavigate() {
      focusContentOnClose = true;
      if (sidebarOpen.value) {
        sidebarOpen.value = false;
      } else {
        await nextTick();
        main.value?.focus();
      }
    }

    async function restoreFocus() {
      await nextTick();
      (focusContentOnClose ? main.value : menuButton.value)?.focus();
    }

    return () => h('div', {
      class: 'app-shell',
    }, [
      h('header', { class: 'app-header' }, [
        h('button', {
          ref: menuButton,
          type: 'button',
          class: 'menu-toggle',
          'aria-label': sidebarOpen.value ? 'Close navigation' : 'Open navigation',
          'aria-expanded': sidebarOpen.value,
          'aria-controls': 'app-navigation',
          onClick: () => { sidebarOpen.value = true; },
        }, [h('svg', {
          class: 'menu-icon',
          viewBox: '0 0 18 14',
          width: 18,
          height: 14,
          fill: 'currentColor',
          'aria-hidden': 'true',
          focusable: 'false',
        }, [
          h('rect', { x: 0, y: 0, width: 18, height: 2, rx: 1 }),
          h('rect', { x: 0, y: 6, width: 18, height: 2, rx: 1 }),
          h('rect', { x: 0, y: 12, width: 18, height: 2, rx: 1 }),
        ])]),
        activeFeature.value
          ? h(AppIcon, { name: activeFeature.value.id, imageClass: 'app-logo app-header-logo' })
          : currentPath.value === '/'
            ? h(AppIcon, { name: 'dynamic-learner', imageClass: 'app-logo app-header-logo' })
            : h(Icon, { name: 'document' }),
        h('h1', activeFeature.value?.label ?? (currentPath.value === '/' ? appConfig.name : 'Page not found')),
        h('div', { class: 'app-header-actions' }, [
          h('button', {
            ref: statisticsButton, type: 'button', class: 'quiet-button app-header-action',
            title: 'Workspace statistics', 'aria-label': 'Open workspace statistics', 'aria-haspopup': 'dialog',
            onClick: () => { statisticsOpen.value = true; },
          }, [h(Icon, { name: 'statistics' }), h('span', { class: 'app-header-action-label' }, 'Statistics')]),
          workspace.backup.showIndicator.value ? h('button', {
            type: 'button',
            class: ['quiet-button', 'app-header-action', 'backup-indicator', {
              'is-urgent': workspace.backup.stage.value === 3,
            }],
            title: 'Backup needed — open Workspace backups',
            'aria-label': 'Backup needed. Open navigation to backup controls.',
            onClick: () => { sidebarOpen.value = true; },
          }, [
            h(Icon, { name: 'download' }),
            h('span', { class: 'app-header-action-label' }, 'Backup'),
          ]) : null,
          h('button', {
            type: 'button',
            class: 'quiet-button app-header-action theme-trigger',
            title: 'Theme settings',
            'aria-haspopup': 'dialog',
            onClick: (event: MouseEvent) => themeMenu.value?.open(event.currentTarget),
          }, [
            h(Icon, { name: 'theme' }),
            h('span', { class: 'app-header-action-label' }, 'Theme'),
          ]),
          tipsFeature.value ? h('button', {
            type: 'button',
            class: 'quiet-button app-header-action tips-trigger',
            title: currentPath.value === '/' ? 'Show tips' : `Show ${tipsFeature.value.label} tips`,
            'aria-haspopup': 'dialog',
            onClick: (event: MouseEvent) => tipsExperience.value?.open(event.currentTarget),
          }, [
            h(Icon, { name: 'lightbulb' }),
            h('span', { class: 'app-header-action-label tips-trigger-label' }, 'Tips'),
          ]) : null,
        ]),
      ]),
      h(NavigationDrawer, {
        open: sidebarOpen.value,
        title: appConfig.name,
        logoName: 'dynamic-learner',
        homeHref: pageHref('/'),
        items: navigationItems,
        activePath: currentPath.value,
        onClose: closeSidebar,
        onNavigate: navigate,
        onClosed: restoreFocus,
      }, {
        footer: () => h(WorkspaceTools, { workspace }),
      }),
      h(ThemeMenu, { ref: themeMenu }),
      h(TipsExperience, {
        ref: tipsExperience,
        feature: tipsFeature.value,
        catalog: tipsCatalog,
        storageKey: 'dynamic-learner.tips.v1',
      }),
      workspace.storageProblem.value ? h('p', {
        class: 'workspace-storage-warning', role: 'alert',
      }, workspace.storageProblem.value) : null,
      workspace.backup.problem.value ? h('p', {
        class: 'workspace-storage-warning', role: 'alert',
      }, workspace.backup.problem.value) : null,
      h(BackupReminderBanner, { reminders: workspace.backup, busy: backupBusy.value, onBackup: () => { void backUpNow(); } }),
      backupMessage.value ? h('p', {
        class: 'workspace-message backup-app-message', role: 'status',
      }, [
        backupMessage.value,
        h('button', {
          type: 'button', class: 'icon-button',
          'aria-label': 'Dismiss backup message', onClick: () => { backupMessage.value = ''; },
        }, '×'),
      ]) : null,
      h('div', { class: 'app-layout' }, [
        h('main', {
          ref: main,
          class: ['app-content', {
            'app-content--home': currentPath.value === '/',
            'app-content--workspace': ['notebook', 'todo-list', 'index-cards', 'word-search', 'crossword', 'guide', 'knowledge-check'].includes(activeFeature.value?.id ?? ''),
          }],
          tabindex: -1,
        }, [
          currentPath.value === '/' ? h(HomePage, { onNavigate: navigate }) : null,
          h(KeepAlive, { key: workspace.revision.value }, {
            default: () => activeFeature.value?.render(workspace.state.value.features) ?? null,
          }),
        ]),
      ]),
      statisticsOpen.value ? h(GlobalStatistics, {
        apps: features.map(feature => ({ id: feature.id, label: feature.label })), returnFocus: statisticsButton.value,
        onClose: () => { statisticsOpen.value = false; },
      }) : null,
      activeFeature.value ? h('span', {
        class: 'app-version',
      }, `v${activeFeature.value.version}`) : null,
    ]);
  },
});

createApp(App).mount('#app');
