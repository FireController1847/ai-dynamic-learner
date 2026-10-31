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

## Guide v2.2.0: continuation and interactive exploration

- Selecting **Continue to next topic** follows the map animation, settles at the destination for **340ms** (100ms with reduced-motion preferences), and then **automatically opens the arriving lesson**. The learner does not have to click the reached map stop. Pending auto-open timers are cancelled if the learner navigates elsewhere, closes or pauses the map, restarts, or the component unmounts. The initial Start Adventure camera introduction and manual map-stop opening are unchanged.
- The **Explore** Teaching Block is now visibly different from **Check your understanding**. Explore uses accessible, horizontally scrollable **tabs** and a permanently visible explanation panel; the first perspective appears immediately, switching perspectives is never scored, and existing saved choices are retained. Arrow keys and Home/End move among tab choices.
- Guide AI generation now **heavily prefers source-grounded parameterized examples** whenever changing inputs can teach repeatable formulas, computations or procedures. Under **Focus on numerics**, parameterization is the highest-priority block for supported numerical worked examples. Prompts use Review's variable/range/constraint/computed-answer discipline while keeping Guide's revealable teaching steps, no grading, and the prohibition on AI-provided executable solver packages. Missing source formulas, ranges or numerical tasks are never invented to inflate parameterization.

## Creative map spacing

New AI maps enforce a **64px minimum clear gap** between topic rectangles. Spacious, genuinely organic suggested positions are preserved. Cramped or rigid-grid layouts are replaced by a deterministic, branch-following winding trail with gentle vertical variation and short connections across row turns, not a uniform row-major grid. For larger maps, limited canvas space can still require multiple rows; the AI prompt encourages grouping related subjects into fewer meaningful stops rather than making a stop for every heading. Already saved maps and manually arranged positions are not moved.

## Guide v2.0.0 and AI learning priorities

Guide v2.0.0 marks the major Teaching Blocks release. The displayed application version changed from `1.12.1` because of new interactive lesson architecture, authoring, structured AI import, Markdown/LaTeX and Table blocks. Previously saved legacy guides remain supported.

Under **Let AI choose**, use **AI focus** to optionally prioritize **Default**, **Numerics**, **Active recall**, **Memorization**, **Relationships**, or **Application**. These are qualitative teaching priorities, not strict quotas or replacements for source coverage. This uses the same shared selection-card component as Review but has Guide-specific guidance (e.g. ungraded understanding checks instead of promising unsupported typed answer grading). **Custom weighted mix** retains its percentages and does not apply the qualitative focus.

## AI authoring flow

1. Start **Create guide with AI** from the Guide library and select Map mode (List mode retains its classic notes workflow). The secondary **Import an AI response** shortcut sits in the builder action row, as in Review.
2. Select **Overall subject** or **Choose a category**, using Review's shared scope selection and saved-category picker. Selecting a category scopes the AI instructions to that category's source material and skips repeating the source handoff.
3. In the instructions stage, choose coverage and teaching depth. Select **Let AI choose** (with an optional AI teaching focus) or a **Custom weighted mix** across all nine block kinds. Weights total 100%; the target count is guidance rather than filler quota.
4. Supply source material and copy the generated instructions to the AI conversation. Both Map and List modes request an actual downloadable UTF-8 JSON file (`dynamic-learner-guide-map.json` or `dynamic-learner-guide-list.json`), matching Review. The examples in the prompts are schema illustrations, not instructions to print JSON in a code block. If a file cannot be attached, the prompts permit complete raw JSON as a fallback.
5. Upload the JSON file or paste its response and select **Import guide**. Valid responses import immediately, without a separate source-comparison or coverage-approval screen; required source-coverage metadata and lesson structure are still validated.
6. Imported v2 maps contain real `TeachingLesson` objects and render offline immediately. Original v1 section-based JSON continues to import.

## Verification

Run `npm run test:guide`. CI also runs the existing TypeScript check and production build.

## Parameterized Teaching Blocks (Guide v2.1.0)

