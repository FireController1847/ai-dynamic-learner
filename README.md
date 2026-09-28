# Dynamic Learner

Licensed under [Apache License 2.0](LICENSE).

## AI development disclosure

Dynamic Learner is developed using AI, primarily OpenAI Codex. AI assistance is central to writing and revising the application's code, interface, and documentation, with a human directing requirements and providing feedback. This is an AI-developed project, not merely an app with an AI feature. AI-assisted development does not imply that changes have been independently reviewed or automatically tested; follow the manual verification guidance below.

A modular browser-native Vue 3 application with a collapsible navigation drawer, an Index Cards library with editable card stacks, and a Word Search library for organizing word lists and puzzle settings. JavaScript uses native ES modules and plain Vue component objects, with no application build step or npm dependencies.

The interface uses a Microsoft Fluent-inspired visual system: compact shared controls, neutral adjoining panels, blue selection accents, and animated drawers. Ruled index cards retain their red and blue lines. See [design conventions](docs/design.md) for the shared styling rules; no Fluent package or external font is required.

## Start

With a current Node.js LTS installation (including npm):

```sh
npm start
```

Open `http://127.0.0.1:3000`. No `npm install` is needed. Stop with Ctrl+C. Override the address when needed:

```sh
HOST=127.0.0.1 PORT=8080 npm start
```

## Rename and extend

Home provides launcher cards for Index Cards and Word Search, using the same destinations as the navigation drawer. New feature definitions automatically join the responsive grid; add an icon and description alongside the label and path. Word Search includes a persistent library with nested groups and a staged form for creating and editing puzzle settings. The Home footer includes the Apache-2.0 notice, repository link, current local date, and a browser-storage reminder. Repository and license metadata live in `src/app/app-config.js`.

For publishing, see [GitHub Pages setup](docs/github-pages.md). The repository includes a manually triggered **Deploy to GitHub Pages** workflow. It packages the static app without bundling, supports repository-prefixed URLs, and creates direct-link entry points for each feature. Select **GitHub Actions** in the repository's Pages settings, then use **Actions → Deploy to GitHub Pages → Run workflow**. Ordinary pushes do not publish.

Change `name` in `src/app/app-config.js` to update the Home heading, navigation drawer identity, and browser title. Feature pages display their own title in a compact header instead of a persistent app-name banner. Update the package name in `package.json` and this README if renaming the project itself.

Add real functionality under `src/features`, define its ID, label, and path in `src/features/feature-definitions.js`, and register its component in `src/features/feature-registry.js`. Restart the server after adding paths. Compose application behavior in `src/app`. Use `src/components` for reusable, feature-neutral Vue components (currently the icon component) and `src/core` for neutral utilities (currently shared ID helpers).

Index Cards and Word Search have their own directories under `src/features`. Home lives at `/`, Index Cards at `/index-cards/`, and Word Search at `/word-search/`. Use the three-bar menu to navigate; links also support opening in new tabs. Direct links, refreshes, and browser Back/Forward select the matching view. Switching views retains temporary UI state; reloading restores saved workspace data and keeps the selected URL.

## Groups, sets, and backups

On Index Cards, the folder and stacked-card buttons create a group or set relative to the current selection: selecting a group creates the new item inside it, selecting a set creates the new item immediately after it in the same parent, and creating with no selection uses the top level. The library fills the available page height and its tree scrolls independently. On desktop, drag the divider between the Library and content to resize the Library for the current session; the divider also supports Left/Right and Home/End from the keyboard. Use the minimize button in its toolbar to hide the library completely and give the content the full width. A floating icon at the upper left restores it without losing open groups or selection. The library slides open and closed; reduced-motion preferences disable the animation. Groups contain nested groups and sets. Click a pencil to rename; Enter or leaving the field saves, Escape cancels, and a blank name keeps the old name. Select a set to work with its cards on the right.

The trash can beside each pencil deletes an empty set or group immediately. A set is empty when it has no cards; a group is empty when it has no child entries. Populated sets and groups open a fullscreen deletion prompt. Cancel or Escape keeps the item. The red Delete button permanently removes it; deleting a group also removes all nested groups and sets. Download a backup first if you may need to restore it.

Drag a row onto the center of a group to move it inside, or near a row's top/bottom edge to place it before/after that row. Blue indicators show the destination. Drop on **Top level** to move to the start of the root, or the bottom drop area to append there. Each group keeps its own manual order. Selecting an item also provides **Move to group**, **Move up**, and **Move down** controls for keyboard and touch use.

