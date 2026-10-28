# Human Anatomy atlas

Human Anatomy is a self-contained, offline-first reference tool in Dynamic Learner's
**Tools** group. The initial release is **foundation only**. Its 11 body-system
categories, front/back selection, zoomable SVG stage, structure list, and data
contracts are functional; no clinical-grade diagrams or anatomical structure
records are bundled in this version. The placeholder figure is strictly a
navigation illustration, not a labeled anatomical reference.

## Source ownership

- \`atlas-model.ts\`: immutable, versioned domain contract for systems, regions,
  structures, attributed sources, views, depth layers, and diagram geometry.
- \`atlas-catalog.ts\`: the initial bundled catalog and empty content records.
- \`atlas-index.ts\`: consistency validation, hierarchy safety, sorted layer
  access, shape-to-view indexing, and structure search.
- \`anatomy-viewer.ts\`: native Vue/SVG pan/zoom, keyboard-selectable geometry,
  selected-state highlighting, and empty-state display.
- \`human-anatomy.ts\`: route-level state, system and orientation selection, search,
  and structure details. It must not become the canonical anatomy database.
- \`human-anatomy.css\`: presentation using Dynamic Learner theme tokens.

Atlas data is reference material that ships with the web build. It is not
user-created workspace state, is not written to IndexedDB, and must not
introduce online runtime dependencies. Later optional offline caches or
user progress would need their own explicit, validated persistence contract.

## Stable identifiers and anatomy coverage

Structure IDs are independent of illustrations. One structure may appear in
several views or layers; each SVG shape references its stable \`structureId\`.
Likewise, region IDs, view IDs, layer IDs, and sources are separately indexed.
A structure may have a parent in the **same** system. Regions are an independent
hierarchy, so a structure can occur in several regions without duplication.
System categories are navigational, not evidence that the system is complete.

The first \`AtlasDataset\` schema version is 1. Future anatomical packs may be
curated per system and region and assembled before \`buildAtlasIndex\`. A pack
must have globally unique IDs and satisfy the index's referential checks.
Do not replace or recycle an existing structure ID when improving artwork.
Make migrations explicit if record meaning or schema changes.

SVG coordinates are local to the diagram view's \`width\` and \`height\`; shape
geometry is data rather than injected SVG/HTML markup. Prefer new typed geometry
primitives when needed, not raw DOM or arbitrary untrusted attributes.
Keep original SVG files and licensed sources in the repo when bringing
external artwork into the atlas; authored regions should be individually
selectable and keyboard accessible.

For scale, add content in separately loadable bundles by system and regional
view rather than loading every detailed diagram at initial page open.
The foundation currently indexes a tiny, empty catalog synchronously; this
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

## Manual verification

- Open \`/human-anatomy/\` from the Tools category and directly through its URL.
- Switch all 11 systems, front/back orientations, and zoom/fit controls.
- Check the accurate empty-state messaging for an atlas with no clinical content.
- Check narrow screens, light/dark themes, keyboard focus, and reduced motion.
- Confirm offline navigation and no unintended workspace backup changes.
