# App versions

Each learning app has an independent SemVer stored canonically in `src/features/feature-definitions.ts`. Do not duplicate current versions here; Git history is the changelog.

## Policy

- **Major:** incompatible removal/change to documented app behavior or saved-data compatibility without migration.
- **Minor:** new backward-compatible capability, workflow, or setting.
- **Patch:** compatible bug fix or app-specific presentation polish.
- Internal refactors, docs-only work, build/deployment changes, and shared infrastructure do not automatically bump every app.
- Group related implementation commits into one product increment; merging a PR does not add another bump.
- Workspace format, npm package version, Tips state, and app versions are independent.

When changing an app, decide the bump from the user-visible/compatibility effect, update only its canonical value, and mention the bump in the implementation commit.
