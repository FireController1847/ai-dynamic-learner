# @dynamic-learner/tips — Documentation

This document explains **how to use the TIPS package**, what the pieces do, and how an application can provide its own tutorials.

The goal is simple: the package provides the **tutorial machinery**, while the application provides the **tutorial content and app-specific actions**.

That separation is intentional. An application should be able to use TIPS without knowing how the spotlight, tip card, progress dots, persistence, or positioning work.

## What TIPS does

TIPS is a small guided-tour system for Vue applications.

It can:

- Show a list of guides for the current feature or page.
- Walk the user through a guide one step at a time.
- Highlight real DOM elements so the user can see what a tip is talking about.
- Move the tip card automatically to avoid covering the highlighted element.
- Let the user drag the tip card somewhere else.
- Work on small screens as well as desktop screens.
- Remember which sections the user has completed.
- Automatically show new tips when they become available.
- Let the user skip a section.
- Let the user replay completed sections.
- Let the user reset the tips for the current feature.
- Temporarily ask the host application to create or open something for a tutorial, then clean it up when the tutorial is finished.

TIPS does **not** know what a Notebook, Index Card, Word Search, or any other application feature is. Those concepts belong to the host application.

---

## The basic idea

There are three things to provide:

1. **A feature** — the thing the user is currently using.
2. **A catalog** — the tutorials that belong to that feature.
3. **The TIPS component** — the reusable UI and behavior.

A very small example looks like this:

```ts
import { ref } from 'vue';
import {
  TipsExperience,
  type TipsCatalog,
  type TipsHandle,
  type TipsFeature,
} from '@dynamic-learner/tips';
import '@dynamic-learner/tips/styles.css';

const feature: TipsFeature = {
  id: 'notebook',
  label: 'Notebook',
};

const catalog: TipsCatalog = {
  notebook: {
    version: 1,
    sections: [
      {
        id: 'getting-started',
        title: 'Getting started',
        description: 'Learn the basics of this page.',
        steps: [
          {
            title: 'Create something',
            body: 'Use this button to create a new document.',
            target: '[data-tip="create-document"]',
            targetLabel: 'Create document button',
          },
          {
            title: 'Choose a type',
            body: 'Choose the kind of document you want to make.',
            target: '[data-tip="document-type"]',
            targetLabel: 'Document type chooser',
          },
        ],
      },
    ],
  },
};

const tips = ref<TipsHandle | null>(null);
```

Then in the template:

```vue
<TipsExperience
  ref="tips"
  :feature="feature"
  :catalog="catalog"
  storage-key="my-app.tips.v1"
/>

<button type="button" @click="tips?.open()">
  Tips
</button>
```

The application can decide where the Tips button lives and when it should be shown.

---

## Tutorials are organized into sections

A **tutorial** belongs to one feature.

A tutorial contains one or more **sections**.

A section contains one or more **steps**.

Think of it like this:

```
Feature
└── Tutorial
    ├── Section: Getting started
    │   ├── Step 1
    │   └── Step 2
    ├── Section: Creating a document
    │   ├── Step 1
    │   └── Step 2
    └── Section: Review mode
        ├── Step 1
        └── Step 2
```

Sections are useful when a feature has several small things worth learning. They also allow the application to make a later section available only after the user reaches the appropriate screen or state.

### Tutorial

```ts
interface Tutorial {
  version: number;
  sections: TipSection[];
}
```

Increase `version` when an existing tutorial has changed enough that completed sections should be considered new again.

### Section

A section has:

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

The first four fields are the normal ones:

- `id` — stable identifier for the section.
- `title` — short name shown in the TIPS menu.
- `description` — short explanation of what the section teaches.
- `steps` — the actual tutorial.

The remaining fields control more advanced behavior.

---

## Steps

A step tells the user one small thing.

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

### `title`

The short heading shown on the tip card.

Keep it simple.

Good:

> Create a document

Less helpful:

> Understanding the document creation workflow

### `body`

