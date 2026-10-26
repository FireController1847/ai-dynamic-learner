# Review publishing

Publish is a browser-local, transient workspace mode like Build. Large choice
buttons offer Study, Gap, and Bubble. Study and Bubble are available; Gap is
disabled and marked Coming soon.

- **Bubble:** Only Multiple Choice (including multi-select), True/False,
  Dropdown/matching, and informational Statements. Short Answer, Fill in the
  Blanks, and Parameterized questions remain unsupported. Bubble stays selectable:
  choosing Bubble with unsupported questions opens a separate warning screen
  before any preview generation. It groups omitted question numbers by reason
  and offers Continue with the supported item count, Use Study, and Back to
  selection. Continue is disabled when no supported items remain. No exclusion
  notices appear inside the cards or above the preview. Unsupported questions are
  excluded from question pages, the response grid, and the optional key. Multiple
  Choice/Dropdown with more than eight choices (A–H) are also excluded. Original
  numbers are preserved throughout, so omissions leave visible numbering gaps.
  Only included questions must be complete; the entire authored bank is still
  validated, and excluded parameterized questions do not run their solvers.
  The bubble sheet has three densely packed columns with 10.5pt circular bubbles and minimal vertical gaps, regardless
  of the question-page columns. No written-answer lines. Dropdown matches are
  shown as 2.1, 2.2, 2.3 etc. on the questions and response grid; the key gives
  each sub-answer's letter. Multi-select rows have an * indicator, and Statements
  have no bubbles. Questions Only includes a blank bubble sheet, Questions and
  Answer Key places the key after the bubble sheet, Answer Key Only prints just
  the key.

- **Gap (planned):** two or three questions vertically per page with large spaces
  for written responses.
- **Study:** compact one- or two-column sheets, numbered in document order, with
  lettered choices learners can circle. Questions without choices retain compact
  response lines, authored blanks, or matching rows; Statements stay informational.
  One column is now the default and uses deeper letter-choice indentation.
  All column layouts (single, independent two-column, and row-aligned two-column)
  use matching question spacing: Compact has a tight 6pt gap and a 16pt title gap;
  Comfortable has a visibly looser 20pt gap and a 40pt title gap. Type/section
  transitions receive a consistent additional 12pt separation. Two columns remain
  available. With
  alignment off, columns flow independently,
  so a tall Fill in the Blanks question does not create a matching gap across
  the page; question order reads downward through each column. With **Align
  questions** on, paired rows (1/2, 3/4) preserve the original start alignment.
  One column uses the full printable width and disables the checkbox in Settings. Section
  spacing belongs after the preceding item so that new column/page starts do
  not inherit extra top padding. The toolbar offers Question text styling:
  Regular (default), Bold, Italic, Bold italic, and Underline; styling applies to
  question prompts, not answer choices or document headings.
  Title layouts offer Cover page, Comfortable, and Compact. Comfortable is the
  default: title and blank Name line on the first question page with a larger gap
  below and more space between questions in every column mode. Compact uses
  significantly tighter spacing. Cover page
  now produces a dedicated, modern, ink-friendly title sheet with a slim
  Dynamic Learner masthead, generous editorial title hierarchy, a practice-question
  count, configurable lined identification fields, and a quiet footer. Its height follows the
  selected paper/orientation/margins with extra space for pagination rounding,
  and the first-page number is suppressed. The questions begin on the next page
  with Comfortable spacing; Compact/Comfortable layouts otherwise retain their
  inline headings. Comfortable and Compact headings share the answer key's
  small Dynamic Learner / Review masthead and editorial title typography,
  using one shared header renderer. The masthead places Dynamic Learner / Review
  on the left and Study sheet, Bubble sheet, or Answer key on the right in matching
  small uppercase type. That masthead sits halfway into the top page margin and
  extends one-third of the selected margin beyond the body on each side; both
  offsets adapt to Standard/Compact margins. The large bold knowledge-set title
  stays aligned to the body beneath it,
  followed by the Name line on question sheets. These are opening-page headers
  rendered once per section, not repeated on continuation pages.
  Enabled identification fields provide their own underlines; these headers omit the extra divider. They retain their respective 40pt/16pt gaps before questions.
  Layout choices never change question font family
  or size. Question pages never display correct-answer highlighting or explanations.
  A new **Content** selector in the leftmost settings group controls which pages
  are generated: Questions Only (default), Questions and Answer Key, or Answer Key
  Only. The combined setting appends a separately titled key on a new page;
  key-only omits question sheets and any optional cover. The key matches the
  *generated* question/choice order and numbered questions, including lettered
  multiple choice (all correct letters), True/False, Fill in the Blanks, matching,
  short answers, parameterized generated values, and informational Statements.
  Long keys can continue across pages. Key layout follows the chosen column count.

