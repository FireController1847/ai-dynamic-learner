# GitHub Pages

The app deploys as static HTML, CSS, images, and webpack JavaScript bundles. Vue, Marked, and DOMPurify ship in the bundles; visitors do not need a runtime CDN connection. Node.js is used to build and preview the site, not to run the published application.

## Source and deployment strategy

Commit source, `package.json`, and `package-lock.json`. Keep `dist/` ignored. No built-output commit or dedicated deployment branch is needed: the manually dispatched `.github/workflows/deploy-pages.yml` installs locked dependencies with `npm ci`, runs the webpack production build, and uploads `dist/` to GitHub Pages. Each deployment builds the selected source commit, so there is no requirement to build locally before every commit. A failed install or build prevents the deployment job from running.

Pushes and pull requests do not publish automatically. Local production previews must be rebuilt after source changes; `npm start` handles development rebuilds automatically.

## First publication

1. Push the source project and lockfile, including `.github`, to the repository's default branch. The workflow must exist on that branch for its manual trigger to appear.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
3. Open **Actions → Deploy to GitHub Pages → Run workflow**, select the source branch to publish, and run it. When deploying this migration before merging, select `migration/webpack`; the selected branch must contain the updated workflow and lockfile. The `github-pages` environment's deployment rules must permit that branch; approve the deployment if your environment requires it.
4. Open the URL shown by the deployment job. Subsequent publications use the same manual action.

The workflow uses Node.js 24, npm's lockfile cache, GitHub's built-in token, Pages artifact upload, and Pages deployment actions. No personal token or `gh-pages` branch is required. Its prepare job has read-only permissions; the deployment job has Pages and identity-token write permissions. See GitHub's [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Build output and paths

`npm run pages:prepare` is an alias for `npm run build`. Webpack cleans and recreates `dist/` with hashed JavaScript/CSS bundles, images in `assets/`, third-party licenses, the project `LICENSE`, generated HTML route entry points, a 404 page, and `.nojekyll`. Repository metadata, documentation, source trees, the preview server, and workspace backups are not copied into the site artifact. Production source maps are disabled; development serves source maps in memory.

The workflow reads `PAGES_BASE_PATH` and `PAGES_BASE_URL` from `actions/configure-pages`. Project sites use `/repository-name/`; user/organization sites and custom domains usually use `/`. `build/site-config.mjs` validates these values and requires their paths to agree. Webpack uses that path for bundle URLs and the HTML base element. Browser navigation reads the same root from `document.baseURI`, so ordinary links, modified-click/new-tab links, images, and browser history stay under the deployed root.

Every route in `src/features/feature-definitions.js` gets an actual `index.html`, including Notebook, Index Cards, and Word Search. `build/page-metadata.mjs` supplies route-specific titles/descriptions, canonical URLs, Open Graph and Twitter metadata, and JSON-LD. The generated 404 page is marked `noindex, nofollow`. Direct links and refreshes work without a rewrite or hash router. Configure custom domains in GitHub's Pages settings before dispatching deployment.

## Local use

Install dependencies once with `npm ci` using Node.js 24 or newer. Run `npm start` for development at `http://127.0.0.1:3000`. Set `HOST` and `PORT` to override the address. Restart the development server after changing build configuration or feature route definitions.

For a production preview at the origin root:

```sh
npm run build
npm run preview
```

To preview a GitHub Pages repository prefix in a POSIX shell:

```sh
PAGES_BASE_PATH=/dynamic-learner PAGES_BASE_URL=https://example.test/dynamic-learner/ npm run pages:prepare
npm run preview
```

In PowerShell:

```powershell
$env:PAGES_BASE_PATH = "/dynamic-learner"
$env:PAGES_BASE_URL = "https://example.test/dynamic-learner/"
npm run pages:prepare
npm run preview
```

The preview server reads the base path from the built HTML and serves only `dist/`; open `http://127.0.0.1:3000/dynamic-learner/` for the prefixed example. Stop a development server using the same port first, or set another `PORT`. Clear the Pages environment variables before building at `/` again. The example public URL is only for inspecting metadata; Actions supplies the real URL during publication.

Browser storage is scoped to the origin. The default development address is unchanged, so existing local data remains accessible. A published site has separate storage from localhost; use a downloaded workspace backup to transfer data. Projects on the same Pages origin currently share the app's storage key.

## Manual checklist

- Start development and confirm source edits rebuild and reload the page.
- Preview root and repository-prefixed production builds. Open Home, Notebook, Index Cards, and Word Search directly and refresh each; check Back/Forward and open-in-new-tab links.
- Inspect icons, styles, canonical/social metadata, and the generated social image URL. Check that an unknown route returns 404 with a working Home link.
- Try Markdown rendering, Settings, card flipping, and workspace download/upload; inspect the console and asset requests.
- After a manual deployment, repeat the direct-route checks at the real Pages URL. Confirm ordinary pushes do not deploy and no generated files need committing.

Follow the workspace's manual-verification policy unless automated builds/checks have been explicitly requested.
