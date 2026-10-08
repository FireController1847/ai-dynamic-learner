import { computed, defineComponent, h, onBeforeUnmount, ref, type PropType } from 'vue';
import { createId } from '../../core/ids.ts';
import { inputValue } from '../../core/dom.ts';
import {
  connectedTopicIds, connectTopics, connectionWouldCreateCycle, mapStudyProblem, removeConnection,
  removeTopicGraphData, setStartTopic, topicById,
} from './map-graph.ts';
import {
  createListGuideData, MAP_GRID, MAP_HEIGHT, MAP_MAX_X, MAP_MAX_Y, MAP_TOPIC_HEIGHT,
  MAP_TOPIC_WIDTH, MAP_WIDTH, MAX_TEXT_LENGTH, MAX_TOPICS, type MapGuideData, type MapTopic,
} from './library-model.ts';
import { GuideListEditor } from './list-editor.ts';
import { MAP_CANVAS_HEIGHT, MAP_CANVAS_WIDTH, MAP_PADDING } from './map-presentation.ts';

const snap = (value: number) => Math.round(value / MAP_GRID) * MAP_GRID;
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

export const GuideMapEditor = defineComponent({
  name: 'GuideMapEditor',
  props: { data: { type: Object as PropType<MapGuideData>, required: true } },
  emits: { study: () => true },
  setup(props, { emit }) {
    const selectedId = ref<string | null>(props.data.topics[0]?.id ?? null);
    const connectingFromId = ref<string | null>(null);
    const invalidConnection = ref<{ from: string; to: string } | null>(null);
    const connectionMessage = ref('Choose another topic to connect it to this one.');
    const drag = ref<{ id: string; clientX: number; clientY: number; x: number; y: number } | null>(null);
    let invalidConnectionTimer: number | null = null;
    const selected = computed(() => topicById(props.data, selectedId.value));
    const studyProblem = computed(() => mapStudyProblem(props.data));

    function clearInvalidConnection() {
      if (invalidConnectionTimer !== null) window.clearTimeout(invalidConnectionTimer);
      invalidConnectionTimer = null;
      invalidConnection.value = null;
      connectionMessage.value = 'Choose another topic to connect it to this one.';
    }

    function flashInvalidConnection(from: string, to: string) {
      clearInvalidConnection();
      invalidConnection.value = { from, to };
      connectionMessage.value = 'That connection would create a loop. Choose a different topic.';
      invalidConnectionTimer = window.setTimeout(() => {
        invalidConnectionTimer = null;
        invalidConnection.value = null;
        connectionMessage.value = 'Choose another topic to connect it to this one.';
      }, 650);
    }

    onBeforeUnmount(clearInvalidConnection);

    function addTopic() {
      if (props.data.topics.length >= MAX_TOPICS) return;
      const index = props.data.topics.length;
      const topic: MapTopic = {
        id: createId(),
        title: 'New topic',
        x: clamp(snap(64 + (index % 5) * 224), MAP_MAX_X),
        y: clamp(snap(64 + Math.floor(index / 5) * 128), MAP_MAX_Y),
        guide: createListGuideData(),
      };
      props.data.topics.push(topic);
      if (props.data.startTopicId === null) props.data.startTopicId = topic.id;
      selectedId.value = topic.id;
      connectingFromId.value = null;
      clearInvalidConnection();
    }

    function removeTopic(id: string) {
      const index = props.data.topics.findIndex(topic => topic.id === id);
      if (index < 0) return;
      removeTopicGraphData(props.data, id);
      props.data.topics.splice(index, 1);
      if (connectingFromId.value === id) connectingFromId.value = null;
      if (invalidConnection.value?.from === id || invalidConnection.value?.to === id) clearInvalidConnection();
      selectedId.value = props.data.topics[Math.min(index, props.data.topics.length - 1)]?.id ?? null;
    }

    function moveTopic(topic: MapTopic, dx: number, dy: number) {
      topic.x = clamp(snap(topic.x + dx), MAP_MAX_X);
      topic.y = clamp(snap(topic.y + dy), MAP_MAX_Y);
    }

    function selectTopic(topic: MapTopic) {
      const from = connectingFromId.value;
      if (from && from !== topic.id) {
        if (connectionWouldCreateCycle(props.data, from, topic.id)) {
          flashInvalidConnection(from, topic.id);
          return;
        }
        connectTopics(props.data, from, topic.id);
        connectingFromId.value = null;
        clearInvalidConnection();
      }
      selectedId.value = topic.id;
    }

    function pointerDown(event: PointerEvent, topic: MapTopic) {
      if (event.button !== 0 || connectingFromId.value) return;
      selectedId.value = topic.id;
      drag.value = { id: topic.id, clientX: event.clientX, clientY: event.clientY, x: topic.x, y: topic.y };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }

    function pointerMove(event: PointerEvent, topic: MapTopic) {
      const active = drag.value;
      if (!active || active.id !== topic.id) return;
      topic.x = clamp(snap(active.x + event.clientX - active.clientX), MAP_MAX_X);
      topic.y = clamp(snap(active.y + event.clientY - active.clientY), MAP_MAX_Y);
    }

    function pointerUp(event: PointerEvent) {
      const element = event.currentTarget as HTMLElement;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      drag.value = null;
    }

    function connectionLine(connection: MapGuideData['connections'][number]) {
      const from = topicById(props.data, connection.from);
      const to = topicById(props.data, connection.to);
      if (!from || !to) return null;
      return h('line', {
        key: connection.id,
        x1: from.x + MAP_TOPIC_WIDTH / 2,
        y1: from.y + MAP_TOPIC_HEIGHT / 2,
        x2: to.x + MAP_TOPIC_WIDTH / 2,
        y2: to.y + MAP_TOPIC_HEIGHT / 2,
        class: selectedId.value === from.id || selectedId.value === to.id ? 'is-selected' : null,
      });
    }

    function invalidConnectionLine() {
      const invalid = invalidConnection.value;
      if (!invalid) return null;
      const from = topicById(props.data, invalid.from);
      const to = topicById(props.data, invalid.to);
      if (!from || !to) return null;
      return h('line', {
        key: 'invalid-' + invalid.from + '-' + invalid.to,
        x1: from.x + MAP_TOPIC_WIDTH / 2,
        y1: from.y + MAP_TOPIC_HEIGHT / 2,
        x2: to.x + MAP_TOPIC_WIDTH / 2,
        y2: to.y + MAP_TOPIC_HEIGHT / 2,
        class: 'is-invalid',
      });
    }

    return () => {
      const selectedTopic = selected.value;
      const connected = selectedTopic
        ? connectedTopicIds(props.data, selectedTopic.id)
          .map(id => topicById(props.data, id))
          .filter((topic): topic is MapTopic => topic !== null)
        : [];

      return h('div', { class: 'guide-map-editor' }, [
        h('div', { class: 'guide-map-toolbar' }, [
          h('div', { class: 'guide-map-toolbar-actions' }, [
            h('button', {
              type: 'button', class: 'quiet-button',
              disabled: props.data.topics.length >= MAX_TOPICS, onClick: addTopic,
            }, '+ Topic'),
            h('button', {
              type: 'button',
              class: ['quiet-button', { 'is-active': connectingFromId.value !== null }],
              disabled: !selectedTopic || props.data.topics.length < 2,
              'aria-pressed': connectingFromId.value !== null,
              onClick: () => {
                clearInvalidConnection();
                connectingFromId.value = connectingFromId.value ? null : selectedTopic?.id ?? null;
              },
            }, connectingFromId.value ? 'Cancel connection' : 'Connect'),
          ]),
          h('div', { class: 'guide-map-toolbar-study' }, [
            studyProblem.value ? h('span', { class: 'guide-map-status' }, studyProblem.value) : null,
            h('button', {
              type: 'button', class: 'card-primary-button',
              disabled: studyProblem.value !== null,
              onClick: () => emit('study'),
            }, 'Start studying'),
          ]),
        ]),
        h('p', {
          class: ['guide-connection-prompt', {
            'is-visible': connectingFromId.value !== null,
            'is-invalid': invalidConnection.value !== null,
          }],
          role: 'status',
          'aria-hidden': connectingFromId.value === null ? 'true' : undefined,
        }, connectionMessage.value),
        h('div', { class: 'guide-map-layout' }, [
          h('div', { class: 'guide-map-scroll' }, [
            h('div', {
              class: ['guide-map-canvas', { 'is-connecting': connectingFromId.value !== null }],
              style: { width: MAP_CANVAS_WIDTH + 'px', height: MAP_CANVAS_HEIGHT + 'px', '--guide-grid': MAP_GRID + 'px' },
              role: 'group', 'aria-label': 'Topic map editor',
            }, [
              h('svg', {
                class: 'guide-route',
                style: { left: MAP_PADDING + 'px', top: MAP_PADDING + 'px' },
                viewBox: '0 0 ' + MAP_WIDTH + ' ' + MAP_HEIGHT,
                width: MAP_WIDTH, height: MAP_HEIGHT, 'aria-hidden': 'true',
              }, [...props.data.connections.map(connectionLine), invalidConnectionLine()]),
              ...props.data.topics.map((topic, index) => h('button', {
                key: topic.id,
                type: 'button',
                class: ['guide-topic-stop', {
                  'is-selected': selectedId.value === topic.id,
                  'is-start': props.data.startTopicId === topic.id,
                  'is-connection-source': connectingFromId.value === topic.id,
                }],
                style: { left: topic.x + MAP_PADDING + 'px', top: topic.y + MAP_PADDING + 'px' },
                'aria-label': topic.title + ', topic ' + (index + 1) + (props.data.startTopicId === topic.id ? ', starting topic' : ''),
                onPointerdown: (event: PointerEvent) => pointerDown(event, topic),
                onPointermove: (event: PointerEvent) => pointerMove(event, topic),
                onPointerup: pointerUp,
                onPointercancel: pointerUp,
                onClick: () => selectTopic(topic),
                onKeydown: (event: KeyboardEvent) => {
                  if (connectingFromId.value && event.key === 'Enter') {
                    event.preventDefault();
                    selectTopic(topic);
                    return;
                  }
                  const moves: Record<string, [number, number]> = {
                    ArrowLeft: [-MAP_GRID, 0], ArrowRight: [MAP_GRID, 0],
                    ArrowUp: [0, -MAP_GRID], ArrowDown: [0, MAP_GRID],
                  };
                  const movement = moves[event.key];
                  if (!movement || connectingFromId.value) return;
                  event.preventDefault();
                  moveTopic(topic, movement[0], movement[1]);
                },
              }, [
                h('span', { class: 'guide-topic-number' }, String(index + 1)),
                h('span', { class: 'guide-topic-name', title: topic.title || 'Untitled topic' }, topic.title || 'Untitled topic'),
                props.data.startTopicId === topic.id ? h('span', {
                  class: 'guide-topic-start', 'aria-hidden': 'true',
                }, 'Start') : null,
              ])),
            ]),
          ]),
          h('aside', { class: 'guide-topic-panel', 'aria-label': 'Selected topic guide' }, selectedTopic ? [
            h('div', { class: 'guide-topic-panel-heading' }, [
              h('input', {
                value: selectedTopic.title,
                maxlength: MAX_TEXT_LENGTH,
                placeholder: 'Topic name',
                'aria-label': 'Topic name',
                onInput: (event: Event) => { selectedTopic.title = inputValue(event); },
              }),
              h('div', { class: 'guide-topic-actions' }, [
                h('button', {
                  type: 'button', class: 'quiet-button',
                  disabled: props.data.startTopicId === selectedTopic.id,
                  onClick: () => setStartTopic(props.data, selectedTopic.id),
                }, props.data.startTopicId === selectedTopic.id ? 'Starts here' : 'Start here'),
                h('button', {
                  type: 'button', class: 'quiet-button danger-button',
                  onClick: () => removeTopic(selectedTopic.id),
                }, 'Delete topic'),
              ]),
            ]),
            h('label', { class: 'guide-topic-description-field' }, [
              h('span', 'Stop description (optional)'),
              h('textarea', {
                value: selectedTopic.description ?? '',
                rows: 3,
                maxlength: MAX_TEXT_LENGTH,
                placeholder: 'Why is this stop part of the journey? What will it introduce?',
                'aria-label': 'Stop description (optional)',
                onInput: (event: Event) => {
                  const description = inputValue(event);
                  if (description) selectedTopic.description = description;
                  else delete selectedTopic.description;
                },
              }),
            ]),
            h('section', { class: 'guide-connections', 'aria-labelledby': 'guide-connections-title' }, [
              h('div', { class: 'guide-connections-heading' }, [
                h('h3', { id: 'guide-connections-title' }, 'Connections'),
                h('span', String(connected.length)),
              ]),
              connected.length ? h('ul', connected.map(topic => {
                const connection = props.data.connections.find(entry =>
                  (entry.from === selectedTopic.id && entry.to === topic.id) ||
                  (entry.to === selectedTopic.id && entry.from === topic.id));
                return h('li', { key: topic.id }, [
                  h('button', {
                    type: 'button', class: 'guide-connection-name',
                    onClick: () => { selectedId.value = topic.id; connectingFromId.value = null; clearInvalidConnection(); },
                  }, topic.title || 'Untitled topic'),
                  h('button', {
                    type: 'button', class: 'icon-button',
                    title: 'Remove connection to ' + (topic.title || 'Untitled topic'),
                    'aria-label': 'Remove connection to ' + (topic.title || 'Untitled topic'),
                    onClick: () => { if (connection) removeConnection(props.data, connection.id); },
                  }, '×'),
                ]);
              })) : h('p', { class: 'guide-topic-help' }, 'No paths yet. Use Connect, then choose another topic.'),
            ]),
            h('p', { class: 'guide-topic-help' }, 'This stop has its own mini guide.'),
            h(GuideListEditor, { data: selectedTopic.guide, compact: true }),
          ] : [
            h('div', { class: 'guide-topic-panel-empty' }, [h('p', 'Add a topic to start building the map.')]),
          ]),
        ]),
      ]);
    };
  },
});