**Parameterized example** is the tenth Teaching Block kind. It reuses Review's validated deterministic generation engine (`src/core/parameterized/`), not a separate expression interpreter or unsafe `eval`. It teaches calculations with generated values, adjustable numeric variables, a **Generate new example** button, and an ungraded **Reveal walkthrough** action.

- Create a Parameterized example in the Guide stop editor. The initial block is a working two-variable addition example, with a generated prompt, walkthrough steps, computed answer and takeaway.
- Use `{{name}}` to insert generated variables and `{{answerKey}}` to include a computed result in prompts, walkthrough steps and takeaways. Long text supports the existing Markdown and LaTeX renderer.
- The editor reuses Review's variable and computed-answer controls. Define bounded integer/decimal ranges, choice or derived variables, constraints, answer expressions and optional advanced rules JSON. A save validates the complete lesson and the shared parameter dependency graph.
- The learner can change up to eight directly numeric source variables using sliders (short ranges) or number inputs (larger ranges), generate a new deterministic example, reveal/hide the worked steps, and examine any solver-provided trace. Values are calculated from shared rules; there is **no scoring**.
- Each map session saves the example number, revealed state and numeric overrides in a bounded string, while generating the actual answers again from the stored template. Invalid saved responses recover to a clean example. Resetting lesson interactions clears these controls without changing visited stops.
- The Guide AI v2 schema accepts `{kind:"parameterized",title,prompt,steps,takeaway,rules}`. Rules use the same `GenerationRules` schema as Review, but AI content cannot upload executable solver packages. The generation prompt prefers this block only when variable examples genuinely aid understanding, rather than filling a quota.

**Versioning:** The new capability advances Guide from `2.0.0` to `2.1.0` while retaining `TeachingLesson.version=1`, because adding a discriminated block kind does not require modifying existing saved lessons.

## Compatibility notice during development

The app shell can dismiss the workspace compatibility banner for the current visit, or **Ignore this warning** to remember the exact mode, database version, read-only status, and issue list in local browser preferences. Another compatibility condition shows the warning again. When hidden, a compact header indicator reopens the details. **This affects notification visibility only:** read-only recovery remains enforced, unknown data stays protected, and restricted backup/restore/clear operations remain restricted.

## Guide v2.3.0: algorithm labs and procedural learning

Guide's Parameterized Teaching Block now accepts the same validated solver-package format used by Review. AI Map v2 imports may include an optional top-level `solvers` array; each referenced package is resolved and embedded into the corresponding block's rules during import. Extraneous packages are rejected. Legacy maps and expression-only examples remain compatible.

The existing Review sandbox (restricted iframe, dedicated Worker, CSP, timeout and bounded output validation) executes uploaded solver code; Guide does not register uploaded code as trusted application functionality. **Importing an AI solver is still importing executable untrusted code into an isolated runner**. An algorithm cannot be trusted correct simply because it generated successfully.

A solver can return `trace:string[]` with intermediate scheduling, page-replacement or resource-allocation decisions. Guide presents those trace entries as an **Algorithm lab**, one action at a time, with a space for an optional prediction, a Reveal next step action, and previous/next navigation. Markdown tables in steps allow frame snapshots, Gantt segments and other readable state descriptions. The learner compares their prediction with the computed state; Guide does not automatically grade free-form explanations. Example number, revealed step and current trace position are preserved when resuming the same map.

For manual verification, create or import a map with a source-backed solver (e.g. Round Robin, FIFO page replacement). Start the lesson, generate another input, reveal the trace one state at a time, navigate back, and resume the map. Check a tabular trace, reduced motion and keyboard access. Confirm malformed or unused solver packages are rejected. No automated tests were added or run.

## Guide v2.4.0: scaffolded, engaging learning

**Try it together** is an ungraded Teaching Block that first supplies source-backed instruction, then offers an optional thought experiment, a gentle clue, and a modelled explanation; learners can retry it without losing progress. Authors can select **Guided**, **Apply**, or **Revisit**, including later returns to concepts in new contexts. The learner's free-form prediction is ephemeral and is not graded, analyzed, or stored; the stage of explanation/hint reveal is saved using existing per-block Guide responses.

