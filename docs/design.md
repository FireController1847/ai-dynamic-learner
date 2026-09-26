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

The paper uses a fixed landscape 5:3 aspect ratio, matching the traditional 3 × 5-inch format. Quarter-inch ruling is modeled as 5% of the card width. Our layout reserves half an inch for the editable title and ten quarter-inch writing rows extending to the bottom edge. The row count is this app's layout choice; ruling and margins vary between physical products. Reference: [Pacon 3 × 5-inch, quarter-inch ruled cards](https://www.teachersparadise.com/c/pacon-index-cards-white-ruled-1-4-ruled-3-x-5-100-cards/).

`card-set.css` makes the stack an inline-size container. Paper typography, ruling, and margins use its container width, so the same text and number of rows scale together across window and sidebar sizes. These are physical proportions, not a promise of actual inches on an uncalibrated screen. Both sides retain ruling for editing. Existing longer content scrolls within the ten-row writing area; the paper never stretches and no new content limit is imposed.

The library's Settings footer opens Display options with a live sample card. `display-options.js` is the canonical source for choices, defaults, bounds, validation, and CSS mapping. The feature entry applies these CSS properties to all sets and the preview. Defaults use regular-weight Serif (Georgia), neutral pencil ink (#3d3d3d), 100% text/card sizing, and a one-pixel downward text adjustment. Sans, larger/smaller text and cards, darker ink, and vertical alignment are configurable. No font download is required. Text size is relative to the paper; card size is a preferred responsive scale, bounded by the available screen space.

Adjust text independently of the paper: line spacing, rule positions, horizontal margins, and aspect ratio do not change with font settings. The red margin is drawn on the card face to reach the bottom regardless of textarea scrolling. The rest of the interface retains its shared UI typography. Display settings save across sets and reloads and travel in workspace backups; Reset display defaults changes only these preferences.

## Manual review

Mobile/tablet overrides live in `styles/mobile.css`: phone widths ≤700px and coarse-pointer tablet widths ≤1100px. Avoid changing shared desktop metrics for device-specific fixes. Small screens use a dismissible library overlay, a single scrolling card workspace, horizontal card navigation, 44px touch targets, safe-area padding, and scrollable dialogs. The viewport permits normal zoom and requests keyboard-driven content resizing where supported. Font sizes on the paper still follow the user's proportional display settings.

On a phone and touch tablet, check portrait/landscape, restored and newly created sets, library backdrop/Escape dismissal, renaming, nested groups, Settings, and keyboard-open editing on both card sides. Make sure the editor, card strip, location controls, and dialog actions remain reachable. Check short landscape windows and notched-device safe areas. On a desktop with a mouse, confirm the existing side-by-side layout and sizing remain unchanged. No browser automation is required unless requested.

Start with `npm start`. Check the main navigation drawer, library collapse/restore, groups, populated and empty sets, review setup, and deletion cancellation. Confirm the paper retains a 5:3 shape and ten writing rows when resizing or toggling the library, with red and blue lines, all three navigation buttons match in size, and title/side editing remains usable. Resize to narrow and short windows; confirm panels scroll, the narrow card strip reveals the selected card, and no controls become unreachable. Try keyboard focus and reduced motion, then inspect the browser console. Do not run automated checks unless requested.

Open Settings with an empty library and with a selected set. Try both fonts, every ink choice, and slider extremes; check the live preview and actual cards, the last writing row, and scrolling long text. Close with Done or Escape and confirm focus returns to Settings. Reload, switch sets, and download/restore a backup to check preferences persist. Restore an older backup without display settings to check defaults; invalid setting values should reject the backup without changing the workspace. Reset display defaults and check content stays intact.

The title rests along the red header rule; its vertical inset uses the same `--card-baseline` setting as body text, including in the Settings preview. The two editable faces rotate through 180 degrees on flip, while the paper stack remains still. The concealed face is inert and hidden from assistive technology; reduced motion makes the change immediate. Manually check both directions, rapid flipping, both fonts and text-offset extremes, keyboard focus, and the bottom writing row.
