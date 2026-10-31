import { useStudySession } from '../../components/use-study-session.ts';
import { useStatistics } from '../../components/statistics-context.ts';
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onDeactivated, ref, type PropType } from 'vue';
import { GuideTypeIcon } from './guide-type-icon.ts';
import { TeachingLessonView } from './teaching-lesson.ts';
import { CONTINUE_ARRIVAL_PAUSE_MS, REDUCED_MOTION_ARRIVAL_PAUSE_MS, mayOpenContinuedStop } from './map-study-arrival.ts';
import { lessonForTopic } from './teaching-blocks.ts';
import { connectedTopicIds, mapStudyProblem, startTopic, topicById } from './map-graph.ts';
import { MAP_CANVAS_HEIGHT, MAP_CANVAS_WIDTH, MAP_PADDING } from './map-presentation.ts';
import { GUIDE_MAP_DEFAULT_PATTERN, type GuideMapPattern } from './library-model.ts';
import { GuideMapBackdrop, type GuideMapBackdropHandle } from './map-background.ts';
import { GuideMapMotionToggle } from './map-motion-toggle.ts';
import {
  MAP_HEIGHT, MAP_TOPIC_HEIGHT, MAP_TOPIC_WIDTH, MAP_WIDTH,
  type MapGuideData, type MapStudySession, type MapTopic,
} from './library-model.ts';