**Algorithm lab** now demonstrates the opening portion of a sufficiently long trace, moves into supported prediction, and ends with more independent prediction. A previous-state reminder and explicit Reveal remain available. No answer is mandatory and no difficulty gate prevents progression.

The Map AI authoring prompt requests a source-grounded learning progression: concepts are introduced and demonstrated before invitations to recall; middle stops build on prior prerequisites; later stops apply and revisit earlier concepts with less support, including distributed revisits separated by a few stops when the route permits. This is spacing across the map sequence, **not time-based spaced repetition or mastery adaptation**. Branches cannot assume topics from unvisited other branches. Existing maps and old Teaching Blocks retain their original content and load unchanged.

Manual checks: create a Guided Practice block and use Clue/Reveal/Retry; import a newly generated Guide and confirm instruction precedes any practice, later stops revisit earlier concepts; run a solver-backed Algorithm Lab with at least five trace entries and observe modelled, supported, independent phases. Check narrow screens, keyboard-only operation, and dark/light themes. AGENTS.md: no automated tests were added or run.

## Guide v2.5.0: mathematical map scenery

Guide Maps offer **Contours**, **Water**, **Constellations**, **Flow**, and **Plain** backgrounds through the editor's **Background** selector. Contours is the default for new and older maps, preserving existing data without migration. Selection is saved as optional `MapGuideData.background` and validated when restoring browser data. Imported maps start with Contours; users choose the theme in the editor without requiring AI-generated colors.

All four scenic patterns are mathematically generated, stable and dependent on authored stop coordinates. Water integrates sinusoidal wave fronts disturbed by each stop; Contours uses modulated polar iso-curves; Constellations connects deterministic star points to nearby stops; Flow integrates local vector-field streamlines. Background SVGs are passive, below routes and controls, and have no images, fetches, real-time frame loop or pointer capture. Both editor and study show the same scenery.

The color palette is **derived from theme tokens**, not fixed colors: light themes draw restrained darker lines over a light ground, and dark themes draw restrained lighter lines over a dark ground. Arrivals in Water create short, layered expanding ripple rings around the reached stop, including manual navigation, automatic Continue and the opening camera arrival. The other scenic patterns use a smaller arrival glow. Motion disappears under `prefers-reduced-motion`. Decorative SVGs and rings are hidden from assistive technologies.

Manual checks: create/map-import a Guide, switch every background and verify selected style survives reload and light/dark theme switches. Drag/move a stop and observe curves updating; study Water and arrive via Continue/manual selection; check the waves appear behind stop buttons and lesson overlay without interfering with navigation. Confirm Plain, reduced motion, small screens and keyboard-only Background selector. No tests or manual builds were run.

## Guide v2.6.0: reversible AI review and predicted coverage

After parsing uploaded Guide JSON, **Check & preview** opens a deliberate review screen, showing overall coverage and three additional AI-estimated confidence percentages (exam, subject, study), explanatory notes and potential gaps. An expandable outline shows every Map stop or List section and an optional subject-to-stop inventory. No mandatory manual source comparison or checkbox acceptance is required; only **Create guide** persists the import. **Back to JSON** preserves the supplied text. Existing JSON without confidence continues to work in the direct import flow.

New Map and List prompts request a top-level `confidence` object, using Review's four fields plus explanations and `uncoveredSubjects`. The predictions are **self-reported by the AI**, not independently calculated, verified coverage, or learner-mastery estimates. Confidence remains preview-only data; no new workspace migration is necessary. A low-confidence or omitted-subject response allows copying a correction request to the original AI conversation.

Manual checks: upload new Map/List JSON and inspect Review; return to JSON and create; import legacy JSON without confidence; inspect optional correction request, keyboard focus and narrow/dark-mode styles. No automated tests were written or run.

## Guide v2.6.1: subtle repeating canvas scenery

