# App versions

Each app has an independent SemVer stored canonically in `src/features/feature-definitions.ts`. Do not duplicate current versions here. Public release notes live in `public/changelogs/<app-id>.md`; Git history supports their commit references.

## Policy

- **Major:** incompatible removal/change to documented app behavior or saved-data compatibility without migration.
- **Minor:** new backward-compatible capability, workflow, or setting.
- **Patch:** compatible bug fix or app-specific presentation polish.
- Internal refactors, docs-only work, build/deployment changes, and shared infrastructure do not automatically bump every app.
- Group related implementation commits into one product increment; merging a PR does not add another bump.
- Workspace format, npm package version, Tips state, and app versions are independent.

When changing an app, decide the bump from the user-visible/compatibility effect, update only its canonical value, and mention the bump in the implementation commit.

## Required changelog for each bump

Every app version increment must include a new entry in its matching `public/changelogs/<app-id>.md` (see that directory's README for IDs and format). Use the version-bump commit's UTC time, short user-facing category bullets, and a collapsed list of linked relevant commits since the preceding app version. Put newest versions first; preserve existing release history.

Release notes and version bump are one deliverable. If the bumped commit's SHA is needed for its commit list, write the notes in a follow-up docs-only commit without bumping the version again. Do not bump versions for changelog edits alone.
