# Browser dependencies

These pinned, unmodified ES module distributions are served locally. No build step,
package installation, or additional CDN connection is required. GitHub Pages copies
this directory with the other `src/core` assets. Source maps and upstream licenses
are retained alongside each distribution.

- **Marked 18.0.14** — `marked/marked.js` is `lib/marked.esm.js` from
  https://registry.npmjs.org/marked/-/marked-18.0.14.tgz (MIT).
  Project: https://github.com/markedjs/marked
- **DOMPurify 3.4.16** — `dompurify/purify.js` is `dist/purify.es.mjs` from
  https://registry.npmjs.org/dompurify/-/dompurify-3.4.16.tgz (Apache-2.0 OR MPL-2.0).
  Project: https://github.com/cure53/DOMPurify

To update, replace the distribution, matching source map, and license from the
pinned upstream package, then update this version record. Keep sanitization between
Markdown parsing and rendering. Application code must not add arbitrary attributes,
HTML, or event handlers after sanitization.
