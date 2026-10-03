# App versions

Each of the six learning apps has an independent semantic version in `src/features/feature-definitions.ts`. `src/app/app.ts` reads the active feature's version and renders only `vMAJOR.MINOR.PATCH`; `src/styles/shell.css` fixes that plain label in the bottom-right corner. It uses 11px text, the theme's secondary text color, 55% opacity, and a 16px right margin plus device safe-area insets. Its 16px line box is vertically centered within the shared control height: an 8px bottom margin on desktop and 14px on touch layouts, plus the bottom safe-area inset. The collapsed Location and order rows share those same 32px/44px control heights through `.organization-summary` in `src/styles/base.css`, keeping the labels aligned across Notebook, Index Cards, Word Search, and Crossword. The version cannot receive pointer events, keyboard focus, or text selection. Home is the launcher rather than a versioned learning app.

## Version policy

Follow [Semantic Versioning 2.0.0](https://semver.org/). For these browser apps, the compatibility contract is the documented app functionality, supported document data, and acceptance of previously valid saved workspaces/backups.

- **Major:** incompatible changes to that contract, such as rejecting previously supported document data without migration or removing a supported app workflow.
- **Minor:** a completed backward-compatible capability, such as a new editor, study mode, setting, or editing workflow. Reset the patch number.
- **Patch:** compatible corrections and presentation polish, including app-specific layout, artwork, and theme fixes.
- Group related implementation commits into one completed feature increment. A PR merge does not add another increment on top of its constituent work.
- Documentation-only changes, internal refactors, compatible JavaScript/TypeScript conversions, build/deployment tooling, and shared navigation/theme infrastructure do not independently increment each app. Corrections to a particular app's theme styling do count as that app's patches.

Keep the source version explicit and review its increment with future changes. These versions are independent of the npm package version, tutorial completion versions, and workspace backup format version.

## History-derived starting versions

The repository had no release tags or established app version fields. These are retrospective starting versions, inferred from the 300 commits reachable at `c46ccb8c115e7753b8db76e68361672df2838250` on 2026-10-02. Main's integration order, the merged feature branches, commit descriptions, and relevant implementation diffs establish the milestones below. A first complete app implementation is treated as `1.0.0`; preliminary scaffolds and partial multi-commit implementations are grouped into that baseline. Earlier patch sequences reset at each subsequent minor milestone. No incompatible saved-data/workflow change was identified that warrants a major increment above 1; Crossword's original optional size field, for example, remains accepted in older backups.

| App | Initial version |
| --- | --- |
| Calculator | `1.3.0` |
| Notebook | `1.4.2` |
| Todo List | `1.4.2` |
| Index Cards | `1.7.2` |
| Word Search | `1.5.10` |
| Crossword | `1.1.5` |

### Calculator

| Milestone | Evidence |
| --- | --- |
| `1.0.0`: scientific expressions, memory, history, and angle modes | PR #10 integrated at `8bfe361`; its earlier arithmetic scaffold and scientific implementation were developed together before integration. |
| `1.1.0`: decimal-place settings and fraction/decimal display | `f190762`–`06ba269`, including `7e0dee4`, `bcd6fd3`, and `10aa901`. |
| `1.2.0`: persistent fraction mode and stacked fraction rendering | `501464d`–`e6efd0e`, including `e670188`, `4362c69`, and `720d1c8`. |
| `1.2.1`: retain fraction previews through operator entry | `e2f2f3b`. |
| `1.2.2`: align fractions and correct error display | `c46ccb8`. |
| `1.3.0`: MathPrint-style editable fractions, two-row home display, arrow history navigation, and retained session-history panel | `bbf7a01`–`95943df`, with follow-up navigation refinements through `ad5c1e5`. |

### Notebook

| Milestone | Evidence |
| --- | --- |
| `1.0.0`: document builder and complete Markdown editing/import/export | PR #5 integrated at `481ebc2`; `78a1fa6` was the earlier scaffold. |
| `1.1.0`: app onboarding | PR #6 integrated at `17366db`, including Notebook-specific guide content. |
| `1.2.0`: temporary tutorial documents and state restoration | `1294acc`. |
| `1.3.0`: paginated Lined Paper and per-type appearance settings | `8d1188b`. |
| `1.4.0`: Graph Paper expressions, visual drawing, measurements, and gestures | `2f87969`. |
| `1.4.1`: correct Graph Paper tool/error colors for themes | PR #9 integrated at `d2a0c2d`, including the Graph Paper corrections in `272c153`. |
| `1.4.2`: correct themed paper surfaces and graph colors | `69fcd5c`. |

### Todo List

| Milestone | Evidence |
| --- | --- |
| `1.0.0`: dated lists, archive rules, ruled task editing, priorities, skip/defer, settings, and backups | `8d1188b`. |
| `1.1.0`: completion celebrations | `17acf0d`; later motion tuning is presentation polish. |
| `1.2.0`: section sorting and manual reordering | `bfc7423`. |
| `1.3.0`: completed-list indicators | `5a10aa7`. |
| `1.4.0`: keyboard removal of empty tasks and sections | `02e7a0e`–`b74f97c`. |
| `1.4.1`: correct empty-section cleanup | `d223d28`. |
| `1.4.2`: correct themed task paper and display controls | `69fcd5c`. |

### Index Cards

| Milestone | Evidence |
| --- | --- |
| `1.0.0`: groups, sets, two-sided cards, and review | `60a92e3`. |
| `1.1.0`: configurable card display | `2e81fde`. |
| `1.2.0`: library controls and resizing | `634271d`. |
| `1.3.0`: independent Cards-panel resizing | `00b9bc6`. |
| `1.4.0`: app onboarding | PR #6 integrated at `17366db`. |
| `1.5.0`: guided review walkthrough | `fc84445`. |
| `1.6.0`: temporary tutorial examples and state restoration | `1294acc`. |
| `1.7.0`: selectable paper background | `ae1b396`. |
| `1.7.1`: align display defaults and control ordering | `cd427e1`. |
| `1.7.2`: correct themed paper and ink choices | `69fcd5c`. |

### Word Search

| Milestone | Evidence |
| --- | --- |
| `1.0.0`: playable generated puzzles, display settings, and saved progress | `a52bf8f`; the earlier library/setup commits were preliminary. |
| `1.1.0`: font-weight settings and visual selection feedback | `0b09e56`. |
| `1.2.0`: clue study mode | PR #4 integrated at `1d0d331`, containing `e37f162`. |
| `1.3.0`: app onboarding | PR #6 integrated at `17366db`. |
| `1.4.0`: persisted board rotation and matching interactions | `1357f30`–`fa2d82b`, including `92a1b47`. |
| `1.5.0`: temporary tutorial puzzles and state restoration | `1294acc`. |

Ten later app-specific presentation/interaction corrections give `1.5.10`: `bac5cc7`, `a44a887`, `8cafce9`, `581f844`, `baa83b8`, `75b986c`, `ac36ea3`, `5e96025`, `25f5d40`, and `a247844`. They refine continuous rotation, letter motion, and board overflow. Subsequent tooling and shared-infrastructure refactors preserve app functionality.

### Crossword

| Milestone | Evidence |
| --- | --- |
| `1.0.0`: connected puzzle creation, solving, hints, appearance, and saved progress | Initial multi-commit implementation, including `600a3e0` for composition and `79c2975` for complete style loading. |
| `1.1.0`: automatic connected-grid sizing and actionable generation validation | `48bc03d`–`c0af5b3`, including `d290b4e`, `03ba0a6`, `dfa7501`, and `f73e3cf`; legacy size data remains compatible. |
| `1.1.1`: lighten default blocks | `2b98e3f`. |
| `1.1.2`: soften grid styling | `590e966`. |
| `1.1.3`: match the display preview to the grid | `2d6e6cb`. |
| `1.1.4`: matching app artwork | `ac9e386`. |
| `1.1.5`: correct dark-theme colors | `58dd803`. |

## Manual review

Visit every app directly and through navigation, then use Back/Forward. Confirm the label changes to the corresponding version and contains only the `v`-prefixed number. Scroll each workspace and resize through desktop, phone portrait, and landscape: the label should stay in the bottom-right with safe-area spacing, remain small and subdued in both themes, and let pointer/touch events reach underlying controls. Compare its vertical center with each collapsed Location and order row; expand/collapse those controls and check their actions stay reachable. It must not enter the keyboard tab order or text selection. Check that navigation, modal dialogs, and Tips retain their normal layering.
