# Changelog source files

This directory contains optional, read-only Markdown release notes for Dynamic Learner.
Guide release notes are published; other app changelogs may be added independently.

To publish a tab, add its UTF-8 Markdown file here using the exact filename below.
The build copies files into `/changelogs/`, and the Changelog page renders them
with the shared Markdown renderer. No app registration, manifest, or IndexedDB
migration is needed. Missing files display a friendly empty state.

- `all.md` — All Apps
- `calculator.md`
- `notebook.md`
- `todo-list.md`
- `solve-it-grid.md`
- `index-cards.md`
- `word-search.md`
- `crossword.md`
- `guide.md`
- `knowledge-check.md` — Review

Publish entries with newest dates first. Content is maintained in the repository,
not in a user's workspace or backups. App tab labels come from the existing
feature definitions. Reload the site after publishing updated Markdown files.

## Versioned release format

Use a `## vMAJOR.MINOR.PATCH` heading for each release, newest first.
Place the UTC timestamp in a `data-utc` attribute so the app displays
release dates and times in each reader's browser-local timezone. Keep
human-readable fallback text inside the element for GitHub readers.

```md
## v2.7.5

<small data-utc="2026-10-31T03:21:00Z">October 30, 2026 at 9:21 PM MDT</small>

- **AI Generation:** Improved lesson planning.

<details>
<summary>View 1 commit</summary>
<ol><li><a href="https://github.com/OWNER/REPO/commit/SHA">SHA</a> — Commit subject</li></ol>
</details>
```

The page renders the version and timestamp beside the notes, removes
redundant horizontal rules, and keeps commit histories collapsible.
Changelogs without version headings still use the standard Markdown viewer.
