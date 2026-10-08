# Change routing

Use this as a starting-file index, not a feature specification. Follow imports only as needed.

| Change | Start here |
| --- | --- |
| App identity / metadata | `src/app/app-config.ts`, `build/page-metadata.mts`, `src/html/index.html` |
| Feature registration, labels, routes, groups, versions | `src/features/feature-definitions.ts`, `feature-registry.ts` |
| Home cards/search | `src/app/home-page.ts`, `src/styles/home.css` |
| App artwork / visible icons | `src/app/app-icon.ts`, `src/assets/app-icons/`, `src/styles/shell.css` |
| Header / shell / navigation drawer | `src/app/app.ts`, `navigation-drawer.ts`, `navigation.ts`, `src/styles/shell.css` |
| Theme registry/settings | `src/app/theme.ts`, `theme-menu.ts`, `theme-picker.ts`, `src/styles/themes.css`, `theme.css` |
| Tips content | `src/app/tips-content.ts` and feature-specific Tips adapters |
| Tips engine/UI | `packages/tips/` |
| Shared buttons/dialogs | `src/styles/base.css`, `src/components/use-dialog.ts`, `popup-dialog.ts` |
| Shared AI prompt/import tabs, handoff, and animation | `src/components/ai-prompt-exchange.ts`, `src/styles/ai-prompt-exchange.css` |
| Shared AI category discovery/history | `src/components/ai-category-picker.ts`, `src/core/ai-study-categories.ts`, `ai-category-history.ts`, `ai-json.ts` |
| Answer strictness control | `src/components/answer-strictness-field.ts` |
| Delete confirmation | `src/components/delete-confirmation.ts`, `src/styles/delete-confirmation.css` |
| Shared tree behavior | `src/core/tree.ts` plus the calling feature model |
| IDs | `src/core/ids.ts` |
| Answer matching / morphology / semantics | `packages/@dynamic-learner/answer-matching/`; `src/core/answer-matching.ts` is the legacy-behavior adapter |
| Fill-in-the-blanks parsing | `src/core/fill-blank.ts` |
| Leave warnings | `src/core/leave-guards.ts` |
| Workspace save/load/backups | `src/app/workspace.ts`, `workspace-format.ts`, `workspace-tools.ts` |
| Backup reminders / study suppression | `src/app/backup-reminders.ts`, `backup-reminder-policy.ts`, `backup-reminder-ui.ts`, `src/core/study-activity.ts`, `src/components/use-study-session.ts` |
| GitHub Pages / route output | `webpack.config.mts`, `build/site-config.mts`, `build/page-metadata.mts`, `.github/workflows/deploy-pages.yml` |
| Calculator | `src/features/calculator/` |
| Notebook composition/library | `src/features/notebook/notebook.ts`, `library.ts`, `library-model.ts`, `document-types.ts` |
| Workbook scaffold | `src/features/workbook/workbook.ts`; register in `src/features/feature-definitions.ts` and `feature-registry.ts` |
| Notebook Markdown | `markdown-editor.ts`, `markdown-renderer.ts`, `markdown-outline.ts`, `document-files.ts` |
| Notebook Lined Paper | `lined-editor.ts`, `lined-pagination.ts`, `lined-editor.css` |
| Notebook Graph Paper | `graph-editor.ts`, `graph-paper.ts`, `graph-model.ts`, `graph-scene.ts`, `graph-interaction.ts`, `graph-gestures.ts`; see `graph-paper.md` |
| Notebook display settings | `display-options.ts`, `display-settings.ts`, `display-settings.css` |
| Todo library/model/settings | `src/features/todo-list/todo-list.ts`, `library.ts`, `library-model.ts`, `library-settings.ts` |
| Todo task behavior | `task-editor.ts`, `task-model.ts`, `todo-list.css` |
| Index Cards composition/library | `src/features/index-cards/index-cards.ts`, `directory-tree.ts`, `tree-model.ts` |
| Flash Cards | `card-set.ts`, `card-paper.ts`, `card-model.ts` |
| Index Cards AI category flow | `ai-category-step.ts` plus the shared AI category picker/history |
| Index Cards AI/JSON card creation | `ai-import.ts`, `ai-import-format.ts`, `fill-blank-ai-format.ts`, `ai-import.css`, `set-builder.ts`, `index-cards.ts`, `directory-tree.ts` |
| Fill in the Blanks | `fill-blank-set.ts`, `fill-blank-paper.ts`, `fill-blank-editor.ts`, `fill-blank-model.ts` |
| Index Cards review | `review-setup.ts`, `review-result.ts`, `card-set.ts`, `fill-blank-set.ts` |
| Index Cards list / panel sizing | `card-list.ts`, `card-list.css`, `index-cards.ts`, `index-cards.css` |
| Index Cards settings | `display-options.ts`, `display-settings.ts`, `tree-model.ts`, `display-settings.css` |
| Word Search library/setup | `src/features/word-search/word-search.ts`, `library.ts`, `library-model.ts`, `puzzle-form.ts` |
| Word Search generation/play | `puzzle-generator.ts`, `game-model.ts`, `puzzle-game.ts`, `puzzle-grid.ts` |
| Word Search appearance | `display-options.ts`, `display-settings.ts`, `grid-sizing.ts`, `word-outline.ts` |
| Crossword library/setup | `src/features/crossword/crossword.ts`, `library.ts`, `library-model.ts`, `puzzle-form.ts` |
| Crossword generation/play | `puzzle-generator.ts`, `puzzle-model.ts`, `game-model.ts`, `puzzle-game.ts`, `puzzle-grid.ts` |
| Crossword appearance | `display-options.ts`, `display-settings.ts`, `grid-sizing.ts` |
| Guide library/modes | `src/features/guide/guide.ts`, `library.ts`, `library-model.ts`, `mode-picker.ts` |
| Guide List | `list-editor.ts` |
| Guide AI/JSON import | `ai-import.ts`, `guide.ts`, `library.ts` |
| Guide Map | `map-editor.ts`, `map-graph.ts`, `map-study.ts`, `map-presentation.ts`, `guide.css` |
| Review library/model | `src/features/knowledge-check/knowledge-check.ts`, `library.ts`, `library-model.ts` |
| Review authoring | `check-builder.ts`, `question-model.ts`, `fill-blank-editor.ts`, `set-options*.ts` |
| Review Study/Quiz/Test | `knowledge-set.ts`, `session-setup.ts`, `session-settings.ts`, `session-intro.ts`, `session-state.ts`, `knowledge-session.ts`, `review-motion.ts`, `review-motion.css` |
| Review imports | `import-knowledge-set.ts`, `index-cards-import-picker.ts`, `fill-blank-import-resolution.ts`, `import-index-cards.ts` |
| Review AI creation / question mix | `ai-creation.ts`, `ai-creation.css`, `ai-import-format.ts`, `ai-question-mix.ts`, `knowledge-check.ts`, `library.ts` |
| Responsive/touch overrides | `src/styles/mobile.css` plus the owning feature stylesheet |