At every Review pane width (including desktop), the document settings occupy
one horizontally scrollable row without wrapping or stray group separators;
the native scrollbar and keyboard focus keep hidden settings reachable.
Dropdown menus stay outside the clipped scrolling surface. Version, Refresh,
and Print share one bottom toolbar with page/item status, cancellation, and zoom.
Settings sits to the left of Version; the gear belongs to Settings and Version
uses a tag icon. Settings opens the shared modal dialog with Align questions
(disabled in one column) and independent Question sheet / Answer key metadata
switches: header left, header right, knowledge-set title, Name, Date, Class, and
header notes/instructions. The question sheet also offers its cover question
count. Question metadata applies to inline headings, covers, and the bubble
answer sheet. Blank identification fields do not include saved learner data.
Disabling all metadata removes empty heading space and suppresses an otherwise
empty cover. Headers with identification lines omit the extra divider. Settings
remain transient, outside workspace storage/backups, and nested values are copied
before asynchronous preparation so later edits cannot change an existing job.
The toolbar wraps in narrow panes without separate stacked bar borders. The Version
panel expands beneath it. Aligned
pairs no longer add offset padding to right-side questions of a different type.


Publish and the preceding Study/Quiz/Test selection use `choice-screen.ts` for
one shared screen/header/card renderer and the same `knowledge-check-builder`
and `knowledge-check-type-*` styles. Publish orders its cards Study, Gap, Bubble.
The Publish heading describes the layout choice instead of repeating the knowledge-set title.
There are no Publish-specific card sizes or responsive overrides. Gap uses the
shared disabled-card treatment and shows Coming soon. The main selector retains
its resume labels, statistics, and actions. The Publish Refresh action uses a
two-arrow circular icon.

Study uses a read-only document workspace: page settings sit above a scrolling
canvas, while version, refresh, print, status, and zoom controls share the bottom
bar. The canvas consists of separate white pages on a gray background. Fit width
is the default; Fit page remains available. Version opens a responsive inline
panel using shared themed input styles, with Done returning focus to its button.
Entering Study automatically generates its preview. Paper, orientation, margin,
title-layout, column count, alignment, version-code, or content changes debounce a replacement preview; Print stays
unavailable until it is ready. Zoom offers Fit page, Fit width, and 25–200%, and resizes only
the screen canvas without regenerating questions or changing printed dimensions.

The top toolbar uses icon/text menu buttons with current values, selection checks,
and descriptive options. The font trigger uses the normal app font and fits its
label; font choices preview their typefaces only inside the menu. The point-size
field uses the same quiet toolbar styling, shows its border on focus, and hides
native spinner arrows while retaining numeric keyboard input and validation.
`publication-dropdown.ts` owns these feature-local menus:
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
   future delivery formats. Question views always omit answer records and
   explanations; a separate, minimal answer-key projection is populated only
   when the user explicitly selects a key-producing content option.
2. `prepare-publication.ts` validates a deep copy of the authored bank, resolves
   parameterized questions through the existing generator/sandbox, and resolves
   choice pools. It rejects unfinished included questions and unimplemented publishing modes.
   Included authored items keep their order and original numbers; Bubble omits
   unsupported items using the same policy as its visible warnings. Session limits,
   responses, history, and statistics are excluded. It never mutates the authored set.
3. `publicationView` projects the detached source into learner-facing content
   and, only by explicit user choice, a separately numbered key.
   Source snapshots contain answers and must not be exported directly. Fill-in-
   the-Blanks prompts are masked. Multiple-answer choices, matching labels,
   generated answer fields, Markdown contexts, and Statements retain their meaning.
   The original question type is retained as transient display metadata for spacing.
4. `preparePublicationJob` is the preparation entry point. Its view can feed paged
   or non-paged delivery adapters.
5. `study-renderer.ts` supplies reusable question/cover/key sections and
   print-only typography. `bubble-renderer.ts` reuses those sections but adds a
   separate, printable bubble/write-in response sheet; its CSS is scoped to
   Bubble mode. Both renderers use text nodes and sanctioned Markdown rendering.
   Study uses
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
assets, while the app's chrome/theme styles are excluded. Renderers are lazy
loaded only when the selected publishing mode generates a preview.

## Determinism and lifecycle

The version code is the generation seed. Unchanged authored content and the same
code reproduce generated questions/choice pools, using question IDs as per-question
seed inputs. Uploaded solvers still execute through the existing sandbox. Entering
Study, updating its settings/content, or refreshing the preview runs generation.
Prepared views contain concrete
display content, not uploaded solver code.

