# Crossword artwork

`src/assets/app-icons/crossword.png` is the transparent 1254 × 1254 source used for Crossword route/social metadata. Home, navigation, and the page header use the 256 × 256 variants under `src/assets/app-icons/{webp,png,gif}/`; the empty-library and selected-group creation screens use the sidebar's Crossword SVG icon. The feature definition supplies the full-resolution image path, dimensions, media type, and alternative description to the existing Open Graph, Twitter, and JSON-LD metadata generator.

Generated with the built-in image generation tool, using `src/assets/app-icons/notebook.png`, `src/assets/app-icons/word-search.png`, and `src/assets/app-icons/index-cards.png` as style references.

## Generation prompt

Use case: stylized-concept. Asset type: Crossword app icon for Dynamic Learner. Create one brand-new crossword puzzle icon matching the supplied STYLE REFERENCES: Image 1 Notebook, Image 2 Word Search, Image 3 Index Cards. Match their glossy softly beveled 3D blue-and-white illustration, saturated cobalt-blue edges fading to bright cyan highlights, icy-white face, soft upper-left studio highlights, slight counterclockwise tilt and shallow perspective. Subject: one square crossword board with a bold cobalt/cyan beveled outer edge, a crisp regular grid of approximately 5 by 5 square cells, white open cells and deep cobalt-blue blocked cells in a recognizable crossword pattern. Show a few bold blue capital letters arranged as intersecting Across and Down words in the open cells, with tiny unobtrusive clue numbers. Keep the cell structure orderly and the crossword silhouette legible at tiny icon sizes. Composition: object almost fills the square canvas with a small safe margin, fully visible, no cropping. Actual transparent background. No scenery, no decorative background, no caption, no watermark, no magnifying glass, no pencil or extra objects. Produce one standalone square transparent PNG.

## Manual review

Inspect the generated icon on Home, in navigation, and in the header at desktop and phone widths. The empty-library and selected-group screens should show the creation SVG instead. Check `/crossword/` directly and after refresh. After the next requested production build, inspect the route's Open Graph/Twitter image URL, dimensions, alternative description, and JSON-LD. Generated output stays in ignored `dist/`.
