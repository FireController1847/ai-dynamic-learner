# Study Guide artwork

`src/assets/app-icons/study-guide.png` is the transparent 1254 × 1254 source used for Study Guide route/social metadata. Home, navigation, and the page header use the 256 × 256 variants under `src/assets/app-icons/{webp,png,gif}/`. Study Guide is grouped under Mastery immediately before Review, and its feature definition owns the full-resolution metadata reference.

Generated with the built-in image generation tool. The existing Notebook and Review assets were inspected for the glossy blue-and-white style. The open book, ribbon bookmark, note strokes, and highlighted key idea distinguish this icon from the closed Notebook and Review quiz sheet. The generated PNG is copied into the workspace without changing its transparency.

## Generation prompt

undefined

## Manual review

Check that Study Guide appears before Review in Mastery and navigation. Compare its artwork with the other apps in Light and Dark themes, at desktop and phone widths. Open `/study-guide/` directly and refresh; it remains an empty scaffold with the shared app header. Check Home search still finds Study Guide. After the next requested production build, inspect route metadata and the copied social image.
