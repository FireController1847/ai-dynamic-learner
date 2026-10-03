<!-- If you are an AI coding agent working in this repository, start with [`AGENTS.md`](https://github.com/FireController1847/ai-dynamic-learner/blob/main/AGENTS.md). -->

<p align="center">
  <img src="src/assets/dynamic-learner.png" alt="Dynamic Learner" width="104">
</p>

<h1 align="center">Dynamic Learner</h1>

<p align="center">
  A browser-native collection of focused learning tools for studying, organizing material, and reviewing at your own pace.
</p>

<p align="center">
  <a href="https://firecontroller1847.github.io/ai-dynamic-learner/">
    <img alt="Open Dynamic Learner on GitHub Pages" src="https://img.shields.io/badge/Open%20Dynamic%20Learner-GitHub%20Pages-0f6cbd?style=for-the-badge&logo=githubpages&logoColor=white">
  </a>
  <a href="https://github.com/FireController1847/ai-dynamic-learner/stargazers">
    <img alt="GitHub stars" src="https://img.shields.io/github/stars/FireController1847/ai-dynamic-learner?style=for-the-badge">
  </a>
  <a href="https://github.com/FireController1847/ai-dynamic-learner/network/members">
    <img alt="GitHub forks" src="https://img.shields.io/github/forks/FireController1847/ai-dynamic-learner?style=for-the-badge">
  </a>
  <a href="https://github.com/FireController1847/ai-dynamic-learner/commits/main">
    <img alt="Last commit" src="https://img.shields.io/github/last-commit/FireController1847/ai-dynamic-learner?style=for-the-badge">
  </a>
  <a href="LICENSE">
    <img alt="Apache 2.0 license" src="https://img.shields.io/github/license/FireController1847/ai-dynamic-learner?style=for-the-badge">
  </a>
</p>

## AI development disclosure

> [!IMPORTANT]
> **Dynamic Learner is intentionally developed as an AI-generated workspace.** The project owner directs the product, requirements, priorities, and feedback; AI coding agents — primarily OpenAI Codex — create and revise much of the implementation and repository content in response.

This repository does not follow a conventional workflow where most changes are hand-written and maintained through manual pull requests. Development is generally directed in natural language, carried out by AI agents, reviewed through the resulting behavior and diffs, and iterated from there.

That distinction matters when reading the codebase:

- AI-generated code should not be assumed to have received independent line-by-line human review.
- A commit or pull request may represent an agent's implementation of a human-directed change rather than a hand-authored patch.
- Bug reports, ideas, and feedback are useful even when the eventual implementation is performed by an AI agent.
- [`AGENTS.md`](AGENTS.md) contains instructions for coding agents. This README is the human-facing project overview and is not an agent scratchpad, QA log, or task-memory file.

## What is Dynamic Learner?

Dynamic Learner is a lightweight study workspace that runs in the browser. It is designed around small, focused tools that share one workspace instead of trying to turn studying into one giant all-purpose editor.

The current application includes:

| Tool | What it does |
| --- | --- |
| **Calculator** | Uses a MathPrint-style scientific entry display with editable stacked fractions, expression history navigation, normal precedence, scientific functions, DEG/RAD and fraction/decimal modes, configurable decimal places, memory controls, and a reusable session-history panel. |
| **Notebook** | Organizes documents into a nested library. Write on Lined Paper with automatic overflow pages, use Markdown source and preview, or combine expressions and visual drawing on Graph Paper with point coordinates, line measurements, and closed-region areas. Customize appearance separately for each paper type. |
| **Todo List** | Lined-paper tasks with adjustable fonts and alignment, checkboxes, centered section priorities, and shared section-name prefixes. Lists are organized by creation date and gradually fade into an archive with configurable expiry. |
| **Index Cards** | Creates nested groups and card sets with editable fronts and backs, review modes, appearance controls, and resumable workspace storage. |
| **Word Search** | Builds custom word-search puzzles with configurable difficulty and appearance, saved grids, hints, answer reveal, and persistent progress. |
| **Crossword** | Builds custom crosswords from answer-and-clue pairs, automatically arranges Across and Down entries, and saves typed progress with checking, hints, reveals, and display controls. |

The interface uses a Fluent-inspired visual language with neutral surfaces, compact controls, blue accents, and responsive layouts. The tools are meant to feel related without forcing every feature into the same interaction model.

## Try it

The latest published GitHub Pages snapshot is available here:

**[Open Dynamic Learner →](https://firecontroller1847.github.io/ai-dynamic-learner/)**

GitHub Pages is deployed manually, so the published site may occasionally lag behind the latest commit on `main`.

To run the current source locally, install Node.js 24 or newer and run:

```powershell
npm ci
npm start
```

Then open <http://127.0.0.1:3000>.

The webpack development server rebuilds and reloads the page as source files change. Vue, Marked, and DOMPurify are bundled locally; loading the application does not require a runtime CDN connection. Installing dependencies requires network access.

To create a production build:

```powershell
npm run build
```

The build checks TypeScript and writes the complete static site to `dist/`. Run `npm run typecheck` for type checking alone. GitHub Actions builds this output for each manual deployment, so generated files do not need to be committed and no separate deployment branch is needed.

To use a different address or port in PowerShell:

```powershell
$env:HOST = "127.0.0.1"
$env:PORT = "8080"
npm start
```

## Your workspace data

Dynamic Learner stores workspace content locally in the browser rather than in an account or remote database.

The navigation drawer includes **Download backup** and **Upload backup** controls for moving or preserving the workspace as JSON. A restore replaces the current saved workspace after review. Browser-local UI preferences, such as panel sizing, may be stored separately from the content backup.

If the browser's site data is cleared without a backup, locally stored learning content may be lost.

More detail about the saved format is available in [`docs/workspace-data.md`](docs/workspace-data.md).

## Project shape

Dynamic Learner deliberately keeps its runtime simple:

- Vue 3 and other browser dependencies are installed through npm and bundled with webpack.
- Source uses strict TypeScript ES modules and plain Vue components. No single-file component compilation is required.
- `webpack.config.mts` owns both the live-reloading development server and the production build.
- Features live under `src/features`; shared application composition lives under `src/app`.
- GitHub Pages uses the webpack production build, with direct-link entry points and metadata for every feature route.

For technical structure, see [architecture](docs/architecture.md). For where a particular kind of change belongs, see [change routing](docs/change-routing.md). Deployment details live in [GitHub Pages setup](docs/github-pages.md).

If you are an AI coding agent working in this repository, start with [`AGENTS.md`](AGENTS.md).

## License

Dynamic Learner is licensed under the [Apache License 2.0](LICENSE).
