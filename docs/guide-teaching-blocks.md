# Guide Teaching Blocks (v1 preview)

Map navigation remains unchanged. A map stop optionally stores `lesson: { version: 1, blocks: [...] }` alongside its preexisting `guide.sections` data. The `lesson` field is declarative and strictly validated by `validateTeachingLesson` before persistence. User-authored text may use Markdown and LaTeX, but never directly executes HTML or script. Rich content is sanitized before rendering.

## Block catalog

All blocks have `id` (unique within the library), `kind`, and `title`.

| kind | fields | learning experience |
| --- | --- | --- |
| `explanation` | `body`, optional `highlights: string[]` | Continuous readable explanation and concept chips |
| `example` | `scenario`, `steps: string[]`, `takeaway` | Scenario with optional expandable worked solution |
| `comparison` | `left`, `right` each with `label`, `description`, `points: string[]` | Side-by-side comparison |
| `table` | `headers: string[]`, `rows: string[][]`, optional `caption` | Semantic, horizontally scrollable table with editable rows and columns |
| `sequence` | optional `intro`, `steps: { title, body }[]` | Switch between meaningful stages |
| `diagram` | optional `caption`, `nodes: { id, label, detail }[]` | Interactive, left-to-right sequence of connected conceptual nodes |
| `exploration` | `prompt`, `choices: { id, label, explanation }[]` | Choose a scenario to see what happens, freely change it |
| `check` | `question`, `options: { id, label, explanation }[]`, `correctId` | Ungraded prediction with immediate explanatory feedback |
| `connection` | `body`, optional `next` | Link current topic to the next idea |

The renderer is `teaching-lesson.ts`; the associated CSS is `teaching-lesson.css`. The schema and validator live in `teaching-blocks.ts`.

## Markdown and LaTeX authoring

- Long-form fields (explanations, scenarios, walkthroughs, descriptions, process details, captions, question prompts, choice explanations, and connections) support **Markdown**: paragraphs, emphasis, headings, lists, code, links, and tables.
- Every short field (block titles, key ideas, step names, diagram labels, answer labels, table headers, and comparison points) supports **LaTeX** without treating ordinary Markdown punctuation as formatting.
- A **Table** block uses 2–8 named columns and 1–20 editable rows, supports Markdown/LaTeX within cells and LaTeX in headers, and renders a semantic table. Unlike Markdown tables embedded in prose, its rows and columns can be edited individually; blank cells are allowed.
- LaTeX works in long and short fields using `$x^2$` or `\(x^2\)` for inline expressions; use `$$\frac{a}{b}$$` or `\[ ... \]` for displayed expressions.
- Fields retain their original strings; the formatted result appears in **Preview** or **Both** and in the learner's lesson. No migration is necessary for existing plain-text guides.
- Long-form content uses the application's shared Marked + DOMPurify + KaTeX renderer. Short fields use text nodes and the same KaTeX renderer with `trust: false`. Arbitrary user-authored HTML is never inserted directly into the component tree.

## Source compatibility

- Existing maps with only `guide.sections` are automatically presented as whole explanation blocks. No migration or AI call is needed.
- The map editor includes **Teaching Blocks** authoring for all nine block types. Existing map stops offer **Enable Teaching Blocks**, which copies their original bullet sections into editable explanation blocks and retains the originals separately. Draft edits are validated before replacing the saved block. The stop sidebar contains the block outline, explicit pencil buttons for editing, reordering arrows, and deletion controls. Editing opens a centered dialog with **Edit**, **Preview**, and **Both** modes. Both shows editable fields on the left and a live preview of the unsaved block on the right, with independent scrolling and a fixed Save/Cancel footer. **Preview entire lesson** remains a separate centered dialog showing the complete saved lesson. Both dialogs preserve Escape, close, and focus return. Closing an unsaved edit discards its draft.
- Map adventures now unlock routes via **Finish lesson** (explicit and ungraded) or **Skip this lesson**. Reading does not implicitly mark a lesson as visited.
- `session.responses` holds interaction choices by map-topic ID and block ID; previous visited, skipped, opened, and paused state remains unchanged. Resetting choices does not unvisit a stop. Older `session.revealed` data remains accepted for compatibility.
- Map edits may remove a topic or blocks; validation prunes stale saved interaction references.
- No external assets, network requests, AI API requests, arbitrary content markup, or execution are required to run a lesson.

