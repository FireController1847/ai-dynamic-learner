# Dynamic Learner

A modular browser-native Vue 3 application with a collapsible navigation drawer, an Index Cards library with editable card stacks, and a reserved Word Search page. JavaScript uses native ES modules and plain Vue component objects, with no application build step or npm dependencies.

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

Change `name` in `src/app/app-config.js` to update the Home heading, navigation drawer identity, and browser title. Feature pages display their own title in a compact header instead of a persistent app-name banner. Update the package name in `package.json` and this README if renaming the project itself.

Add real functionality under `src/features`, define its ID, label, and path in `src/features/feature-definitions.js`, and register its component in `src/features/feature-registry.js`. Restart the server after adding paths. Compose application behavior in `src/app`. Use `src/components` for reusable, feature-neutral Vue components (currently the icon component) and `src/core` for neutral utilities (currently shared ID helpers).

Index Cards and Word Search have their own directories under `src/features`. Home lives at `/`, Index Cards at `/index-cards/`, and Word Search at `/word-search/`. Use the three-bar menu to navigate; links also support opening in new tabs. Direct links, refreshes, and browser Back/Forward select the matching view. Switching views retains temporary UI state; reloading restores saved workspace data and keeps the selected URL.

## Groups, sets, and backups

On Index Cards, the folder and stacked-card buttons create a group or set at the top of the library. The library fills the available page height and its tree scrolls independently. Use the minimize button in its toolbar to hide the library completely and give the content the full width. A floating icon at the upper left restores it without losing open groups or selection. The library slides open and closed; reduced-motion preferences disable the animation. Groups contain nested groups and sets. Click a pencil to rename; Enter or leaving the field saves, Escape cancels, and a blank name keeps the old name. Select a set to work with its cards on the right.

The trash can beside each pencil deletes an empty set or group immediately. A set is empty when it has no cards; a group is empty when it has no child entries. Populated sets and groups open a fullscreen deletion prompt. Cancel or Escape keeps the item. The red Delete button permanently removes it; deleting a group also removes all nested groups and sets. Download a backup first if you may need to restore it.

Drag a row onto the center of a group to move it inside, or near a row's top/bottom edge to place it before/after that row. Blue indicators show the destination. Drop on **Top level** to move to the start of the root, or the bottom drop area to append there. Each group keeps its own manual order. Selecting an item also provides **Move to group**, **Move up**, and **Move down** controls for keyboard and touch use.

Changes save locally in this browser. Open the main navigation drawer and find **Workspace** at the bottom: **Download backup** exports the workspace as JSON, and **Upload backup** validates a file and shows a replacement review. Confirm to replace the entire workspace, or cancel to keep current data. Closing the drawer also dismisses an unconfirmed review. Back up first if you need to keep both copies. Files contain the saved content and order, not temporary UI state. See [workspace data](docs/workspace-data.md) for format details and storage limits.

Use [change routing](docs/change-routing.md) to find the files for an edit and [architecture](docs/architecture.md) for ownership and dependency rules.

## Writing and reviewing cards

Select a set and add its first card. Write directly on the large ruled card, then use **Show back** or **Show front** to write or reveal the other side. Click the title at the top of the paper to edit it; the same title appears on both sides and in the card list. Both sides are always editable; there is no separate editing mode. Changes save locally as you type and are included in workspace backups.

Controls below the stack navigate previous/next, add a card after the current one, duplicate the title and both sides, or immediately delete an individual card without confirmation. Review setup is above the card alongside the current position. Review first asks for Front or Back, then Sequential — forward, Sequential — backward, or Shuffle. Start review begins at the first card in that sequence; choosing forward restores saved order. Cancel or Escape keeps the current review unchanged. New cards have a fresh ID; duplicates do not share text state. Each new selection during review starts on your chosen side, and both sides remain editable. Focus the card frame to use Left/Right arrows and Space; these shortcuts leave typing and native controls alone.

The workspace supports 1,000 cards total and 2,000 characters per side. Cards use landscape 5:3 proportions modeled on a 3 × 5-inch index card, with nine quarter-inch-spaced writing rows. Text, lines, and margins scale together when the workspace resizes. Longer text scrolls within the paper without stretching it or losing content. Set placement controls remain available under **Location and order**. A different set or restored workspace starts with fresh review state.