The explanation shown underneath the title.

TIPS is intended for people who may be unfamiliar with the application, so short and plain language works best.

### `target`

The DOM element the tip is talking about.

It can be one selector:

```ts
target: '[data-tip="create-document"]'
```

or several selectors, in priority order:

```ts
target: [
  '[data-tip="create-document"]',
  '#create-document',
]
```

The first visible matching element is used.

**Stable selectors are strongly preferred.** A `data-tip` attribute is often a good choice because it does not depend on CSS styling or DOM structure.

### `targetLabel`

A human-readable name for the target.

For example:

```ts
targetLabel: 'Create document button'
```

Keep this meaningful even if the current UI does not visibly display the label. It is part of the tutorial's description of what the target represents.

### `placement`

The preferred location of the tip card:

```ts
'top'
'bottom'
'left'
'right'
'center'
```

This is a **preference**, not a guarantee. TIPS checks the available space and can choose another location when necessary.

On compact screens, TIPS automatically favors placing the card above or below the highlighted element.

### `nextAction` and `backAction`

These allow a step to click a DOM element as the user moves forward or backward.

Example:

```ts
nextAction: {
  click: '[data-tip="next-page"]',
}
```

This is useful when the tutorial needs to move the application forward for the next step.

### `nextLabel`

Changes the text of the main button for that step.

For example:

```ts
nextLabel: 'Open review'
```

The final step normally uses the section's `finishLabel` instead.

### `back`

Set this to `false` when the Back button should not be shown for a particular step.

---

## Making tips point at real UI

A major part of TIPS is that the tutorial should **show**, rather than merely describe.

For example:

```html
<button
  type="button"
  data-tip="create-document"
>
  New document
</button>
```

Then:

```ts
{
  title: 'Create a document',
  body: 'Use this button to make a new document.',
  target: '[data-tip="create-document"]',
  targetLabel: 'New document button',
}
```

When that step opens, TIPS finds the button, highlights it, and places the card near it.

If the target is currently outside the viewport, TIPS attempts to bring it into view.

If the preferred position would cover the target, TIPS considers other positions.

---

## Opening something automatically

Sometimes a tutorial needs to teach a screen the user has not opened yet.

For example, a Notebook tutorial might need to open a document before it can explain the document editor.

This is handled with two fields:

```ts
prepare: 'open-document-example'
```

and, optionally:

```ts
when: '[data-tip="document-editor"]'
```

If the target is not currently available, TIPS asks the host application to perform the named action.

The important boundary is:

**TIPS does not create the document itself.**

It simply asks the application:

> Please perform the action named `open-document-example`.

The application decides what that action means.

---

## Tutorial actions

The host application can listen for these requests with:

```ts
import {
  addTutorialActionListener,
  type TutorialRequest,
} from '@dynamic-learner/tips';
```

A typical handler looks like:

```ts
function handleTipsAction(event: CustomEvent<TutorialRequest>) {
  const detail = event.detail;

  if (detail.featureId !== 'notebook') return;

  detail.handled = true;

  prepareTipsAction(detail.action).then(
    detail.resolve,
    detail.reject,
  );
}
```

The application then implements its own action:

```ts
async function prepareTipsAction(action: string) {
  if (action === 'open-document-example') {
    // Create/open whatever the tutorial needs.
    // ...

    return () => {
      // Restore the user's previous state.
      // Delete temporary tutorial data if necessary.
    };
  }

  throw new Error('Unknown Notebook tutorial action.');
}
```

### Cleanup matters

A preparation action may create temporary data.

The returned cleanup function gives the host application a chance to restore the state it had before the tutorial.

For example:

```ts
return () => {
  restorePreviousSelection();
  deleteTemporaryTutorialDocument();
};
```

TIPS calls this cleanup when the temporary demonstration is no longer needed.

This is what allows features such as **Open for me** to create realistic examples without leaving tutorial junk in the user's library.

---

## Sections that become available later

A section can wait until its target exists:

```ts
{
  id: 'review',
  title: 'Review mode',
  description: 'Learn how to review your cards.',
  when: '[data-tip="review-mode"]',
  prepare: 'open-review-example',
  steps: [
    // ...
  ],
}
```

This makes it possible to have one tutorial catalog for an entire application even though different sections belong to different screens.

When the target is unavailable, the TIPS menu can offer **Open for me** if `prepare` is provided.

When the target already exists, the section can be opened normally.

---

## Automatic tips

By default, TIPS can automatically open a section the first time it becomes available.

For example:

```ts
{
  id: 'getting-started',
  title: 'Getting started',
  description: 'A quick introduction.',
  steps: [
    // ...
  ],
}
```

The section is automatically shown when:

- tips are enabled,
- the feature has a tutorial,
- the section is available,
- and the user has not already completed that section version.

To prevent a particular section from opening automatically:

```ts
auto: false
```

The section can still be opened manually from the TIPS menu.

---

## Remembering completed tips

TIPS stores its preferences in browser-local storage.

The host supplies the storage key:

```vue
<TipsExperience
  storage-key="my-app.tips.v1"
  ...
/>
```

The stored information includes:

```ts
interface TipsPreferences {
  enabled: boolean;
  seen: Record<string, unknown>;
}
```

The `seen` entries are tied to both the feature and tutorial version.

This means changing a tutorial's version can make its sections appear new again without throwing away the rest of the user's TIPS settings.

If local storage is unavailable, TIPS continues working with in-memory defaults.

---

## Resetting tips

TIPS exposes a reset operation for the current feature:

```ts
resetCurrentTips()
```

The built-in TIPS menu uses this for its **Reset tips** button.

Resetting removes the current feature's completed-section state. It does not reset unrelated features.

The user can therefore replay the Notebook tips without also replaying the Calculator tips.

---

## The TIPS menu

When TIPS is opened normally, it starts with a menu containing the feature's sections.

A completed section is shown as:

**Done · Show again**

A section that needs the host application to open another screen can show:

**Open for me**

A section that is already available can show:

**Start**

This means the host application does not need to build its own tutorial menu.

---

## Finishing a section

Normally, finishing a section closes the tour or returns to the section menu.

You can customize the final button:

```ts
finishLabel: 'Done'
```

A section can also ask TIPS to click something after it finishes:

```ts
finishAction: {
  click: '[data-tip="close-review"]',
}
```

This is useful when the final tutorial step should leave the application in a particular state.

For example, a tutorial can demonstrate a mode and then use `finishAction` to leave that mode.

---

## Continuing into another section

A section can automatically continue to the next available section:

```ts
continueToAvailable: true
```

This is useful when a feature's tutorial naturally progresses through several screens.

The next section is only started when it is actually available and has not already been completed.

---

## Dragging the tip card

The tip card can be moved by dragging its header.

This is intentional: automatic positioning cannot always know where the user wants the card.

A user can therefore move the card out of the way, and TIPS keeps the manually chosen position for the current interaction.

The package also keeps the card inside the visible viewport.

---

## Responsive behavior

TIPS is designed for desktop and mobile use.

The card:

- has a viewport-aware maximum size,
- scrolls internally when its content is too tall,
- stays inside the screen,
- uses a simpler above/below placement strategy on narrow screens,
- supports pointer-based dragging.

The host application should still keep tutorial text short. Responsive behavior can make the card fit, but it cannot make a giant paragraph pleasant to read on a phone.

---

## Theme integration

The package does not import the host application's theme system.

Instead, its CSS uses a small set of optional `--tips-*` variables.

The important variables are:

```css
--tips-scrim
--tips-brand
--tips-brand-tint
--tips-brand-text
--tips-overlay-shadow
--tips-radius
--tips-background
--tips-border
--tips-text
--tips-text-secondary
--tips-control-border
--tips-hover
--tips-fast
```

Each variable has a fallback value, so the package can work without any host theme integration.