## Preview and eventual AI import

The demo generator is retained but its visible button is temporarily hidden. When invoked in development, it creates a persistent four-stop map using `createTeachingBlocksDemo`. The first stop demonstrates all nine Teaching Block kinds. A dedicated **Markdown & LaTeX Showcase** stop demonstrates headings, emphasis, lists, quotes, code, links, Markdown tables, inline/display LaTeX, and the new Table block. The showcase is connected to the Visual Prevention branch; the demo stays a cycle-free tree. Existing demo sets are not modified; create another demo to see the newest examples. Delete it through the ordinary library controls.

AI Guide import is re-enabled. Map mode now asks for **Teaching Blocks v2 JSON** and provides Review-style **Let AI choose** or **Custom weighted mix**, target block counts, source handoff, JSON file upload/paste, validation, and a coverage acceptance step. The AI supplies block kinds and content; Dynamic Learner generates stable local IDs, verifies the schema, and preserves all existing v1 legacy JSON imports. The renderer remains offline after import and does not execute AI-generated HTML. Coverage claims must still be evaluated against the original source.

The first `diagram` implementation is a selectable conceptual flow, **not** a general-purpose graph layout, anatomy viewer, image importer, or executable visualization engine. Additional renderer types can be introduced with a schema version and backward-compatible validation.

## Creative map spacing

New AI maps enforce a **64px minimum clear gap** between topic rectangles. Spacious, genuinely organic suggested positions are preserved. Cramped or rigid-grid layouts are replaced by a deterministic, branch-following winding trail with gentle vertical variation and short connections across row turns, not a uniform row-major grid. For larger maps, limited canvas space can still require multiple rows; the AI prompt encourages grouping related subjects into fewer meaningful stops rather than making a stop for every heading. Already saved maps and manually arranged positions are not moved.

## Guide v2.0.0 and AI learning priorities

Guide v2.0.0 marks the major Teaching Blocks release. The displayed application version changed from `1.12.1` because of new interactive lesson architecture, authoring, structured AI import, Markdown/LaTeX and Table blocks. Previously saved legacy guides remain supported.

Under **Let AI choose**, use **AI focus** to optionally prioritize **Default**, **Numerics**, **Active recall**, **Memorization**, **Relationships**, or **Application**. These are qualitative teaching priorities, not strict quotas or replacements for source coverage. This uses the same shared selection-card component as Review but has Guide-specific guidance (e.g. ungraded understanding checks instead of promising unsupported typed answer grading). **Custom weighted mix** retains its percentages and does not apply the qualitative focus.

## AI authoring flow

1. Start **Create guide with AI** from the Guide library and select Map mode (List mode retains its classic notes workflow). The secondary **Import an AI response** shortcut sits in the builder action row, as in Review.
2. Select **Overall subject** or **Choose a category**, using Review's shared scope selection and saved-category picker. Selecting a category scopes the AI instructions to that category's source material and skips repeating the source handoff.
3. In the instructions stage, choose coverage and teaching depth. Select **Let AI choose** (with an optional AI teaching focus) or a **Custom weighted mix** across all nine block kinds. Weights total 100%; the target count is guidance rather than filler quota.
4. Supply source material, copy the generated instructions to the AI conversation and return the resulting JSON.
5. Upload the JSON file or paste its response and select **Import guide**. Valid responses import immediately, without a separate source-comparison or coverage-approval screen; required source-coverage metadata and lesson structure are still validated.
6. Imported v2 maps contain real `TeachingLesson` objects and render offline immediately. Original v1 section-based JSON continues to import.

## Verification

Run `npm run test:guide`. CI also runs the existing TypeScript check and production build.

## Compatibility notice during development

The app shell can dismiss the workspace compatibility banner for the current visit, or **Ignore this warning** to remember the exact mode, database version, read-only status, and issue list in local browser preferences. Another compatibility condition shows the warning again. When hidden, a compact header indicator reopens the details. **This affects notification visibility only:** read-only recovery remains enforced, unknown data stays protected, and restricted backup/restore/clear operations remain restricted.