The earlier stop-centered SVG contour rings and line-heavy backgrounds were replaced with a small **Canvas** texture renderer. Water repeats little two-crest wave caps rather than full-width sine waves; Contours, Constellations and Flow use equally restrained repeating motifs instead of permanent circles around individual stops. Ink uses the active `--text-color` theme token at low opacity, over an unchanged `--page-background`, with no brand-blue color cast. Plain keeps a subtle editor-only snapping grid.

**Clicking or tapping empty map space** triggers a short ripple in both the editor and study map. Arriving at a study stop also triggers a ripple at that stop's actual map position. Only Water disturbs the little crests as the wave travels; the other textures show a restrained expanding ring. Canvas accepts no pointer events, so stop buttons, dragging, paths and map controls retain their existing semantics. Coordinates are normalized through the transformed map's bounding rectangle, including cinematic camera scaling. Repeated clicks may overlap, but at most five ripples are active and animation frames run only while visible effects remain. Reduced-motion preferences stop the animation, and theme changes redraw in the updated palette. This is an editor/study presentation change only: existing saved pattern selections remain compatible.

Manual verification: switch patterns in light and dark mode; inspect Water for repeated little crests without circles around stops; click empty space in editor and in study; arrive through Continue and manually opening a stop; verify clicking/dragging stops is unaffected. Also check cinematic zoom, reduced motion, keyboard navigation, and Plain. No automated tests or manual builds were run.

## Guide v2.6.2: distinct, quieter map environments

All Canvas scenery remains neutral and theme-relative. Static motifs now have deterministic local variation in spacing, length, size, angle, and brightness, with lower opacity than v2.6.1. Water draws varied paired wave crests, Contours draws small irregular tiered curves, Constellations uses **actual five-point stars**, four-point sparkles and star dots (no straight line segments), and Flow draws subtly rotated streamlines.

The background click/tap interaction and arrival-at-stop effect now depend on the selected environment rather than using the same expanding circles. Water ripples expand and briefly distort nearby crests; Contours sends out gently uneven, compressed terrain-like levels; Constellations creates a brief small star-particle burst; Flow sends out short curved gusts; Plain remains still. Effects are finite and capped; the render loop only runs while effects are active. Theme changes re-render the monochrome texture, and reduced motion suppresses effects. No map format change or migration.

Manual checks: inspect all five styles in light/dark themes; click background and arrive at a stop in each style, especially the Constellations starburst; confirm subtle contrast and non-interference with map labels/paths, keyboard controls, and mobile scrolling. Confirm reduced motion leaves a static background. No automated tests or browser automation were added or run.

## Guide v2.7.0: living map backgrounds and cleaner practice presentation

A new **Fireflies** scene joins Water, Contours, Constellations and Flow. Existing saved Plain maps are still supported, but Plain is no longer offered as a new background choice. Fireflies have dim drifting, slowly pulsing points of light and a brief, separate scatter interaction on empty-space clicks and stop arrivals. Stars in Constellations now twinkle individually, while Water, Contours and Flow each have sparse, low-contrast ambient motion. Background geometry stays theme-relative and repeating; no bright texture overlays.

**Performance:** Canvas ambient animation is throttled to approximately 10 frames/s; brief interactions can paint at approximately 20 frames/s. The Canvas is paused while a study stop lesson is open, and animations are stopped when the tab is hidden, the Canvas is outside the viewport, a view is deactivated, or reduced-motion preferences are active. Idle scenes have no network work. Paused/reduced-motion scenes retain a static pattern, including visible still fireflies. The existing map interaction coordinates and save format are unchanged except for the accepted `fireflies` background value.

**Teaching UX:** Guided practice now has one clear block label with concise context headings, no repeated reassurance copy, and simpler Hint / Reveal explanation controls. Structured and Markdown tables fit their available width with wrapped text instead of a forced horizontal scrollbar; sequence and Explore tabs wrap across rows.

Manual verification: choose Fireflies in Map Editor, reload it, click the map and observe a subtle scatter, then enter and exit a study lesson to confirm background activity pauses/resumes. Inspect star twinkles and other ambient scenes, theme changes, reduced-motion, background tabs, table wrapping at narrow widths, and the guided-practice label/hint/reveal flow. No tests or browser automation were run.
