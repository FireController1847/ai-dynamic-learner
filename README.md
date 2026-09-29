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
| **Notebook** | Organizes documents into a nested library. Markdown documents currently support source and preview workflows, with additional document types planned. |
| **Index Cards** | Creates nested groups and card sets with editable fronts and backs, review modes, appearance controls, and resumable workspace storage. |
| **Word Search** | Builds custom word-search puzzles with configurable difficulty and appearance, saved grids, hints, answer reveal, and persistent progress. |

The interface uses a Fluent-inspired visual language with neutral surfaces, compact controls, blue accents, and responsive layouts. The tools are meant to feel related without forcing every feature into the same interaction model.

## Try it

The latest published GitHub Pages snapshot is available here:

**[Open Dynamic Learner →](https://firecontroller1847.github.io/ai-dynamic-learner/)**

GitHub Pages is deployed manually, so the published site may occasionally lag behind the latest commit on `main`.

To run the current source locally, install a current Node.js LTS release and run:

```powershell
npm start
```

Then open <http://127.0.0.1:3000>.

There is no application build step and no `npm install` is currently required. The local Node server uses built-in modules, while the browser loads Vue 3.5.13 and the pinned official SQLite WASM package from jsDelivr at runtime. An internet connection is therefore required for those browser dependencies to load.

To use a different address or port in PowerShell:

```powershell
$env:HOST = "127.0.0.1"
$env:PORT = "8080"
npm start
```

## Your workspace data

Dynamic Learner stores workspace content locally in a relational SQLite database backed by the browser's Origin Private File System (OPFS), rather than in an account or remote database. SQLite runs in a Worker so routine persistence does not repeatedly serialize and synchronously rewrite the whole workspace on the UI thread.

The navigation drawer includes **Download backup** and **Upload backup** controls for moving or preserving the workspace. New backups are gzip-compressed SQLite database files using the `.bak` extension, so large workspaces do not need to be serialized through JSON just to make a backup. Older version-1 JSON backups remain importable for compatibility. Browser-local UI preferences, such as panel sizing and TIPS state, remain separate from workspace content.

Existing workspaces saved by older versions under `dynamic-learner.workspace.v1` are migrated into SQLite on first successful startup. The migration recovers features and records independently where possible, so one damaged legacy record does not necessarily discard otherwise valid content. The legacy copy is removed only after the recovered workspace has been committed successfully.

If the browser's site data is cleared without a backup, locally stored learning content may be lost. SQLite's current OPFS storage mode is designed around one active database connection, so editing the same origin in multiple tabs at once is not supported.

More detail about the saved format is available in [`docs/workspace-data.md`](docs/workspace-data.md).

## Project shape

Dynamic Learner deliberately keeps its runtime simple:

- Vue 3 and SQLite WASM are loaded directly in the browser.
- Workspace content is persisted relationally in SQLite/OPFS; normal backups are gzip-compressed SQLite `.bak` files, with JSON retained only for legacy import compatibility.
- JavaScript uses native ES modules.
- `server.mjs` provides the local static server.
- There is no bundler, TypeScript compilation, or Vue single-file-component build pipeline.
- Features live under `src/features`; shared application composition lives under `src/app`.
- GitHub Pages preparation copies the browser-ready application into `dist/` and creates direct-link entry points without compiling the source.

For technical structure, see [architecture](docs/architecture.md). For where a particular kind of change belongs, see [change routing](docs/change-routing.md). Deployment details live in [GitHub Pages setup](docs/github-pages.md).

If you are an AI coding agent working in this repository, start with [`AGENTS.md`](AGENTS.md).

## License

Dynamic Learner is licensed under the [Apache License 2.0](LICENSE).
