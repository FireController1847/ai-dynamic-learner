# Anatomy atlas

Anatomy is a self-contained, offline-first reference tool in Dynamic Learner's
**Tools** group. The initial release is **foundation only**. Its 11 body-system
categories, independently collapsible navigation/structure panels, front/back
selection, zoomable SVG stage, structure list, and data contracts are functional.
A richer, fully original SVG skeletal illustration depicts major axial and
appendicular bone groups, with cranial landmarks, segmented vertebrae, rib
arcs, shaped long bones, individual hands and feet. These remain teaching
illustrations rather than clinical-grade reference drawings.
All other systems still show a neutral, explicitly non-anatomical placeholder.

## Source ownership

- `atlas-model.ts`: immutable, versioned domain contract for systems, regions,
  structures, attributed sources, views, depth layers, and diagram geometry.
- `atlas-catalog.ts`: bundled catalog with all systems and the early skeletal pack.
- `skeletal-outline.ts`: original layered anatomical teaching geometry
  and stable bone-group identifiers, with bilateral mirroring and etched
  decorative details.
- `atlas-index.ts`: consistency validation, hierarchy safety, sorted layer
  access, shape-to-view indexing, and structure search.
- `anatomy-viewer.ts`: native Vue/SVG pan/zoom, keyboard-selectable geometry,
  selected-state highlighting, and a dismissible floating structure inspector
  over the right side of the drawing stage (no reflow of the SVG).
- `anatomy.ts`: route-level state, system and orientation selection, search,
  and the selected structure's data. The scrollable Structures panel remains
  an independent index, never a second details page.
- `anatomy.css`: presentation using Dynamic Learner theme tokens.

Atlas data is reference material that ships with the web build. It is not
user-created workspace state, is not written to IndexedDB, and must not
introduce online runtime dependencies. Later optional offline caches or
user progress would need their own explicit, validated persistence contract.

## Stable identifiers and anatomy coverage

Structure IDs are independent of illustrations. One structure may appear in
several views or layers; each SVG shape references its stable `structureId`.
Likewise, region IDs, view IDs, layer IDs, and sources are separately indexed.
A structure may have a parent in the **same** system. Regions are an independent
hierarchy, so a structure can occur in several regions without duplication.
System categories are navigational, not evidence that the system is complete.

The first `AtlasDataset` schema version is 1. Future anatomical packs may be
curated per system and region and assembled before `buildAtlasIndex`. A pack
must have globally unique IDs and satisfy the index's referential checks.
Do not replace or recycle an existing structure ID when improving artwork.
Make migrations explicit if record meaning or schema changes.

SVG coordinates are local to the diagram view's `width` and `height`; shape
geometry is data rather than injected SVG/HTML markup. Prefer new typed geometry
primitives when needed, not raw DOM or arbitrary untrusted attributes.
Keep original SVG files and licensed sources in the repo when bringing
external artwork into the atlas; authored regions should be individually
selectable and keyboard accessible.

For scale, add content in separately loadable bundles by system and regional
view rather than loading every detailed diagram at initial page open.
The foundation currently indexes a small catalog synchronously; this
should be replaced with an async content loader before large datasets ship.

## Source provenance and learning features

Every imported anatomy asset should have verified rights and documentation.
Keep source title, attribution, license, and authoritative reference URL where
available. Confirm terminology and anatomical accuracy with qualified
references and subject-matter review before claiming comprehensive coverage.

The atlas should remain separate from Review question content. Future
identification practice may refer to stable atlas IDs and generate assessment
items through a feature-owned adapter, without copying path geometry or
altering Review's persistence contract.

## Presentation and interaction

The viewer uses neutral bone/paper tones in both themes and separates fine
engraved contours from selectable geometry. Thin rib, finger and toe strokes
have larger invisible pointer targets, preserving a delicate visual appearance.
One keyboard tab stop per anatomical group avoids forcing navigation through
every repeated rib or digit. Selected structure details overlay the upper-right
side of the diagram inside the drawing stage rather than taking up a toolbar
row or resizing the SVG. The inspector can be dismissed, remains available
when the Structures index is hidden or moved below the viewer, and has an
internally scrollable height limit for compact screens.

## Manual verification

- Open `/anatomy/` from the Tools category and directly through its URL.
- Switch all 11 systems and front/back orientations; select skeletal bone shapes
  and corresponding list items; search the 28 named bone groups.
- Zoom/fit and pan the schematic SVG; verify both orientations and selected
  highlights.
- Collapse/reopen both body-system and structure panels independently,
  including the bottom Structures panel at narrower widths.
- Verify the “Lymphatic and immune” entry stays on one line.
- Confirm the selected structure's name and description appear in a small
  floating card at the right side of the viewer, even if Structures is
  collapsed or docked below.
- Confirm selecting and dismissing the floating card does not resize, move,
  or reflow the SVG, zoom controls, or workspace.
- Verify there is no instruction strip below the diagram, and skeletal
  fill/outline styles are neutral and consistent in both themes.
- Check empty-state messaging for non-skeletal systems and the skeleton's
  compact illustrative-only label.
- Check narrow screens, light/dark themes, keyboard focus, and reduced motion.
- Confirm offline navigation and no unintended workspace backup changes.
