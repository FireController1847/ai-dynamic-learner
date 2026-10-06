# GitHub Pages

Dynamic Learner publishes the normal webpack production build; there is no deployment branch and `dist/` is not committed.

## Build

`webpack.config.mts` creates Home, feature-route HTML, `404.html`, copied assets/licenses, and hashed JS/CSS bundles. `build/site-config.mts` owns base-path/site URL validation; `build/page-metadata.mts` owns canonical/social/structured metadata.

The HTML `<base>` and webpack `publicPath` must resolve to the same Pages root. Navigation uses `document.baseURI`, so direct route loads and in-app navigation work under the repository subpath.

## Deployment

`.github/workflows/deploy-pages.yml` is manually dispatched. It installs with `npm ci`, resolves the Pages URL/base path, runs `npm run pages:prepare`, and uploads `dist/`.

Do not hand-edit generated Pages output or maintain a separate publishing branch.

## Local development

`npm start` serves the canonical routes with live reload. Known routes missing their trailing slash redirect to the slash form; unknown routes/assets should remain 404s.

## When changing deployment

Manually check Home and at least one feature by direct URL and refresh, relative assets, navigation/back-forward, the repository base path, `404.html`, metadata image URLs, and the manual Pages workflow configuration. Run build/deployment checks only when explicitly requested.
