# Visual system

Dynamic Learner takes its visual basis from Microsoft Fluent 2, using native CSS rather than adding a component library. References: [typography](https://fluent2.microsoft.design/typography), [layout](https://fluent2.microsoft.design/layout), [design tokens](https://fluent2.microsoft.design/design-tokens), and [motion](https://fluent2.microsoft.design/motion). This is a Fluent-inspired implementation, not a claim of certified conformance.

- Use the shared Segoe UI/native font stack, 14/20 body text, 12/16 supporting text, and restrained semibold headings. Use sentence case.
- Use the four-pixel spacing rhythm. Neutral surfaces and dividers organize the workspace; blue identifies primary actions and selection. Reserve red for destructive actions and the paper's ruling.
- Put shared values in `src/styles/tokens.css`. Shared control dimensions, typography, focus, and interaction states belong in `base.css`; navigation belongs in `shell.css`.
- Reuse shared button classes. Card navigation uses three equal grid columns, so Previous, Show front/back, and Next/Finish have matching dimensions even as labels change. Touch controls have a 44-pixel minimum height.
- Keep the library and card list flush with the workspace. Avoid additional floating cards, shadows, borders, or independent color palettes around ordinary controls. The index card keeps its red margin, blue writing lines, and subtle stacked-paper elevation.
- Delete individual cards immediately. Never request deletion confirmation for an empty container: sets with no cards and groups with no children are empty. Confirm deletion only for populated sets and groups.
- Use short, consistent transitions for drawers, selection feedback, and card changes. Respect reduced motion. Preserve visible keyboard focus, native dialog behavior, and readable text.

Feature styles live beside their components. `index-cards.css` owns the library and selected-item frame; `card-set.css` owns the paper, review controls, and workspace composition; `card-list.css` owns the adjacent list and narrow horizontal strip. Review setup and fullscreen deletion each have a dedicated stylesheet.

## Index-card geometry

The paper uses a fixed landscape 5:3 aspect ratio, matching the traditional 3 × 5-inch format. Quarter-inch ruling is modeled as 5% of the card width. Our layout reserves half an inch for the editable title, nine quarter-inch writing rows, and a quarter-inch bottom margin. The row count is this app's layout choice; ruling and margins vary between physical products. Reference: [Pacon 3 × 5-inch, quarter-inch ruled cards](https://www.teachersparadise.com/c/pacon-index-cards-white-ruled-1-4-ruled-3-x-5-100-cards/).

`card-set.css` makes the stack an inline-size container. Paper typography, ruling, and margins use its container width, so the same text and number of rows scale together across window and sidebar sizes. These are physical proportions, not a promise of actual inches on an uncalibrated screen. Both sides retain ruling for editing. Existing longer content scrolls within the nine-row writing area; the paper never stretches and no new content limit is imposed.

## Manual review

Start with `npm start`. Check the main navigation drawer, library collapse/restore, groups, populated and empty sets, review setup, and deletion cancellation. Confirm the paper retains a 5:3 shape and nine writing rows when resizing or toggling the library, with red and blue lines, all three navigation buttons match in size, and title/side editing remains usable. Resize to narrow and short windows; confirm panels scroll, the narrow card strip reveals the selected card, and no controls become unreachable. Try keyboard focus and reduced motion, then inspect the browser console. Do not run automated checks unless requested.
