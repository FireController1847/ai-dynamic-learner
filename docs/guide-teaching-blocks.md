# Guide Teaching Blocks (v1 preview)

Map navigation remains unchanged. A map stop optionally stores `lesson: { version: 1, blocks: [...] }` alongside its preexisting `guide.sections` data. The `lesson` field is declarative and strictly validated by `validateTeachingLesson` before persistence. It does **not** accept HTML, script, arbitrary URLs, or JSX.

## Block catalog

All blocks have `id` (unique within the library), `kind`, and `title`.

| kind | fields | learning experience |
| --- | --- | --- |
| `explanation` | `body`, optional `highlights: string[]` | Continuous readable explanation and concept chips |
| `example` | `scenario`, `steps: string[]`, `takeaway` | Scenario with optional expandable worked solution |
| `comparison` | `left`, `right` each with `label`, `description`, `points: string[]` | Side-by-side comparison |
| `sequence` | optional `intro`, `steps: { title, body }[]` | Switch between meaningful stages |
| `diagram` | optional `caption`, `nodes: { id, label, detail }[]` | Interactive, left-to-right sequence of connected conceptual nodes |
| `exploration` | `prompt`, `choices: { id, label, explanation }[]` | Choose a scenario to see what happens, freely change it |
| `check` | `question`, `options: { id, label, explanation }[]`, `correctId` | Ungraded prediction with immediate explanatory feedback |
| `connection` | `body`, optional `next` | Link current topic to the next idea |

The renderer is `teaching-lesson.ts`; the associated CSS is `teaching-lesson.css`. The schema and validator live in `teaching-blocks.ts`.

## Source compatibility

- Existing maps with only `guide.sections` are automatically presented as whole explanation blocks. No migration or AI call is needed.
- The map editor includes **Teaching Blocks** authoring for all eight block types. Existing map stops offer **Enable Teaching Blocks**, which copies their original bullet sections into editable explanation blocks and retains the originals separately. Draft edits are validated before replacing the saved block. The stop sidebar contains only the block outline and controls; selecting a block opens a centered, wide editing dialog, and **Preview entire lesson** opens a separate centered preview dialog. Both use the app's native modal behavior (Escape, close, and focus return), so the forms are not constrained by the map sidebar. Closing an unsaved edit discards its draft.
- Map adventures now unlock routes via **Finish lesson** (explicit and ungraded) or **Skip this lesson**. Reading does not implicitly mark a lesson as visited.
- `session.responses` holds interaction choices by map-topic ID and block ID; previous visited, skipped, opened, and paused state remains unchanged. Resetting choices does not unvisit a stop. Older `session.revealed` data remains accepted for compatibility.
- Map edits may remove a topic or blocks; validation prunes stale saved interaction references.
- No external assets, network requests, AI API requests, arbitrary content markup, or execution are required to run a lesson.

## Preview and eventual AI import

The **Demo** button in the Guide library creates a persistent three-stop map using `createTeachingBlocksDemo`, with all eight block kinds in the first stop and two branch stops for navigation testing. Delete it through the ordinary library controls.

AI Guide import is temporarily disabled in the library toolbar. The old import code is retained for rework. Future import should return structured, bounded content that passes `validateTeachingLesson`, preferably with citations/coverage review as a separate layer. The current renderer does not require or execute AI-generated HTML and does not claim source verification.

The first `diagram` implementation is a selectable conceptual flow, **not** a general-purpose graph layout, anatomy viewer, image importer, or executable visualization engine. Additional renderer types can be introduced with a schema version and backward-compatible validation.

## Verification

Run `npm run test:guide`. CI also runs the existing TypeScript check and production build.

## Compatibility notice during development

The app shell can dismiss the workspace compatibility banner for the current visit, or **Ignore this warning** to remember the exact mode, database version, read-only status, and issue list in local browser preferences. Another compatibility condition shows the warning again. When hidden, a compact header indicator reopens the details. **This affects notification visibility only:** read-only recovery remains enforced, unknown data stays protected, and restricted backup/restore/clear operations remain restricted.
