# Visual system

Dynamic Learner uses a compact Fluent-inspired interface built from native CSS. This file records durable visual rules; feature-specific details belong beside feature code.

## Shared rules

- Use the shared system/Segoe UI stack, 14/20 body text, 12/16 supporting text, restrained semibold headings, and sentence case.
- Use the 4px spacing rhythm. Neutral surfaces/dividers organize; brand blue communicates selection/primary action; semantic success/danger colors keep their meaning.
- Shared palette-independent values belong in `tokens.css`; theme palettes belong in `themes.css`; shared control behavior belongs in `base.css`.
- Reuse `.quiet-button`, `.icon-button`, primary buttons, and shared dialogs before creating feature-local equivalents.
- Keep explanatory text and multiline choices left aligned. Center only compact controls and intentional empty/creation states.
- Avoid ornamental cards, oversized headings, or independent feature palettes unless the feature surface itself requires them.
- Preserve visible keyboard focus, native dialog behavior, touch targets, reduced-motion behavior, and both light/dark themes.
- Feature chrome should stay compact; content surfaces (paper, puzzle grids, study maps) may have specialized presentation.

## Themes and paper

Theme behavior is semantic-token based. New themes register in `src/app/theme.ts` and define a matching palette in `themes.css`. System-follow mode maps one light and one dark theme.

Physical-study surfaces keep their saved paper choice while resolving to paired light/dark tokens. Do not hard-code a feature theme ID to style paper.

## App artwork

Full-resolution app PNGs live directly under `src/assets/app-icons/`. Visible Home/header/sidebar artwork uses 256×256 variants via `src/app/app-icon.ts`: WebP preferred, PNG second, GIF fallback. Browser branding/social assets otherwise live under `src/assets/`.

Home app icons render at 56px; sidebar icons at 24px; header artwork at 28px. Keep source files substantially larger than those render sizes but do not use full-resolution metadata assets for routine UI painting.

## Responsive behavior

Desktop is the baseline. `src/styles/mobile.css` owns phone/coarse-pointer overrides; feature styles own layout-specific container behavior. Keep controls reachable in narrow/short windows, preserve safe-area insets, and avoid horizontal page overflow unless the feature intentionally scrolls a bounded surface.

Touch controls should be at least 44px high. Do not shrink content below readable limits solely to avoid scrolling.

## Paper invariants

Index Cards use a fixed 5:3 paper ratio. The paper has a red margin, blue ruling, stable row geometry, and a separate title area. Typography may scale independently; font settings must not move rules/margins or stretch the paper. Untitled placeholders are edit-only.

Notebook Lined Paper uses portrait Letter/A4 choices, independent per-page headings, separate right-aligned margin notes, fixed ruling geometry, optional punch holes, and pagination by measured textarea content. Display settings may change typography/paper appearance but must not lose text.

Graph Paper has its own interaction/geometry contract; see `graph-paper.md`.

## Interaction consistency

Libraries and adjacent panels stay flush with workspaces rather than becoming floating cards. Collapsed panels occupy no layout space and must be inert/hidden from assistive technology while not usable. Shared resizing behavior should use the common persisted-resize utility where applicable.

Destructive confirmation is required for populated containers but not empty containers or individual cards where immediate deletion is the established behavior.

Review/navigation controls should keep stable placement and sizing when labels/state change. Temporary review/study state must not visually masquerade as saved content.

## Focused manual checks

For UI changes, inspect the changed surface in Light/Dark, keyboard-only use, narrow/short layouts, reduced motion, and touch-sized controls when relevant. Add feature-specific checks only for behavior actually changed.


## Review Quiz attempts and Study scoring

Review Quiz settings include a saved allowed-attempts-per-question value, defaulting to 3. During Quiz, an incorrect check below that limit gives retry feedback without revealing the answer or unlocking navigation; a correct answer or the final allowed attempt finalizes and locks the question. The Quiz overview surfaces the configured attempt count.

Study shows a low-emphasis inline correct-checks / total-checks statistic plus percentage alongside the other small session progress text. It is informational only: retries, hints, answer reveals, navigation, and session completion are unaffected, and the statistic resets with the transient Study session.


Review Study loops from the final question with a quiet **Keep studying** action and right chevron; the chevron uses only a subtle periodic nudge and disables motion when reduced motion is requested. Multiple-choice feedback does not restate the correct answer beneath the choices; final incorrect feedback remains concise while explanations may still appear when authored.


Review pre-session setup follows the same choice-card language as Index Cards review. Study always asks for In order, Reverse order, or Shuffle before its overview. Quiz first offers Default Settings versus Customize Settings; customization is transient and may change question order, question count, multiple-choice answer shuffling, and allowed attempts. Test has no pre-session customization: its saved builder configuration is authoritative. Saved Quiz & Test defaults include order, optional question limit, and answer-choice shuffling; Quiz-specific attempts and Test-specific time/result visibility remain separate.


Review Statements display authored text as a normal session item with no answer control, feedback, hint/reveal tools, or score effect; navigation simply continues to the next item. Fill-in-the-Blanks Index Card imports surface a modal resolver when selected sources contain visible cards without blanks. Every affected card independently chooses **Convert to Statement** or **Discard**, and those decisions remain reviewable from the source row before creation.


## Review question presentation

Review Study displays all questions in one vertical list by default; each card shows its own “Question N of M” label, its answer controls, and its own Check answer/feedback/hints. Quiz and Test authors separately select either **All questions (vertical scroll)** (the default) or **One at a time** in Set options. Quiz may override its saved presentation in Customize Settings; Test uses its saved layout. One-at-a-time Quiz/Test may disable returning to earlier questions; this is enforced by navigation state and reflected in the overview. Scrolling Test still holds feedback until final submission. Statement items remain unscored, and scores/attempts stay per question regardless of layout.