A host application can map its own design tokens to these variables:

```css
.tips-layer,
.tips-menu-dialog {
  --tips-brand: var(--brand);
  --tips-background: var(--page-background);
  --tips-text: var(--text-color);
  --tips-text-secondary: var(--text-secondary);
}
```

This keeps TIPS visually integrated without making the package dependent on a particular application's design system.

---

## Public API

The package currently exports:

### `TipsExperience`

The ready-to-use Vue component.

Props:

```ts
interface TipsProps {
  feature: TipsFeature | null;
  catalog: TipsCatalog;
  storageKey: string;
  actionEventName: string;
}
```

The component also provides an exposed handle:

```ts
interface TipsHandle {
  open(trigger?: EventTarget | null): void;
}
```

### `useTips`

The lower-level Vue composable.

Use this when an application needs to build its own TIPS presentation while reusing the TIPS state and behavior.

It provides the current tutorial state plus operations such as:

- `open()`
- `close()`
- `startSection()`
- `showMenu()`
- `next()`
- `previous()`
- `skipSection()`
- `prepareAndStart()`
- `toggleAutomaticTips()`
- `resetCurrentTips()`

### `addTutorialActionListener()`

Registers a host-side handler for tutorial preparation actions.

It returns a cleanup function, so listeners can be removed when the host component is unmounted.

### `TIPS_ACTION_EVENT`

The default browser event name used for tutorial actions:

```ts
'tips:action'
```

The event name can be overridden through the `actionEventName` prop when an application needs a different namespace.

### Types

The package also exports:

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
```

---

## A good tutorial is small

TIPS works best when each step answers one question.

Prefer:

> **Create a card**  
> Click here to make a new card.

over:

> **Creating and managing cards**  
> Cards are a fundamental part of the application and can be created, edited, organized, reviewed, sorted, moved between groups, and configured through the various controls available on this page...

The second version may contain more information, but it is much harder to follow.

A good rule is:

**One step → one idea → one target.**

If a feature has many things to explain, split them into sections.

---

## Recommended tutorial structure

For a typical application feature, a good starting point is:

```
Getting started
  → Show the most important controls.

Creating
  → Show how to make the thing.

Using it
  → Show the important interaction.

Reviewing or advanced features
  → Only include this when it is genuinely useful.
```

Not every feature needs all four.

A calculator might only need one or two sections.

A complex editor might need several.

TIPS should teach the application, not make the user complete a textbook.

---

## Versioning tutorial content

Tutorial versions are intentionally simple.

Start with:

```ts
version: 1
```

If you substantially change a section's instructions, increase the version:

```ts
version: 2
```

TIPS compares the stored version with the current version. A completed section from version 1 is therefore treated as unseen when version 2 is introduced.

Keep the section's `id` stable when it is still conceptually the same section.

Create a new `id` when it is actually a different guide.

---

## Moving TIPS to another repository

The package is deliberately designed to be portable.

The package itself should not import:

- application components,
- application feature modules,
- application state,
- application-specific CSS,
- application-specific tutorial content.

Instead:

**The package owns the machinery.**

**The host application owns the knowledge.**

That means moving `packages/tips/` into another repository should require little or no change to its internal imports.

The host application only needs to provide:

- a Vue 3 environment,
- a tutorial catalog,
- the current feature,
- a storage key,
- optional tutorial-action handlers,
- optional theme-token mappings.

That boundary is the most important architectural rule in this package.

---

## In short

If you are adding TIPS to an application, think about it this way:

```
                 Host application
                       │
          ┌────────────┼────────────┐
          │            │            │
       Content      DOM targets   Actions
          │            │            │
          └────────────┼────────────┘
                       │
                       ▼
                 @dynamic-learner/tips
                       │
          ┌────────────┼────────────┐
          │            │            │
       Tour UI      Spotlight    Persistence
                    Positioning    & state
                       │
                       ▼
                   The user
```

The application tells TIPS **what to teach**.

TIPS handles **how to teach it**.