Changes save locally in this browser. Open the main navigation drawer and find **Workspace** at the bottom: **Download backup** exports the workspace as JSON, and **Upload backup** validates a file and shows a replacement review. Confirm to replace the entire workspace, or cancel to keep current data. Closing the drawer also dismisses an unconfirmed review. Back up first if you need to keep both copies. Files contain the saved content and order, not temporary UI state. See [workspace data](docs/workspace-data.md) for format details and storage limits.

Use [change routing](docs/change-routing.md) to find the files for an edit and [architecture](docs/architecture.md) for ownership and dependency rules.

## Word Search setup

Word Search has its own persistent Library containing nested groups and word-search records. Groups and word searches can be renamed, deleted, dragged, reordered, moved between groups, and backed up with the rest of the workspace. The Library can be minimized or resized on desktop and becomes an overlay on phones and touch tablets.

Choose **New word search**, enter a title and 3–40 words, then choose a grid size and difficulty. Paste words one per line or separate them with commas or semicolons. The form converts English letters to uppercase, removes spaces, apostrophes, and hyphens, and combines duplicates. A live preview shows the saved words and flags those too long for the grid. Optional instructions describe the activity.

**Create word search** saves the definition in the selected group, the selected word search's parent, or the top level, and opens its summary. **Edit word search** stages changes; **Save changes** commits them and **Cancel** leaves saved data untouched. Creation drafts do not add library records. Word lists and settings persist locally and are included in backups. Playable grid generation is not implemented yet.

## Writing and reviewing cards

Reloading Index Cards reopens the last selected set and expands its parent groups. Browsing a group does not replace the remembered set. The restored set starts on the first card's front in normal browsing mode; card position and review state are not saved.

Manual check: select a nested set, move to a later card or start Review, then reload. Confirm the set and parent groups return, with the first card showing its front outside Review. Try deleting the remembered set or restoring an older backup without a saved selection; the page should remain usable without a stale selection.

Open **Settings** at the bottom of the Index Cards library to configure **Serif/Sans**, text size, card size, ink darkness, and vertical text alignment. A live sample shows the result. Options apply across sets, save locally, and are included in backups. **Reset display defaults** restores appearance without changing any cards. Font adjustments keep the card's ruling and margins fixed; card scaling keeps its 5:3 aspect ratio.

Select a set and add its first card. Write directly on the large ruled card, then use **Show back** or **Show front** to write or reveal the other side. Click the title at the top of either side to edit it independently. The back title starts blank; existing titles remain on the front. The card list uses the chosen starting side’s title, or a card number when blank. Flipping rotates the paper; reduced-motion preferences disable the animation. Both sides are always editable; there is no separate editing mode. Changes save locally as you type and are included in workspace backups.

Controls below the stack navigate previous/next, add a card after the current one, duplicate both titles and both sides, or immediately delete an individual card without confirmation. Review setup is above the card alongside the current position. Review first asks for Front or Back, then Sequential — forward, Sequential — backward, or Shuffle. Start review begins at the first card in that sequence; choosing forward restores saved order. Cancel or Escape keeps the current review unchanged. New cards have a fresh ID; duplicates do not share text state. Each new selection during review starts on your chosen side, and both sides remain editable. Focus the card frame to use Left/Right arrows and Space; these shortcuts leave typing and native controls alone.

The workspace supports 1,000 cards total and 2,000 characters per side. Cards use landscape 5:3 proportions modeled on a 3 × 5-inch index card, with ten quarter-inch-spaced writing rows. Text, lines, and margins scale together when the workspace resizes. Longer text scrolls within the paper without stretching it or losing content. Set placement controls remain available under **Location and order**. A different set or restored workspace starts with fresh review state.

## External runtime dependencies

The browser loads Vue **3.5.13** from jsDelivr over HTTPS. Internet access to `cdn.jsdelivr.net` is required; without it, the app will not render. Node serves local files using only built-in modules. Icons are inline SVGs and require no external font or service. No Bootstrap, jQuery, router, or state library is included.

## Manual verification

On phones and touch tablets, opening a library item dismisses the library; tap the floating icon to reopen it, or tap the backdrop to close it. New-item naming and renaming keep the library open. A restored set starts with the library tucked away. The editor, controls, and horizontal card strip share a vertical scrolling workspace, including when the keyboard reduces available height. Try portrait/landscape, touch sliders in Settings, and the bottom card row. Desktop mouse layouts keep their existing sizing.

