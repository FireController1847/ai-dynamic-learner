# GitHub Pages

The app runs as static HTML, CSS, and native JavaScript modules on Pages. The Node server remains a local development tool. Vue still loads from its pinned jsDelivr URL, so visitors need access to that CDN.

## First publication

1. Push the project, including `.github`, to your GitHub repository's default branch. The workflow must exist on that branch for its manual trigger to appear.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
3. Open **Actions → Deploy to GitHub Pages → Run workflow**, select the branch to publish, and run it. The `github-pages` environment's deployment rules must permit that branch; approve the deployment if your environment requires it.
4. Open the URL shown by the deployment job. Subsequent publications use the same manual action. Pushes and pull requests do not deploy automatically.

The workflow uses GitHub's built-in token, Pages artifact upload, and Pages deployment actions; no personal token, npm install, or `gh-pages` branch is required. Its prepare job has read-only access, while its deployment job has Pages and identity-token write permissions. See GitHub's [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Packaging and paths

`npm run pages:prepare` recreates `dist/`. This is a copy/package operation, not compilation or bundling. It includes only the `src/app`, `core`, `components`, `features`, and `styles` asset directories, plus generated HTML entry points, a 404 page, `.nojekyll`, and the Apache 2.0 `LICENSE`. Repository metadata, documentation, the server, and workspace backups are not in the site artifact. `dist/` is covered by the existing Node gitignore template.

The workflow reads the base path and public base URL from `actions/configure-pages`: project sites use `/repository-name/`; user/organization sites and configured custom domains usually use `/`. It writes the path into the HTML base element and uses the public URL to generate canonical and Open Graph URLs. Navigation derives the same root from its module URL, so assets, ordinary links, modified-click/new-tab links, and browser history stay under the deployed root.

Every route in `src/features/feature-definitions.js` gets an actual `index.html`, including `/index-cards/` and `/word-search/`. Each generated page receives a route-specific title and description, canonical URL, Open Graph and Twitter metadata, and JSON-LD structured data. The generated 404 page is marked `noindex, nofollow`. Refreshes and direct links therefore work without a server rewrite or hash router. Unknown paths use the generated 404 page. Add future routes to the canonical definitions; packaging will include their entry points. Configure any custom domain in GitHub's Pages settings before dispatching deployment.

For manual local inspection, run `PAGES_BASE_PATH=/dynamic-learner PAGES_BASE_URL=https://example.test/dynamic-learner/ npm run pages:prepare` and serve `dist/` mounted at `/dynamic-learner/` with a static host; the default base is `/`. Do not use `npm start` as a preview of `dist/`: it serves the source app instead.

Workspace SQLite/OPFS storage is scoped to the origin. A published Pages site therefore has separate workspace data from localhost; download a gzip-compressed SQLite `.bak` locally and upload it on the published site to transfer data. Dynamic Learner uses the OPFS SyncAccessHandle Pool VFS specifically so Pages does not need cross-origin isolation response headers. The pool allows only one active instance for its directory, so a second Dynamic Learner tab/window on the same origin is blocked rather than opening an empty editable workspace. Deployments sharing the same browser origin and app path also share the app's OPFS storage namespace, so do not treat separate routes as separate databases.

## Manual checklist

- Run `npm start`; confirm local navigation and refresh still work.
- After a manual deployment, open Home, Index Cards, and Word Search directly and refresh each. Confirm the repository prefix remains in links and the active page is correct.
- Try browser Back/Forward, open-in-new-tab, Settings, flipping cards, and workspace download/upload; inspect the console and asset requests.
- Open an unknown URL and check the 404 link returns to the correct site root.
- Check that a normal push does not start this deployment workflow.

Preparation and deployment are not automated verification. Follow the workspace's manual-verification policy when changing these files.
