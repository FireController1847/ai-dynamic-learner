# Graph Paper

This file records Graph Paper invariants that are easy to break across refactors. General UI rules live in `design.md`.

## Model and rendering

Graph Paper combines expression plots and user-drawn geometry on one saved sheet. `graph-model.ts` owns persisted data/settings; `graph-scene.ts` renders the grid, axes, curves, marks, and measurement labels; `graph-paper.ts` composes the sheet.

Supported paper/ruling choices include Letter/A4 and common grid spacings. Zoom magnifies the graph inside the fixed paper viewport; it is not the same as browser zoom or units-per-square.

Expressions are parsed by the bounded parser in `graph-expression.ts`; do not use `eval` or arbitrary JavaScript execution.

## Tools and interaction

`graph-tools.ts` owns the tool rail/options. `graph-interaction.ts` handles pointer/keyboard drawing and contextual interaction; `graph-gestures.ts` handles pinch/two-finger pan; `graph-camera.ts` owns camera/zoom transforms; `graph-visual.ts` owns hit testing and drawing operations.

Key invariants:
- Select is the default tool.
- Pan/zoom navigation must not accidentally create/erase geometry.
- Adding a second touch cancels an in-progress single-touch drawing gesture.
- Pinch zoom anchors to the gesture position; two-finger pan works regardless of drawing tool.
- Blank-grid single-touch interaction with Select should permit normal surrounding-page/sheet scrolling where designed.
- Snap spacing and visible subdivisions are separate settings.
- Undo/redo applies to drawing mutations, not camera navigation.

## Measurements and labels

`graph-measurements.ts` owns derived lengths, slopes, angles, midpoints, area, and perimeter. Derived measurements are not duplicated as authoritative saved data.

Point/segment contextual controls may expose coordinates/measurements; sheet settings control which labels are visible. Closed-region area labels may tint their region. Keep labels readable under zoom and theme changes.

## Compatibility

Persisted Graph Paper data is validated through Notebook document validators. Treat older saved records as compatibility inputs: normalize supported omissions/defaults, reject invalid shapes, and never discard expressions/drawings merely because presentation settings changed.

## Focused manual checks

When Graph Paper changes, exercise drawing/select/erase, pan, click/scrubby/pinch zoom, two-finger gestures, snapping/subdivisions, undo/redo, expression plotting/errors, measurements/labels, reload/backup round-trip, Light/Dark, narrow layouts, and reduced motion only as relevant to the change.
