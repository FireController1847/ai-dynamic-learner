# Todo List artwork

`src/assets/todo-list.png` is the transparent 1254 × 1254 PNG used by Home, navigation, the page header, and the Todo List coming-soon screen. The feature definition also supplies this image and its dimensions, media type, and alternative description to the existing Open Graph, Twitter, and JSON-LD metadata generator. The canonical URL, title, description, and other shared metadata come from the existing route generation.

Generated with the built-in image generation tool, using `src/assets/notebook.png` and `src/assets/index-cards.png` as style references.

## Generation prompt

Create a new Todo List app icon matching the supplied Notebook and Index Cards STYLE REFERENCES. Produce one standalone clipboard checklist icon: glossy softly beveled 3D blue-and-white illustration, saturated cobalt-blue edges fading to bright cyan highlights, white icy-blue paper face, rounded corners, soft upper-left studio highlights, slight counterclockwise tilt and shallow perspective matching the references. One blue-backed clipboard with a small blue top clip and three checklist rows: two blue checkmarks inside rounded squares, one empty checkbox, and short rounded pale-blue lines alongside. Bold readable silhouette at tiny icon sizes. Tight square framing, object almost fills the canvas with small safe margin, no cropping. Actual transparent background. No lettering, no watermark, no scenery. Square PNG.

## Manual review

Inspect the icon on Home, in navigation, in the header, and on the coming-soon screen at desktop and phone widths. Check `/todo-list/` directly and after refresh. After the next production build, inspect the route's title, description, canonical URL, Open Graph/Twitter image URL and dimensions, and JSON-LD. Generated output stays in ignored `dist/`.
