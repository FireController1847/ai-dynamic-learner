# Review publishing

Publish is a browser-local, transient workspace mode like Build. Large choice
buttons offer Bubble, Gap, and Study. Only Study is available; Bubble and Gap are
disabled and marked Coming soon.

- **Bubble (planned):** A–D question sheet, a name field, and a bubble answer sheet
  on the last page.
- **Gap (planned):** two or three questions vertically per page with large spaces
  for written responses.
- **Study:** compact one- or two-column sheets, numbered in document order, with
  lettered choices learners can circle. Questions without choices retain compact
  response lines, authored blanks, or matching rows; Statements stay informational.
  One column is now the default and uses slightly closer question spacing and
  additional letter-choice indentation. Two columns remain available. With
  alignment off, columns flow independently,
  so a tall Fill in the Blanks question does not create a matching gap across
  the page; question order reads downward through each column. With **Align
  questions** on, paired rows (1/2, 3/4) preserve the original start alignment.
  One column uses the full printable width and disables the checkbox. Section
  spacing belongs after the preceding item so that new column/page starts do
  not inherit extra top padding. The toolbar offers Question text styling:
  Regular (default), Bold, Italic, Bold italic, and Underline; styling applies to
  question prompts, not answer choices or document headings.
  Title layouts offer Cover page, Comfortable, and Compact. Comfortable is the
  default: title and blank Name line on the first question page with a larger gap
  below and more space between pairs. Compact uses tighter spacing. Cover page
  puts the title and Name line on a separate opening page, followed by comfortable
  question pages. Layout choices never change font family or size. No description,
  correct-answer highlighting, explanations, or answer key are printed.

On narrow Review panes, the document settings bar scrolls sideways without
clipping its menus. Version, Refresh, and Print sit together in a dedicated action
row just above the preview, rather than crowding the settings controls. Aligned
pairs no longer add offset padding to right-side questions of a different type.

Study uses a read-only document workspace: page settings, version, refresh, and
print controls sit above a scrolling canvas of separate white pages on a gray
background. Zoom out/in and the zoom selector sit at the bottom right. Fit width
is the default; Fit page remains available. Version opens a responsive inline
panel using shared themed input styles, with Done returning focus to its button.
Entering Study automatically generates its preview. Paper, orientation, margin,
title-layout, column count, alignment, version-code, or content changes debounce a replacement preview; Print stays
unavailable until it is ready. Zoom offers Fit page, Fit width, and 25–200%, and resizes only
the screen canvas without regenerating questions or changing printed dimensions.

The top toolbar uses icon/text menu buttons with current values, selection checks,
and descriptive options. `publication-dropdown.ts` owns these feature-local menus:
arrows/Home/End and character search navigate; Escape/outside click/Tab close them;
selection returns focus to the trigger. Menus clamp horizontally inside the pane
and have scrollable height limits. Font size is an editable point-size field.
The default is Times New Roman, 12pt, in every layout. Users can choose Times New
Roman, Georgia, Arial, Calibri, or Verdana and sizes from 8–32pt in 0.5pt steps.
These are local font stacks with fallbacks, not remote font downloads. Typeface
and size apply to questions, response options, contexts, and name lines; title
size stays proportional. Layout changes affect only spacing and page placement.
Authored question type/Statement boundaries get extra section spacing without
reordering questions or changing the number of columns.

Study offers Letter/A4, portrait/landscape, compact/standard margins (standard by
default), a Paged.js preview, and PDF saving through the browser Print dialog.
Paper dimensions are explicit millimetre values with width/height swapped for
landscape. This avoids the case-sensitive paper-name lookup in Paged.js 0.4.x
(its built-in key is `letter`, not `Letter`). Nothing is uploaded.
There is no direct PDF encoder, HTML download, or publishing server.

## Pipeline and ownership

All publishing modules live in `src/features/knowledge-check/publishing/`. Keep
them feature-local until another app actually needs shared publication behavior.

1. `publication-model.ts` owns mode definitions, validated page settings, and the
   renderer-neutral document/view contracts. Publishing modes are separate from
   future delivery formats. Views omit answer records and explanations.
2. `prepare-publication.ts` validates a deep copy of the authored bank, resolves
   parameterized questions through the existing generator/sandbox, and resolves
   choice pools. It rejects unfinished banks and unimplemented publishing modes.
   All authored items keep their order; session limits, responses, history, and
   statistics are excluded. It never mutates the authored set.
3. `publicationView` projects the detached source into learner-facing content.
   Source snapshots contain answers and must not be exported directly. Fill-in-
   the-Blanks prompts are masked. Multiple-answer choices, matching labels,
   generated answer fields, Markdown contexts, and Statements retain their meaning.
   The original question type is retained as transient display metadata for spacing.
4. `preparePublicationJob` is the preparation entry point. Its view can feed paged
   or non-paged delivery adapters.
5. `study-renderer.ts` supplies a DOM fragment and self-contained typography. It
   uses Vue/text nodes and the shared sanitized Markdown/KaTeX pipeline. A borderless
   presentation table holds each question pair as an independent top-level block.
   The compact header permits a break after itself rather than keeping with one
   bank-wide table, which could push the heading backwards onto an empty opening
   page. Row/question breaks prefer to keep content together.
