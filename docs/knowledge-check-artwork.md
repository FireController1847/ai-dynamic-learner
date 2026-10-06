# Review artwork

The app is now named Review. The existing artwork and `knowledge-check` asset filename are retained; the generation prompt below records the original branding.

`src/assets/app-icons/knowledge-check.png` is the transparent 1254 × 1254 source used for Review route/social metadata. Home, navigation, and the page header use the 256 × 256 variants under `src/assets/app-icons/{webp,png,gif}/`. The shared feature definition supplies the full-resolution image path, dimensions, media type, and alternative description to the existing Open Graph, Twitter, and JSON-LD metadata generator.

Generated with the built-in image generation tool after inspecting the Todo List and Crossword artwork for style. The icon matches their glossy blue-and-white finish, cyan highlights, rounded bevels, and slight counterclockwise tilt. A question mark, answer choices, and checkmark badge identify the quiz scaffold.

## Generation prompt

Use case: stylized-concept. Asset type: Knowledge Check app icon for Dynamic Learner. Create one brand-new standalone square transparent PNG illustration. Match the workspace app icon family: glossy softly beveled 3D cobalt-blue and icy-white objects, bright cyan highlights along upper-left edges, rounded thick blue borders, shallow perspective and slight counterclockwise tilt, very clean polished toy-like rendering. Subject: one rounded rectangular quiz answer sheet with a thick cobalt/cyan beveled rim and icy-white face. A single large bold blue question mark dominates the upper portion; below it are two simple multiple-choice answer rows with small circular selectors and short blue horizontal answer strokes, one selector filled. A prominent small round cobalt-blue seal with a crisp white checkmark overlaps the sheet's lower-right corner to signify checked knowledge. The question mark and answer rows should make this recognizable as a quiz rather than a todo clipboard. No clipboard clip, no pencil, no letters or words except the question mark symbol. Composition: centered object almost fills the square canvas with a small safe margin, entirely visible without cropping, strong readable silhouette at tiny sizes, balanced simple details. Soft upper-left studio lighting, subtle dimensional shading restricted to the object. Genuinely transparent background, preserve alpha, no floor or background shadow, no scenery, no caption, no branding, no watermark. Match the glossy blue-and-white finish of Dynamic Learner's existing Todo List and Crossword artwork.

## Manual review

Inspect the icon beside other apps on Home, in navigation, and in the page header at desktop and phone widths, in Light and Dark themes. Open `/knowledge-check/` directly and refresh. After the next requested production build, inspect its Open Graph/Twitter image URL, dimensions, alternative description, and JSON-LD. The same generated app identity is used for knowledge sets and their Study, Quiz, and Test workflows.
