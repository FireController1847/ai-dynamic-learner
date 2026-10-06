# Calculator artwork

`src/assets/app-icons/calculator.png` is the transparent 1254 × 1254 source used for Calculator route/social metadata. Home, navigation, and the page header use the 256 × 256 variants under `src/assets/app-icons/{webp,png,gif}/`. The shared feature definition supplies the full-resolution image path, dimensions, media type, and alternative description to the existing Open Graph, Twitter, and JSON-LD metadata generator.

Generated with the built-in image generation tool, using `src/assets/app-icons/notebook.png`, `src/assets/app-icons/word-search.png`, and `src/assets/app-icons/index-cards.png` as style references. The icon preserves their glossy blue-and-white finish, cyan highlights, rounded bevels, and slight counterclockwise tilt.

## Generation prompt

Use case: stylized-concept. Asset type: Calculator app icon for Dynamic Learner. Create one new calculator icon matching the supplied STYLE REFERENCES: Image 1 Notebook, Image 2 Word Search, Image 3 Index Cards. Match their glossy softly beveled 3D blue-and-white illustration, saturated cobalt-blue edges fading to bright cyan highlights, icy-white face, soft upper-left studio highlights, slight counterclockwise tilt and shallow perspective. Subject: one compact handheld calculator with rounded corners, a bold cobalt/cyan beveled outer shell, an icy-white face, a wide recessed pale-blue display near the top showing the exact digits "123", and a tidy four-column keypad of generously rounded raised square buttons. Make the keypad recognizable with understated blue number symbols and four prominent saturated-blue arithmetic buttons labeled "+", "−", "×", and "=" with white symbols. Keep the layout orderly, simple and readable at small app-icon sizes. Composition: calculator almost fills the square canvas with a small safe margin, fully visible without cropping. Actual transparent background, preserving alpha. No scenery, no decorative background, no captions, no branding, no watermark, no extra objects. Produce one standalone square transparent PNG.

## Manual review

Inspect the icon beside the other apps on Home, in navigation, and in the Calculator page header at desktop and phone widths, in Light and Dark themes. Check `/calculator/` directly and after refresh. After the next requested production build, inspect the route's Open Graph/Twitter image URL, dimensions, alternative description, and JSON-LD. Generated output stays in ignored `dist/`.