6. `paged-runtime.ts` loads the pinned, local Paged.js Previewer bundle inside a
   fresh iframe. It applies page settings and renderer styles, then returns a page
   count, frame, `setZoom()`, `reveal()`, and `dispose()` handle. `publication-viewport.ts`
   fits/scales the completed page stack with a ResizeObserver and screen-only CSS;
   its wrapper and transforms are removed from print layout. `publication-setup.ts` owns generation,
   cancellation, preview state, and the explicit browser print action.

`study-sheet.css` controls dense, black-on-white paper typography. CSS imports
ending in `?publication` use css-loader's string export: font URLs remain bundled
assets, while the app's chrome/theme styles are excluded. The renderer is loaded
only when Study generates a preview.

## Determinism and lifecycle

The version code is the generation seed. Unchanged authored content and the same
code reproduce generated questions/choice pools, using question IDs as per-question
seed inputs. Uploaded solvers still execute through the existing sandbox. Entering
Study, updating its settings/content, or refreshing the preview runs generation.
Prepared views contain concrete
display content, not uploaded solver code.

Page settings/jobs are transient, outside workspace backups. Settings/content
changes cancel work and regenerate the preview, including reactive updates from
another tab. Change mode, Back, unmount, and deactivation release the preview.
During updates the previous preview remains visible and scrollable with a small
loading indicator. New frames have opacity zero, are inert/hidden from assistive
technology, and retain layout dimensions until pagination/fonts/zoom are ready.
The caller restores scroll, awaits `reveal()` to crossfade/slide the finished frame
over the previous preview, then disposes the old one. Cancellation also stops any
in-progress reveal animation without discarding the prior preview.
Errors/cancellation retain the previous preview; the app's Print action stays
disabled for stale pages.
Menus, Version-panel expansion, mode navigation, loading indicators, page reveal,
and zoom transitions animate. Reduced motion disables movement and transitions;
printed output excludes all screen animations. The canvas is very light gray; white
sheets retain outlines, shadows, and visible gaps.
Entering Publish honors the existing session leave guard and workspace transition.
The heading receives focus. The ordinary Review mode/action row is hidden while
Publish owns the workspace; its own Back action returns to the previous view.

Paged.js 0.4.x uses global DOM APIs and injects styles even with `renderTo`. Its
Previewer runs in the preview frame's own window/document, using the non-auto-running
bundle. This isolates layout/styles, not untrusted scripts. Renderers must never
interpolate authored HTML. The host must be attached and visible for layout; each
run owns a fresh frame. Failure, cancellation, or timeout removes it. A successful
run must be disposed on replacement/close. No CDN is used.

Viewer canvas/gutters/shadows belong in `publication-viewport.ts`, injected directly
into the frame after pagination and before measuring its natural size. Do not pass
them through Paged.js's stylesheet processor: its PrintMedia handler discards
`@media screen` and promotes `@media print` rules into unconditional rules. Native
screen/print rules in the post-pagination viewer stylesheet keep the gray canvas,
white sheets, gaps, and shadows visible on screen while excluding them from print.

## Manual checks

- Open Publish from either action row. Verify Bubble/Gap show Coming soon and
  cannot start; Study opens settings. Check keyboard/focus, Change mode, Back,
  active-session leave confirmation, Light/Dark, narrow panes, and touch controls.
- Generate a mixed-type set. Verify tighter question gaps and deeper answer-letter
  indent in the default full-width one-column output, regular/bold/italic/bold-italic/
  underline question text, flush starts in independent two-column mode (including
  pages where columns begin with different question types), and optional
  aligned pairs (1/2, 3/4); the alignment control disables in one-column mode.
  Check FitB height differences, numbered flow, page breaks, and no clipped or
  duplicated questions in preview/print/PDF. Check lettered choices, odd item counts, wrapped
  prompts/options, readable margins, no answer markings, and accurate page counts.
  Comfortable/Compact should start with their title, Name line and questions,
  without a blank page. Only Cover page should put the questions on page two.
  Check title/question spacing and the Version panel's input, wrapping, Done, and themes.
- Verify all three layouts keep Times New Roman 12pt by default. Change font and
  point size, then change layouts: typography must persist. Check section/type
  spacing and font fallback on systems without a selected font.
- Navigate every toolbar menu with keyboard and touch. Check current values,
  selected checks, Escape/outside click, arrow keys, font-size editing, menu bounds,
  and focus restoration. Check panel/menu/page animations with reduced motion on/off.
- Check Statements, multi-answer choices, blanks, matching, short responses,
  generated fields, choice pools, and Markdown/math contexts. Check long questions,
  tables/images, font loading, page boundaries, and unchanged authored content.
- Compare preview with browser print/Save as PDF on Letter/A4 and both orientations.
  Check printed page sizes, margins, page numbers, and absence of app chrome.
  Verify portrait/landscape swap the actual sheet dimensions and standard margins
  are selected initially.
  Resize the library/workspace and check Fit page/width, then 25/100/200% zoom and
  scrolling across multiple pages. Zoom must not change page count or PDF sizing.
- Change settings/content during generation, cancel, change mode, or leave Publish:
  partially rendered frames must remain invisible, the last complete preview
  should remain while updating, and Print must stay unavailable until current
  pages are ready. Check scroll preservation and cancellation/error fallback.
  Repeat previews with the same seed to check generated-content stability.

Browser/print behavior requires manual verification; type checking and building
alone do not establish pagination or visual correctness.