export const GuideMapStudy = defineComponent({
  name: 'GuideMapStudy',
  props: {
    data: { type: Object as PropType<MapGuideData>, required: true },
    guideName: { type: String, required: true },
    statisticsId: { type: String, required: true },
    motionPaused: { type: Boolean, default: false },
  },
  emits: { edit: () => true, toggleMotion: () => true },
  setup(props, { emit }) {
    const saved = props.data.session;
    const statistics = useStatistics();
    let completionRecorded = Boolean(saved && saved.visitedIds.length === props.data.topics.length);
    const started = ref(Boolean(saved && saved.openedIds.length > 0 && !saved.paused && topicById(props.data, saved.currentId)));
    useStudySession(started);
    const visited = ref(new Set(saved?.visitedIds ?? []));
    const opened = ref(new Set(saved?.openedIds ?? []));
    const skipped = ref(new Set(saved?.skippedIds ?? []));
    const currentId = ref<string | null>(saved?.currentId ?? null);
    const path = ref<string[]>([]);
    const responsesByTopic = ref<Record<string, Record<string, string>>>({ ...saved?.responses });
    const travelling = ref(false);
    const arriving = ref(false);
    const focused = ref(false);
    const travelTargetId = ref<string | null>(null);
    // Destination-only arrival pulse; the starting prompt has its own lifecycle.
    const arrivalHighlightId = ref<string | null>(null);
    const backdrop = ref<GuideMapBackdropHandle | null>(null);
    function celebrateArrival(id: string) {
      const stop = topicById(props.data, id);
      if (!stop) return;
      backdrop.value?.interactAt(
        stop.x + MAP_PADDING + MAP_TOPIC_WIDTH / 2,
        stop.y + MAP_PADDING + MAP_TOPIC_HEIGHT / 2,
      );
    }
    const scroll = ref<HTMLElement | null>(null);
    const topicHeading = ref<HTMLElement | null>(null);
    const topicPanel = ref<HTMLElement | null>(null);
    const viewMapButton = ref<HTMLButtonElement | null>(null);
    const camera = ref<{ x: number; y: number; scale: number } | null>(null);
    const cameraZooming = ref(false);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timers = new Set<number>();
    let pendingContinueOpen: number | null = null;
    function cancelContinueOpen() {
      if (pendingContinueOpen === null) return;
      window.clearTimeout(pendingContinueOpen);
      timers.delete(pendingContinueOpen);
      pendingContinueOpen = null;
    }

    const current = computed(() => topicById(props.data, currentId.value));
    const studyProblem = computed(() => mapStudyProblem(props.data));
    const visitedCount = computed(() => visited.value.size);
    const complete = computed(() => props.data.topics.length > 0 && visited.value.size === props.data.topics.length);
    // Keep the starting marker inviting until the first stop is actually opened.
    // Deriving from saved opened IDs also preserves the cue after resume/reload.
    const startPromptVisible = computed(() => {
      const first = startTopic(props.data);
      return started.value && !arriving.value && first !== null && !opened.value.has(first.id);
    });

    const currentLesson = computed(() => current.value ? lessonForTopic(current.value) : null);
    const currentResponses = computed(() => currentId.value ? responsesByTopic.value[currentId.value] ?? {} : {});
    function answerBlock(blockId: string, response: string) {
      if (!currentId.value) return;
      responsesByTopic.value = {
        ...responsesByTopic.value,
        [currentId.value]: { ...currentResponses.value, [blockId]: response },
      };
      saveSession();
    }
    function resetLessonInteractions() {
      if (!currentId.value) return;
      const next = { ...responsesByTopic.value };
      delete next[currentId.value];
      responsesByTopic.value = next;
      saveSession();
      nextTick(() => { topicHeading.value?.focus({ preventScroll: true }); });
    }
    function finishLesson() {
      if (!currentId.value || travelling.value || arriving.value) return;
      skipped.value = new Set([...skipped.value].filter(id => id !== currentId.value));
      markVisited(currentId.value);
      saveSession();
    }

    const available = computed(() => currentId.value
      ? connectedTopicIds(props.data, currentId.value).filter(id => !visited.value.has(id))
      : []);

    function pathTo(targetId: string): string[] {
      const first = startTopic(props.data);
      if (!first) return [targetId];
      const reached = new Set<string>([first.id]);
      const queue: { id: string; route: string[] }[] = [{ id: first.id, route: [first.id] }];
      while (queue.length) {
        const next = queue.shift();
        if (!next) break;
        if (next.id === targetId) return next.route;
        for (const neighbor of connectedTopicIds(props.data, next.id)) {
          if (reached.has(neighbor)) continue;
          reached.add(neighbor);
          queue.push({ id: neighbor, route: [...next.route, neighbor] });
        }
      }
      return [targetId];
    }
    path.value = currentId.value ? pathTo(currentId.value) : [];

    function isUnlocked(id: string): boolean {
      if (!started.value || arriving.value || travelling.value) return false;
      return id === currentId.value || opened.value.has(id) ||
        connectedTopicIds(props.data, id).some(neighbor => visited.value.has(neighbor));
    }

    function saveSession() {
      // Merely watching the map intro isn't study progress. Leave the adventure
      // unstarted until the learner actually opens a stop.
      if (!opened.value.size) {
        delete props.data.session;
        return;
      }
      const id = currentId.value;
      if (!id) return;
      const session: MapStudySession = {
        paused: !started.value,
        currentId: id,
        openedIds: [...opened.value],
        visitedIds: [...visited.value],
        skippedIds: [...skipped.value],
        revealed: {},
        responses: { ...responsesByTopic.value },
      };
      props.data.session = session;
    }

    if (started.value && currentId.value) {
      nextTick(() => { if (currentId.value) focusTopic(currentId.value, 'instant'); });
    }

    function clearTimers() {
      cancelContinueOpen();
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      travelling.value = false;
      arriving.value = false;
      camera.value = null;
      cameraZooming.value = false;
      travelTargetId.value = null;
      arrivalHighlightId.value = null;
    }

    onBeforeUnmount(clearTimers);
    onDeactivated(clearTimers);

    function later(callback: () => void, delay: number) {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
    }

    function focusTopic(id: string, behavior: ScrollBehavior) {
      nextTick(() => {
        const topic = topicById(props.data, id);
        const container = scroll.value;
        if (!topic || !container) return;
        container.scrollTo({
          left: Math.max(0, topic.x + MAP_PADDING + MAP_TOPIC_WIDTH / 2 - container.clientWidth / 2),
          top: Math.max(0, topic.y + MAP_PADDING + MAP_TOPIC_HEIGHT / 2 - container.clientHeight / 2),
          behavior,
        });
      });
    }

    function showTopic() {
      arrivalHighlightId.value = null;
      nextTick(() => {
        focused.value = true;
        nextTick(() => { topicHeading.value?.focus({ preventScroll: true }); });
      });
    }

    function closeTopic() {
      cancelContinueOpen();
      focused.value = false;
      nextTick(() => { viewMapButton.value?.focus({ preventScroll: true }); });
    }

    function markVisited(id: string) {
      if (visited.value.has(id)) return;
      const next = new Set(visited.value);
      next.add(id);
      visited.value = next;
      if (complete.value && !completionRecorded) {
        statistics?.record('guide', props.statisticsId, 'adventuresCompleted');
        completionRecorded = true;
      }
    }

    function prepareCurrent() {
      const topic = current.value;
      if (!topic) return;
      topicPanel.value?.scrollTo({ top: 0, behavior: 'instant' });
    }

    function start(animate = true) {
      clearTimers();
      if (studyProblem.value) return;
      const first = startTopic(props.data);
      if (!first) return;
      statistics?.record('guide', props.statisticsId, 'adventuresStarted');
      completionRecorded = false;
      visited.value = new Set();
      opened.value = new Set();
      skipped.value = new Set();
      focused.value = false;
      arriving.value = animate && !reducedMotion.matches;
      arrivalHighlightId.value = null;
      currentId.value = first.id;
      path.value = [first.id];
      responsesByTopic.value = {};
      started.value = true;
      prepareCurrent();
      saveSession();

      if (!animate || reducedMotion.matches) {
        focusTopic(first.id, 'instant');
        arriving.value = false;
        celebrateArrival(first.id);
        return;
      }

      nextTick(() => {
        const container = scroll.value;
        if (!container || !started.value || currentId.value !== first.id) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (!width || !height) {
          arriving.value = false;
          return;
        }

        // Preview the full map in the existing viewport before moving the camera.
        // The destination is the exact scroll position of the normal 100% map:
        // the animated camera can be swapped for native scrolling without a jump.
        const scale = Math.min(1, width / MAP_CANVAS_WIDTH, height / MAP_CANVAS_HEIGHT);
        const destinationX = Math.max(0, Math.min(MAP_CANVAS_WIDTH - width, first.x + MAP_PADDING + MAP_TOPIC_WIDTH / 2 - width / 2));
        const destinationY = Math.max(0, Math.min(MAP_CANVAS_HEIGHT - height, first.y + MAP_PADDING + MAP_TOPIC_HEIGHT / 2 - height / 2));
        container.scrollTo({ left: 0, top: 0, behavior: 'instant' });
        camera.value = {
          x: (width - MAP_CANVAS_WIDTH * scale) / 2,
          y: (height - MAP_CANVAS_HEIGHT * scale) / 2,
          scale,
        };
        later(() => {
          cameraZooming.value = true;
          camera.value = { x: -destinationX, y: -destinationY, scale: 1 };
          later(() => {
            container.scrollTo({ left: destinationX, top: destinationY, behavior: 'instant' });
            cameraZooming.value = false;
            camera.value = null;
            arriving.value = false;
            celebrateArrival(first.id);
          }, 1050);
        }, 260);
      });
    }

    function restart() {
      focused.value = false;
      started.value = false;
      nextTick(() => start(true));
    }

    function resumeAdventure() {
      clearTimers();
      started.value = true;
      focused.value = false;
      arriving.value = false;
      saveSession();
      if (currentId.value) focusTopic(currentId.value, 'instant');
    }

    function returnToOverview() {
      clearTimers();
      focused.value = false;
      started.value = false;
      saveSession();
    }

    function skipSection() {
      const topic = current.value;
      if (!topic || visited.value.has(topic.id) || travelling.value || arriving.value) return;
      skipped.value = new Set([...skipped.value, topic.id]);
      markVisited(topic.id);
      saveSession();
      // Skipping isn't revealing the remaining content. Carry on automatically
      // when there is one route, or backtrack from a finished dead-end.
      if (available.value.length === 1) {
        visitNext(available.value[0]);
      } else if (available.value.length === 0 && backtrackPlan()) {
        backtrack();
      }
      // Multiple routes still require the learner to choose one.
    }

    function travelTo(targetId: string, after: () => void) {
      if (travelling.value) return;
      cancelContinueOpen();
      const duration = reducedMotion.matches ? 0 : 520;
      focused.value = false;
      arrivalHighlightId.value = null;
      travelling.value = true;
      travelTargetId.value = targetId;
      focusTopic(targetId, reducedMotion.matches ? 'auto' : 'smooth');
      later(() => {
        currentId.value = targetId;
        travelTargetId.value = null;
        travelling.value = false;
        arrivalHighlightId.value = targetId;
        celebrateArrival(targetId);
        after();
      }, duration);
    }

    // The traveler finishes moving before the destination begins pulsing.
    // Continue and direct map navigation use the same cancellable delay.
    function scheduleArrivalOpen(targetId: string) {
      cancelContinueOpen();
      pendingContinueOpen = window.setTimeout(() => {
        const timer = pendingContinueOpen;
        pendingContinueOpen = null;
        if (timer !== null) timers.delete(timer);
        if (!mayOpenContinuedStop({
          started: started.value, travelling: travelling.value,
          arriving: arriving.value, currentId: currentId.value,
          targetId, focused: focused.value,
        })) return;
        opened.value = new Set([...opened.value, targetId]);
        saveSession();
        showTopic();
      }, reducedMotion.matches || props.motionPaused ? REDUCED_MOTION_ARRIVAL_PAUSE_MS : CONTINUE_ARRIVAL_PAUSE_MS);
      timers.add(pendingContinueOpen);
    }

    function visitNext(targetId: string) {
      if (!currentId.value || !available.value.includes(targetId)) return;
      travelTo(targetId, () => {
        path.value = pathTo(targetId);
        prepareCurrent();
        saveSession();
        scheduleArrivalOpen(targetId);
      });
    }

    function openStop(id: string) {
      if (!isUnlocked(id)) return;
      cancelContinueOpen();
      if (id === currentId.value) {
        celebrateArrival(id);
        opened.value = new Set([...opened.value, id]);
        prepareCurrent();
        saveSession();
        showTopic();
        return;
      }
      travelTo(id, () => {
        path.value = pathTo(id);
        prepareCurrent();
        saveSession();
        scheduleArrivalOpen(id);
      });
    }

    function resumeSkippedStop() {
      const id = currentId.value;
      if (!id || !skipped.value.has(id)) return;
      skipped.value = new Set([...skipped.value].filter(entry => entry !== id));
      visited.value = new Set([...visited.value].filter(entry => entry !== id));
      saveSession();
    }

    function backtrackPlan(): { route: string[]; ancestorId: string } | null {
      if (!currentId.value || available.value.length || path.value.length < 2) return null;
      for (let index = path.value.length - 2; index >= 0; index -= 1) {
        const ancestorId = path.value[index];
        const unvisited = connectedTopicIds(props.data, ancestorId).filter(id => !visited.value.has(id));
        if (!unvisited.length) continue;
        return {
          route: path.value.slice(index, path.value.length - 1).reverse(),
          ancestorId,
        };
      }
      return null;
    }

    function backtrack() {
      const plan = backtrackPlan();
      if (!plan || travelling.value) return;
      const { route, ancestorId } = plan;
      const duration = reducedMotion.matches ? 0 : 520;
      arrivalHighlightId.value = null;
      focused.value = false;
      travelling.value = true;

      function step(index: number) {
        const targetId = route[index];
        if (!targetId) {
          currentId.value = ancestorId;
          path.value = path.value.slice(0, path.value.indexOf(ancestorId) + 1);
          travelTargetId.value = null;
          travelling.value = false;
          topicPanel.value?.scrollTo({ top: 0, behavior: 'instant' });
          // A single remaining trail is not a choice: follow it without
          // reopening the already studied stop or requiring another click.
          const onward = connectedTopicIds(props.data, ancestorId).filter(id => !visited.value.has(id));
          saveSession();
          if (onward.length === 1) visitNext(onward[0]);
          else {
            arrivalHighlightId.value = ancestorId;
            celebrateArrival(ancestorId);
          }
          return;
        }
        travelTargetId.value = targetId;
        focusTopic(targetId, reducedMotion.matches ? 'auto' : 'smooth');
        later(() => {
          currentId.value = targetId;
          // Intermediate backtracking stops are not the final destination.
          step(index + 1);
        }, duration);
      }

      step(0);
    }

    function connectionLine(connection: MapGuideData['connections'][number]) {
      const from = topicById(props.data, connection.from);
      const to = topicById(props.data, connection.to);
      if (!from || !to) return null;
      const active = currentId.value && travelTargetId.value &&
        ((connection.from === currentId.value && connection.to === travelTargetId.value) ||
         (connection.to === currentId.value && connection.from === travelTargetId.value));
      return h('line', {
        key: connection.id,
        x1: from.x + MAP_TOPIC_WIDTH / 2,
        y1: from.y + MAP_TOPIC_HEIGHT / 2,
        x2: to.x + MAP_TOPIC_WIDTH / 2,
        y2: to.y + MAP_TOPIC_HEIGHT / 2,
        class: { 'is-travelling': active },
      });
    }

    function routeControls(topic: MapTopic) {
      if (!visited.value.has(topic.id) || travelling.value) return null;
      if (complete.value) return h('div', { class: 'guide-study-finished', role: 'status' }, [
        h('strong', 'Map complete'),
        h('p', skipped.value.size
          ? 'You reached every stop, including ' + skipped.value.size + (skipped.value.size === 1 ? ' skipped section.' : ' skipped sections.')
          : 'You visited every topic on this study route.'),
        h('div', { class: 'guide-study-actions' }, [
          h('button', { type: 'button', class: 'card-primary-button', onClick: restart }, 'Study again'),
          h('button', { type: 'button', class: 'quiet-button', onClick: returnToOverview }, 'Return to overview'),
        ]),
      ]);

      if (available.value.length > 1) {
        return h('div', { class: 'guide-study-branch' }, [
          h('strong', 'Choose the next path'),
          h('p', 'This stop branches. Pick which unvisited topic to study next.'),
          h('div', { class: 'guide-study-branch-actions' }, available.value.map(id => {
            const next = topicById(props.data, id);
            return next ? h('button', {
              key: id, type: 'button', class: 'quiet-button guide-study-action',
              onClick: () => visitNext(id),
            }, next.title || 'Untitled topic') : null;
          })),
        ]);
      }

      if (available.value.length === 1) {
        const next = topicById(props.data, available.value[0]);
        return next ? h('button', {
          type: 'button', class: 'quiet-button guide-study-action',
          onClick: () => visitNext(next.id),
        }, 'Continue to ' + (next.title || 'next topic')) : null;
      }

      const plan = backtrackPlan();
      if (plan) {
        const ancestor = topicById(props.data, plan.ancestorId);
        return h('div', { class: 'guide-study-backtrack' }, [
          h('p', 'This branch is finished. Go back along the path to continue the map.'),
          h('button', { type: 'button', class: 'quiet-button guide-study-action', onClick: backtrack },
            'Backtrack to ' + (ancestor?.title || 'previous fork')),
        ]);
      }
      return null;
    }

    return () => {
      if (!started.value) {
        const paused = props.data.session !== undefined && props.data.session.openedIds.length > 0 &&
          topicById(props.data, props.data.session.currentId) !== null;
        return h('section', { class: 'guide-study-intro', 'aria-label': 'Map study overview' }, [
          h('header', { class: 'guide-study-intro-header' }, [
            h('div', { class: 'guide-study-intro-art', 'aria-hidden': 'true' }, [
              h(GuideTypeIcon, { mode: 'map' }),
            ]),
            h('div', [
              h('p', { class: 'guide-study-kicker' }, paused ? 'Your adventure is waiting' : 'Ready to explore?'),
              h('h3', props.guideName),
              h('p', paused
                ? 'Pick up right where you left off, with your completed stops and interactive choices intact.'
                : 'Discover the trail, explore interactive mini-lessons, and learn at your own pace.'),
            ]),
          ]),
          h('div', { class: 'guide-study-pills', 'aria-label': 'Session details' }, [
            h('span', props.data.topics.length + (props.data.topics.length === 1 ? ' topic' : ' topics')),
            h('span', props.data.connections.length + (props.data.connections.length === 1 ? ' path' : ' paths')),
            h('span', 'No score or timer'),
          ]),
          h('div', { class: 'guide-study-expect' }, [
            h('h4', 'What to expect'),
            h('p', 'Open any unlocked stop to explore its teaching blocks. Complete a lesson when you feel ready to move forward, or skip it and return later. The map remembers your progress and choices.'),
          ]),
          studyProblem.value ? h('p', { class: 'guide-map-status', role: 'status' }, studyProblem.value) : null,
          h('div', { class: 'guide-study-actions' }, [
            paused ? [
              h('button', {
                type: 'button', class: 'card-primary-button', disabled: studyProblem.value !== null,
                onClick: resumeAdventure,
              }, 'Resume adventure'),
              h('button', {
                type: 'button', class: 'quiet-button', disabled: studyProblem.value !== null,
                onClick: () => start(true),
              }, 'Start over'),
            ] : h('button', {
              type: 'button', class: 'card-primary-button', disabled: studyProblem.value !== null,
              onClick: () => start(true),
            }, 'Start adventure'),
            h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('edit') }, 'Edit map'),
          ]),
        ]);
      }

      const topic = current.value;
      if (!topic) return null;
      const currentVisited = visited.value.has(topic.id);
      const travelerId = travelTargetId.value ?? currentId.value;
      const traveler = topicById(props.data, travelerId);
      const pattern: GuideMapPattern = props.data.background ?? GUIDE_MAP_DEFAULT_PATTERN;

      return h('div', { class: 'guide-study-session' }, [
        h('div', { class: 'guide-study-toolbar' }, [
          h('div', [
            h('strong', topic.title || 'Untitled topic'),
            h('span', visitedCount.value + ' of ' + props.data.topics.length + ' visited'
              + (skipped.value.size ? ' (' + skipped.value.size + ' skipped)' : '')),
          ]),
          h('div', { class: 'guide-study-toolbar-actions' }, [
            h('button', {
              ref: viewMapButton, type: 'button', class: 'quiet-button', disabled: travelling.value || arriving.value,
              onClick: () => {
                if (focused.value) closeTopic();
                else if (currentId.value) openStop(currentId.value);
              },
            }, focused.value ? 'View map' : 'View lesson'),
            h('button', {
              type: 'button', class: 'quiet-button',
              title: 'Leave the adventure. Your progress is saved.',
              onClick: returnToOverview,
            }, 'Save & exit'),
          ]),
        ]),
        h('div', { class: ['guide-study-layout', { 'is-map-motion-paused': props.motionPaused }] }, [
          h('div', {
            ref: scroll,
            class: ['guide-study-map-scroll', { 'is-cinematic': camera.value !== null }],
            inert: focused.value,
          }, [
            h('div', {
              class: ['guide-study-map', 'guide-map-surface', 'is-pattern-' + pattern,
                { 'is-camera-zooming': cameraZooming.value }],
              style: {
                width: MAP_CANVAS_WIDTH + 'px',
                height: MAP_CANVAS_HEIGHT + 'px',
                ...(camera.value ? {
                  transform: `translate(${camera.value.x}px, ${camera.value.y}px) scale(${camera.value.scale})`,
                } : {}),
              },
              'aria-label': 'Study route map',
              onClick: (event: MouseEvent) => {
                if (event.target !== event.currentTarget) return;
                const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
                if (!bounds.width || !bounds.height) return;
                backdrop.value?.interactAt(
                  (event.clientX - bounds.left) * MAP_CANVAS_WIDTH / bounds.width,
                  (event.clientY - bounds.top) * MAP_CANVAS_HEIGHT / bounds.height,
                );
              },
            }, [
              h(GuideMapBackdrop, { ref: backdrop, pattern, paused: focused.value || props.motionPaused }),
              h('svg', {
                class: 'guide-study-route',
                style: { left: MAP_PADDING + 'px', top: MAP_PADDING + 'px' },
                viewBox: '0 0 ' + MAP_WIDTH + ' ' + MAP_HEIGHT,
                width: MAP_WIDTH, height: MAP_HEIGHT, 'aria-hidden': 'true',
              }, props.data.connections.map(connectionLine)),
              ...props.data.topics.map((entry, index) => {
                const unlocked = isUnlocked(entry.id);
                return h('button', {
                  key: entry.id,
                  type: 'button',
                  disabled: !unlocked,
                  class: ['guide-study-stop', {
                    'is-current': entry.id === currentId.value,
                    'is-visited': visited.value.has(entry.id),
                    'is-skipped': skipped.value.has(entry.id),
                    'is-opened': opened.value.has(entry.id),
                    'is-unlocked': unlocked,
                    'is-target': entry.id === travelTargetId.value,
                    'is-arrival-highlight': arrivalHighlightId.value === entry.id ||
                      (startPromptVisible.value && entry.id === startTopic(props.data)?.id),
                    'is-start-prompt': startPromptVisible.value && entry.id === startTopic(props.data)?.id,
                    'is-start-near-top': entry.y < 64,
                  }],
                  style: { left: entry.x + MAP_PADDING + 'px', top: entry.y + MAP_PADDING + 'px' },
                  'aria-label': (startPromptVisible.value && entry.id === startTopic(props.data)?.id
                    ? 'Start here: ' : unlocked ? 'Open ' : 'Locked: ') + (entry.title || 'Untitled topic') +
                    (opened.value.has(entry.id) ? ', previously opened' : ''),
                  title: unlocked ? 'Open ' + (entry.title || 'Untitled topic') :
                    (entry.title || 'Untitled topic') + ' — complete a connected stop to unlock',
                  onClick: () => openStop(entry.id),
                }, [
                  h('span', { class: 'guide-topic-number' },
                    skipped.value.has(entry.id) ? '↷' : visited.value.has(entry.id) ? '✓' : String(index + 1)),
                  h('span', { class: 'guide-topic-name', title: entry.title || 'Untitled topic' }, entry.title || 'Untitled topic'),
                ]);
              }),
              traveler ? h('span', {
                class: ['guide-traveler', { 'is-moving': travelling.value }],
                style: {
                  left: traveler.x + MAP_PADDING + MAP_TOPIC_WIDTH / 2 + 'px',
                  top: traveler.y + MAP_PADDING + MAP_TOPIC_HEIGHT / 2 + 'px',
                },
                'aria-hidden': 'true',
              }) : null,
            ]),
          ]),
          h(GuideMapMotionToggle, {
            paused: props.motionPaused,
            inert: focused.value,
            'aria-hidden': focused.value,
            onToggle: () => emit('toggleMotion'),
          }),
          !focused.value ? h('p', { class: 'guide-study-map-hint', role: 'status' },
            arriving.value ? 'Finding your starting point…'
              : travelling.value ? 'Following the route…'
              : complete.value ? 'Map complete! Select any unlocked stop to revisit its lesson.'
              : 'Select an unlocked stop to explore its lesson.') : null,
          h('section', {
            ref: topicPanel,
            class: ['guide-study-topic', { 'is-visible': focused.value && !travelling.value }],
            'aria-hidden': !focused.value || travelling.value,
            inert: !focused.value || travelling.value,
            'aria-label': 'Current topic lesson',
          }, [
            h('div', { class: 'guide-study-close-row' }, [
              h('button', {
                type: 'button',
                class: 'icon-button guide-study-close',
                title: 'View map',
                'aria-label': 'Close lesson and view map',
                onClick: closeTopic,
              }, '×'),
            ]),
            h('div', { class: 'guide-study-topic-inner' }, [
            travelling.value ? h('div', { class: 'guide-study-travelling' }, [
              h('strong', 'Following the path…'),
              h('p', 'Moving to the next stop.'),
            ]) : [
              h('div', { class: 'guide-study-topic-heading' }, [
                h('span', skipped.value.has(topic.id) ? 'Skipped' : currentVisited ? 'Visited' : 'Current stop'),
                h('h3', { ref: topicHeading, tabindex: -1 }, topic.title || 'Untitled topic'),
                topic.description?.trim()
                  ? h('p', { class: 'guide-study-topic-description' }, topic.description.trim())
                  : null,
              ]),
              currentLesson.value ? h(TeachingLessonView, {
                key: topic.id, lesson: currentLesson.value, responses: currentResponses.value, onAnswer: answerBlock,
              }) : null,
              h('div', { class: 'guide-lesson-footer' }, [
                !currentVisited && !skipped.value.has(topic.id) ? h('button', {
                  type: 'button', class: 'card-primary-button', onClick: finishLesson,
                }, 'Finish lesson') : null,
                !currentVisited && !skipped.value.has(topic.id) ? h('button', {
                  type: 'button', class: 'quiet-button guide-study-skip', onClick: skipSection,
                }, 'Skip this lesson') : null,
                skipped.value.has(topic.id) ? h('button', {
                  type: 'button', class: 'quiet-button', onClick: resumeSkippedStop,
                }, 'Return to this lesson') : null,
                Object.keys(currentResponses.value).length ? h('button', {
                  type: 'button', class: 'quiet-button guide-study-reset', onClick: resetLessonInteractions,
                }, 'Reset lesson interactions') : null,
                currentVisited && !skipped.value.has(topic.id) ? h('p', {
                  class: 'guide-study-visited-note', role: 'status',
                }, 'Lesson completed. You can return and explore it again any time.') : null,
              ]),
              routeControls(topic),
            ],
            ]),
          ]),
        ]),
      ]);
    };
  },
});
