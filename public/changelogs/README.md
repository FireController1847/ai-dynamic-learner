# Changelog source files

This directory contains read-only Markdown release notes for Dynamic Learner.
**A matching changelog entry is required whenever an app's version is bumped.**
Calculator, Notebook, Todo List, Solve-It Grid, Index Cards, Word Search, Crossword, Guide, and Review (formerly Knowledge Check) have published release histories; other apps may begin with their next release.

To publish a tab or a new release, add or update its UTF-8 Markdown file using the exact filename below.
The build copies files into `/changelogs/`, and the Changelog page renders them
with the shared Markdown renderer. No app registration, manifest, or IndexedDB
migration is needed. Missing files display a friendly empty state.

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

Use a `## vMAJOR.MINOR.PATCH` heading for each release, newest first. Keep release notes short: a few bullets, each beginning with a bold category label and describing user-visible progress rather than implementation details.
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
List relevant commits added since the previous app version, including the bump commit; use real GitHub links and omit unrelated changes. When the bump commit SHA is not yet known, add its changelog in a follow-up docs-only commit. Version bumps must not be repeated for that follow-up.
Changelogs without version headings still use the standard Markdown viewer.