Start or restart the app and open `/`. Confirm Home, then use the drawer to visit `/index-cards/` and `/word-search/` and check the matching headings and active navigation markers. Refresh each URL, paste each into a new tab, and use Back/Forward. Confirm links can open in a new tab, `/index-cards` redirects to `/index-cards/`, and an unknown URL returns 404.

Confirm the full-height drawer slides over a dimmed backdrop. Check Tab stays inside; use Escape, the close button, and the backdrop to dismiss it. Confirm focus returns to the menu after dismissal or to content after navigation. Check a narrow window, reduced-motion settings, and the browser console for errors.

On Word Search, create nested groups, rename them, drag/reorder them, resize and minimize the Library, and confirm they survive refresh and backup restore. Create a word search in a group and at the top level; confirm the correct destination, selected summary, and saved title, words, size, difficulty, and instructions. Try duplicate words, unsupported characters, too few/many words, and a word longer than the grid. Cancel creation and editing to confirm saved data stays intact. Reload and reopen the record, download/restore it, and try an older backup without puzzle settings. Check the form on a narrow screen, with the keyboard open, and using keyboard navigation only. Confirm the letter-grid icon with its highlighted word is clear on Home, in navigation, and in the library.

On Index Cards, create several groups and sets, rename with Enter/blur, cancel with Escape, and try a blank name. Nest groups and sets, reorder siblings, return an item to the root, and confirm a group cannot move into itself or a descendant. Try the selection-based move controls without dragging. Refresh and confirm names, structure, and order remain.

Resize the Library by dragging its divider and with the divider's Left/Right and Home/End keys, then minimize and restore it and confirm the resized width, selection, and expanded groups remain for the current session. With a long tree, confirm its toolbar stays visible while the tree scrolls and reaches the bottom of the available page. Check narrow and short windows. Confirm backup controls appear only in the navigation drawer's Workspace section, and that its review controls remain reachable by scrolling.

Download a backup, change the workspace, then upload the backup: first cancel and check the current data stays, then confirm replacement and check the original tree is restored, including after refresh. Upload malformed JSON or an unsupported format and confirm an error leaves current data untouched.

Check that an empty set and an empty group delete without a prompt. Then try deleting a populated set and a group with nested items. Check the fullscreen prompt names the correct item, focuses Cancel, and keeps keyboard focus inside. Cancel and Escape should preserve all data. Confirm deletion, check the affected selection clears or moves to a surviving item, and refresh to confirm the removal was saved. Check the prompt at a narrow width and inspect the browser console.

For cards, write multiline text on both sides, flip, navigate, duplicate, and edit the duplicate independently. Shuffle and restore the original order. Delete individual cards, including a populated card and the last card in a set, and confirm no prompt appears and selection moves appropriately. Refresh, reselect the set, and confirm text remains. Download and restore a populated backup and also try an older empty-set backup. Confirm malformed card data is rejected without replacing the workspace. Check a narrow window, a long card, reduced motion, keyboard controls, and the browser console.

The right-hand Cards panel lists every card in the current set, with its title and a preview of the chosen starting side. On desktop, drag its divider to resize the panel for the current session; focus the divider and use Left/Right or Home/End for keyboard resizing. Click any card to jump to it, or use the arrow keys and Home/End while a list item is focused. The active card stays visible as you review; the list follows forward, backward, or shuffled review order without changing saved order. The plus button adds a card. On narrow workspaces, the list becomes a horizontally scrolling strip below the editor.

Manually resize the Cards panel with its divider and keyboard controls, switch between sets to confirm the width remains for the current session, then check title edits from both sides, live list updates, list selection and keyboard navigation, duplication, shuffle, refresh, and backup round-trips. Confirm older backups without titles still load and check narrow-screen scrolling and the browser console.

For Review, try Front and Back with all three order choices. Confirm forward starts at the first saved card, backward at the last, and shuffle contains every card exactly once. Flip, then move next/previous or select from the list and confirm the chosen starting side returns. Cancel setup from either step, edit while reviewing, and check keyboard focus and the browser console.

Review is a guided pass through the existing cards, not a separate editor or a scored quiz. The status above the card shows whether a review is running, its starting side, order, and current position. Reveal the other side, then choose **Next card**. The last card offers **Finish review**; **End review** leaves early and restores saved-order browsing without discarding edits. **Change setup** restarts with new choices after confirmation.

Manually start a back-first review, confirm the visible summary and side labels, reveal and advance, finish at the last card, and end another review early. Confirm edited text remains and canceling Change setup leaves the current review intact.

The vertical text alignment setting also adjusts titles against the red rule. Manually check independent titles, both flip directions, duplication, reload, older backups, and reduced motion.