Page settings/jobs are transient, outside workspace backups. Settings/content
changes cancel work and regenerate the preview, including reactive updates from
another tab. Back to the mode picker, unmount, and deactivation release the preview.
During updates the previous preview remains visible and scrollable with a small
loading indicator. New frames have opacity zero, are inert/hidden from assistive
technology, and retain layout dimensions until pagination/fonts/zoom are ready.
The caller restores scroll, awaits `reveal()` to crossfade/slide the finished frame
over the previous preview, then disposes the old one. Cancellation also stops any
in-progress reveal animation without discarding the prior preview.
Errors/cancellation retain the previous preview; the app's Print action stays
disabled for stale pages.
Publish selection, warning, and document screens have distinct transition keys
inside one stable workspace shell. Their headings/content travel together through
the same Review screen transitions, including focus/inert and reduced-motion
behavior. Pagination starts after the document entrance finishes. Changed exclusion
lists (including cross-tab updates) return Bubble to the warning screen before
regenerating; acceptance applies only to the displayed list.
Menus, Version-panel expansion, mode navigation, loading indicators, page reveal,
and zoom transitions animate. Reduced motion disables movement and transitions;
printed output excludes all screen animations. The canvas is very light gray; white
sheets retain outlines, shadows, and visible gaps.
Entering Publish honors the existing session leave guard and workspace transition.
The heading receives focus. The Review workspace scrolls independently above the persistent Location and order
footer; session results and Study navigation reset that workspace scroll position.
The shared Review header combines the knowledge-set title, question count, and
History/Publish/Build buttons in one row; there is no Mode dropdown or redundant
Knowledge set label. Study/Quiz/Test selection and existing Back navigation own
mode changes. Header actions stay visible with controls disabled while publishing
or building. Document previews omit the separate
sheet-type/title header; their Back button sits beside the disabled toolbar
buttons and returns to the publishing mode picker. The picker keeps its own
Publish heading and Back button, which returns to the previous Review view.
Returning to the picker cancels pending generation and releases the document preview.

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

- Open Publish from either action row. Verify Gap shows Coming soon and cannot
  start; Bubble and Study each open settings and the correct preview. Check
  keyboard/focus, Back from document to publishing selection and Back again to
  Review, the visible disabled Review toolbar, active-session leave confirmation,
  Light/Dark, narrow panes, and touch controls.
- Generate a mixed-type set. Verify tighter question gaps and deeper answer-letter
  indent in the default full-width one-column output, regular/bold/italic/bold-italic/
  underline question text, flush starts in independent two-column mode (including
  pages where columns begin with different question types), and optional
  aligned pairs (1/2, 3/4); the alignment control in Settings disables in one-column mode.
  Check FitB height differences, numbered flow, page breaks, and no clipped or
  duplicated questions in preview/print/PDF. Check lettered choices, odd item counts, wrapped
  prompts/options, readable margins, no answer markings on question pages, and accurate page counts.
  Comfortable/Compact should start with their title, Name line and questions,
  without a blank page. Only Cover page should put the questions on page two.
  Check title/question spacing and the Version panel's input, wrapping, Done, and themes.
- Check Bubble's dense optical rows, A–H circles, multi-select markers and
  Dropdown subquestion numbers matching across question pages, response grid
  and optional key. Choose Bubble with Short Answer, Fill in the Blanks,
  Parameterized questions, and Dropdowns with more than eight choices. Verify the
  dedicated warning screen appears before preview generation, with accurate
  exclusions/counts, Back, Use Study, and explicit Continue. Entirely unsupported
  sets must disable Continue. Confirm excluded items are absent from questions,
  bubbles, and key, while supported items keep their original numbers. Change the
  exclusion list in another tab and verify renewed confirmation before generation.
  Check Settings to the left of tag-icon Version, the alignment control inside
  Settings, and independent metadata toggles for questions and key in all title
  layouts. Verify Name/Date/Class lines, left/right headers, title, header notes,
  cover counts, all-off headers/cover, and the bubble answer sheet. Changes must
  update preview without changing saved content or older jobs. Check dialog Close,
  Escape, focus restoration, the shared bottom toolbar, Version expansion, and transitions with
  keyboard, narrow panes, themes, and reduced motion.
  Ensure no written-answer lines and no unexplained omissions. Print long sets
  with Letter/A4 and both orientations to check pagination, then verify Questions Only/Both/Key Only.
- Switch Content between Questions Only, Questions and Answer Key, and Answer Key
  Only. Verify no answers leak onto question pages, the key begins on a new sheet
  after all questions, and key-only omits questions and the cover even when Cover
  is selected. Check correct letters after randomized choice pools, every correct
  answer for multi-select, True/False, typed blanks, matching, generated variables,
  and Statements; check key continuation across multiple pages and PDF output.
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
- Change settings/content during generation, cancel, return to mode selection, or leave Publish:
  partially rendered frames must remain invisible, the last complete preview
  should remain while updating, and Print must stay unavailable until current
  pages are ready. Check scroll preservation and cancellation/error fallback.
  Repeat previews with the same seed to check generated-content stability.

Browser/print behavior requires manual verification; type checking and building
alone do not establish pagination or visual correctness.