## External runtime dependencies

The browser loads Vue **3.5.13** from jsDelivr over HTTPS. Internet access to `cdn.jsdelivr.net` is required; without it, the app will not render. Node serves local files using only built-in modules. Icons are inline SVGs and require no external font or service. No Bootstrap, jQuery, router, or state library is included.

## Manual verification

Start or restart the app and open `/`. Confirm Home, then use the drawer to visit `/index-cards/` and `/word-search/` and check the matching headings and active navigation markers. Refresh each URL, paste each into a new tab, and use Back/Forward. Confirm links can open in a new tab, `/index-cards` redirects to `/index-cards/`, and an unknown URL returns 404.

Confirm the full-height drawer slides over a dimmed backdrop. Check Tab stays inside; use Escape, the close button, and the backdrop to dismiss it. Confirm focus returns to the menu after dismissal or to content after navigation. Check a narrow window, reduced-motion settings, and the browser console for errors.

On Index Cards, create several groups and sets, rename with Enter/blur, cancel with Escape, and try a blank name. Nest groups and sets, reorder siblings, return an item to the root, and confirm a group cannot move into itself or a descendant. Try the selection-based move controls without dragging. Refresh and confirm names, structure, and order remain.

Minimize and restore the library, including with the keyboard, and confirm selection and expanded groups remain. With a long tree, confirm its toolbar stays visible while the tree scrolls and reaches the bottom of the available page. Check narrow and short windows. Confirm backup controls appear only in the navigation drawer's Workspace section, and that its review controls remain reachable by scrolling.

Download a backup, change the workspace, then upload the backup: first cancel and check the current data stays, then confirm replacement and check the original tree is restored, including after refresh. Upload malformed JSON or an unsupported format and confirm an error leaves current data untouched.

Check that an empty set and an empty group delete without a prompt. Then try deleting a populated set and a group with nested items. Check the fullscreen prompt names the correct item, focuses Cancel, and keeps keyboard focus inside. Cancel and Escape should preserve all data. Confirm deletion, check the affected selection clears or moves to a surviving item, and refresh to confirm the removal was saved. Check the prompt at a narrow width and inspect the browser console.

For cards, write multiline text on both sides, flip, navigate, duplicate, and edit the duplicate independently. Shuffle and restore the original order. Delete individual cards, including a populated card and the last card in a set, and confirm no prompt appears and selection moves appropriately. Refresh, reselect the set, and confirm text remains. Download and restore a populated backup and also try an older empty-set backup. Confirm malformed card data is rejected without replacing the workspace. Check a narrow window, a long card, reduced motion, keyboard controls, and the browser console.

The right-hand Cards panel lists every card in the current set, with its title and a preview of the chosen starting side. Click any card to jump to it, or use the arrow keys and Home/End while a list item is focused. The active card stays visible as you review; the list follows forward, backward, or shuffled review order without changing saved order. The plus button adds a card. On narrow workspaces, the list becomes a horizontally scrolling strip below the editor.

Manually check title edits from both sides, live list updates, list selection and keyboard navigation, duplication, shuffle, refresh, and backup round-trips. Confirm older backups without titles still load and check narrow-screen scrolling and the browser console.

For Review, try Front and Back with all three order choices. Confirm forward starts at the first saved card, backward at the last, and shuffle contains every card exactly once. Flip, then move next/previous or select from the list and confirm the chosen starting side returns. Cancel setup from either step, edit while reviewing, and check keyboard focus and the browser console.

Review is a guided pass through the existing cards, not a separate editor or a scored quiz. The status above the card shows whether a review is running, its starting side, order, and current position. Reveal the other side, then choose **Next card**. The last card offers **Finish review**; **End review** leaves early and restores saved-order browsing without discarding edits. **Change setup** restarts with new choices after confirmation.

Manually start a back-first review, confirm the visible summary and side labels, reveal and advance, finish at the last card, and end another review early. Confirm edited text remains and canceling Change setup leaves the current review intact.
