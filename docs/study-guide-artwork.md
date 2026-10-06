# Study Guide artwork

`src/assets/study-guide.png` is a transparent 1254 × 1254 PNG supplying the Study Guide artwork on Home, in navigation, in the page header, and in route social metadata. Study Guide is grouped under Mastery immediately before Review. Its feature definition owns the shared asset reference and image metadata.

Generated with the built-in image generation tool. The existing Notebook and Review assets were inspected for the glossy blue-and-white style. The open book, ribbon bookmark, note strokes, and highlighted key idea distinguish this icon from the closed Notebook and Review quiz sheet. The generated PNG is copied into the workspace without changing its transparency.

## Generation prompt

undefined

## Manual review

Check that Study Guide appears before Review in Mastery and navigation. Compare its artwork with the other apps in Light and Dark themes, at desktop and phone widths. Open `/study-guide/` directly and refresh; it remains an empty scaffold with the shared app header. Check Home search still finds Study Guide. After the next requested production build, inspect route metadata and the copied social image.
