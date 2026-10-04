# @dynamic-learner/tips API

Reusable guided-tips UI for Vue 3.

## Package exports

### Components

#### `TipsExperience`

Vue component implementing the TIPS interface.

Props:

| Prop | Type | Default | Description |
|---|---|---|---|
| `feature` | `TipsFeature \| null` | `null` | Current feature. |
| `catalog` | `TipsCatalog` | required | Tutorial catalog. |
| `storageKey` | `string` | `"tips.v1"` | Local-storage key for TIPS state. |
| `actionEventName` | `string` | `"tips:action"` | Browser event name used for host tutorial actions. |

Exposed instance:

```ts
interface TipsHandle {
  open(trigger?: EventTarget | null): void;
}
```

### Composables

#### `useTips(props)`

Low-level Vue composable used by `TipsExperience`.

Returns:

```ts
{
  primaryFocus,
  openState,
  mode,
  stepIndex,
  preferences,
  tutorial,
  sections,
  activeSection,
  step,
  card,
  targetRect,
  cardPlacement,
  cardStyle,
  dragging,
  manualPosition,
  scrims,
  centeredCardStyle,
  beginCardDrag,
  dragCard,
  endCardDrag,
  hasSeenSection,
  availableNow,
  prepareAndStart,
  open,
  startSection,
  skipSection,
  showMenu,
  close,
  previous,
  next,
  toggleAutomaticTips,
  resetCurrentTips,
}
```

The returned refs/computed values are Vue reactive values. The operation methods control tutorial state and presentation.

### Tutorial action bridge

#### `TIPS_ACTION_EVENT`

Default event name:

```ts
'tips:action'
```

#### `addTutorialActionListener(handler)`

Registers a host-side listener for tutorial preparation actions.

```ts
type TutorialActionHandler =
  (event: CustomEvent<TutorialRequest>) => void;
```

Returns:

```ts
() => void
```

The returned function removes the listener.

#### `dispatchTutorialAction(eventName, request)`

Dispatches a `CustomEvent<TutorialRequest>` on `window`.

### Types

The package exports:

```ts
Placement
StepAction
TargetSelector
TipSection
TipStep
TipsCatalog
TipsFeature
TipsFeatureId
TipsPreferences
TipsProps
Tutorial
TutorialCleanup
TutorialRequest
TutorialActionHandler
TipsHandle
```

#### `TipsFeature`

```ts
interface TipsFeature {
  id: string;
  label: string;
}
```

#### `TipsCatalog`

```ts
type TipsCatalog = Record<TipsFeatureId, Tutorial>;
```

#### `Tutorial`

```ts
interface Tutorial {
  version: number;
  sections: TipSection[];
}
```

#### `TipSection`

```ts
interface TipSection {
  id: string;
  title: string;
  description: string;
  steps: TipStep[];
  when?: TargetSelector;
  prepare?: string;
  auto?: boolean;
  finishLabel?: string;
  continueToAvailable?: boolean;
  finishAction?: StepAction;
}
```

#### `TipStep`

```ts
interface TipStep {
  title: string;
  body: string;
  target: TargetSelector;
  targetLabel: string;
  placement?: Placement;
  nextAction?: StepAction;
  backAction?: StepAction;
  nextLabel?: string;
  back?: boolean;
}
```

#### `TargetSelector`

```ts
type TargetSelector = string | string[];
```

#### `Placement`

```ts
type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center';
```

#### `StepAction`

```ts
interface StepAction {
  click: TargetSelector;
}
```

#### `TutorialRequest`

```ts
interface TutorialRequest {
  featureId: TipsFeatureId;
  action: string;
  handled: boolean;
  resolve: (cleanup: TutorialCleanup) => void;
  reject: (reason: unknown) => void;
}
```

#### `TutorialCleanup`

```ts
type TutorialCleanup = () => void | Promise<void>;
```

#### `TipsPreferences`

```ts
interface TipsPreferences {
  enabled: boolean;
  seen: Record<string, unknown>;
}
```

#### `TipsProps`

```ts
interface TipsProps {
  feature: TipsFeature | null;
  catalog: TipsCatalog;
  storageKey: string;
  actionEventName: string;
}
```

## CSS export

```ts
import '@dynamic-learner/tips/styles.css';
```

Subpath:

```
@dynamic-learner/tips/styles.css
```

The package CSS uses `--tips-*` custom properties with fallbacks.

## Package metadata

- Name: `@dynamic-learner/tips`
- Version: `0.1.0`
- Runtime peer dependency: `vue ^3.5.0`
- Entry point: `./src/index.ts`
- CSS entry point: `./src/tips.css`
