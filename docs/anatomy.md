# Anatomy atlas

Anatomy is a self-contained, offline-first reference tool in Dynamic Learner's
**Tools** group. The initial release is **foundation only**. Its 11 body-system
categories, independently collapsible navigation/structure panels,
**Both / Front / Back** visibility, regional views, zoomable SVG stage,
structure list, and data contracts are functional.
The skeletal atlas now enumerates 206 individual adult bones (80 axial and
126 appendicular). Each bone has a stable ID and an individually selectable
vector shape in the front and back 2D projections. This is an **authored,
schematic projection**, not clinically validated morphology; especially
deep skull bones and middle-ear ossicles require dedicated sectional or
regional plates to represent their precise 3D positions and contours.
The Muscular system also contains a curated introductory atlas of major
superficial muscles in the anterior and posterior views, with individual
selection, descriptions, and regional navigation. The remaining nine
systems still show neutral, explicitly non-anatomical placeholders.

## Source ownership

- `atlas-model.ts`: immutable, versioned domain contract for systems, regions,
  structures, attributed sources, views, depth layers, and diagram geometry.
- `atlas-catalog.ts`: bundled catalog with all systems and the early skeletal pack.
- `muscular-structures.ts`: 46 named superficial muscle types, 91 individual
  selectable anatomical structures, region membership, actions, and curated
  anterior/posterior surface coverage.
- `muscular-geometry.ts`: separately authored front/back muscle silhouettes
  with a completeness guard for all curated surface-view entries.
- `skeletal-bones.ts`: canonical count-checked adult bone inventory,
  side-specific bone IDs, and NCI/OpenStax anatomical categories.
- `skeletal-geometry.ts`: individual 2D SVG hit shapes for each of the
  206 bones on each orientation, including proportional limb scaling and
  mirrored anatomy. It asserts that neither orientation omits a bone.
- `anatomy-regions.ts`: regional focused camera bounds and filters, plus
  explicit occlusion rules for Front and Back (Both is an X-ray-like
  teaching overlay).
- `atlas-index.ts`: consistency validation, hierarchy safety, sorted layer
  access, shape-to-view indexing, and structure search.
- `anatomy-viewer.ts`: native Vue/SVG pan/zoom, keyboard-selectable geometry,
  a single compact white viewer header containing system, orientation, region
  and zoom controls, plus a dismissible floating structure inspector over
  the right side of the drawing stage (no reflow of the SVG).
- `anatomy.ts`: route-level state, system and orientation selection, search,
  and the selected structure's data. The scrollable Structures panel remains
  an independent index, never a second details page.
- `anatomy.css`: presentation using Dynamic Learner theme tokens.

Atlas data is reference material that ships with the web build. It is not
user-created workspace state, is not written to IndexedDB, and must not
introduce online runtime dependencies. Later optional offline caches or
user progress would need their own explicit, validated persistence contract.

## Muscular atlas

The muscular atlas introduces **46 named superficial muscle types** (91
structures including left/right laterality; orbicularis oris is modeled as
a single circumoral muscle). The source-backed descriptions emphasize basic
actions; shapes were drawn independently and use the same 320 × 700 canvas
and common viewer as Skeletal.

- **Front:** facial expression and chewing muscles, sternocleidomastoid,
  pectoralis major, serratus anterior, rectus abdominis, external oblique,
  deltoid, biceps and forearm flexors, tensor fasciae latae, sartorius,
  superficial thigh muscles, tibialis anterior and lateral lower-leg muscles.
- **Back:** posterior scalp/neck, trapezius, deltoid, infraspinatus,
  teres major, latissimus dorsi, erector spinae columns, triceps and
  forearm extensors, gluteals, hamstrings, gastrocnemius and soleus.
- **Both:** a lighter posterior layer behind anterior muscles, with
  individual selection across the composite.
- **Regions:** Whole body, Head & neck, Chest & shoulders, Back,
  Abdomen, Hips & glutes, Arms & forearms, Thighs & lower legs. Intrinsic
  hand/foot and deep muscle detail regions are not falsely advertised
  before corresponding artwork exists.

The muscle drawings are intentionally illustrative, and not an exhaustive
map of the hundreds of individual skeletal muscles or every fascicle,
origin, insertion and layer. Some listed muscles (e.g., brachialis or
erector spinae) are partly obscured or are groups whose exact topology
needs regional sectional illustrations. **Do not claim clinical
morphological accuracy.** Terminology and basic actions are sourced to
[OpenStax Anatomy & Physiology 2e, Chapter 11](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-introduction),
including [head and neck](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-3-axial-muscles-of-the-head-neck-and-back),
[upper limb](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs),
and [lower limb](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs).
No OpenStax images were copied; original SVG paths are bundled offline.

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

The viewer uses neutral bone/paper tones with fine strokes and reduced
hit-target overlap, so adjacent small bones can be distinguished after
zooming. A stationary click selects; mouse drag pans from the stage,
including on a bone. Holding Z while dragging horizontally scrubs zoom
around the starting point. Ctrl+wheel zooms around the pointer. Ordinary
vertical mouse-wheel/trackpad scroll pans vertically inside the diagram;
Shift+wheel pans horizontally. The floating selection inspector stays over
the diagram without resizing it or stealing the scroll from the canvas.

The regional dropdown includes Whole body, Head & neck, Chest & shoulders,
Spine, Lower torso, Pelvis, Arms, Hands & wrists, Legs, and Feet & ankles.
Each uses its own focused rectangle within the existing 320 × 700 canonical
2D artwork and filters the structure list; regional zoom does not copy
the geometry or duplicate data IDs.
The Arms and Legs scopes intentionally exclude the separate Hands & wrists
and Feet & ankles bones. Head & neck includes C1–C7; Chest & shoulders
includes the lowest ribs. A regional choice does not conceal bones beyond
its crop while continuing to list them in the Structures panel.

Visibility modes: **Both** defaults to all structures overlaid in an
anterior schematic projection, including bone locations otherwise obscured.
Deep bones are drawn with reduced opacity to distinguish them from the
surface view.
**Front** and **Back** render their respective front/back projections and
hide bones not visible from that surface, such as the scapula in Front,
sternum and face in Back, and middle-ear ossicles in both. Some
region/direction combinations intentionally have no visible bones;
an explicit message suggests Both, rather than showing an unrelated
figure placeholder. This is a simple
educational occlusion model, not ray-tracing, and cannot replace detailed
cutaways or clinically validated plates.

Whole-body Fit defaults to 91% of a tightly framed anatomical rectangle
to keep the full figure with reasonable margin. The user can zoom between
10% and 1,600%. The canvas height is restrained to avoid excessive vertical
blank space. At 100%, the atlas frame keeps the skull and toes within
view. Selection remains available at any zoom; the app does not artificially
enlarge nearby bone hit targets.

### Anatomy audit

Corrections against OpenStax Anatomy and Physiology references:
- Radius is **lateral (thumb side)**, ulna **medial** in anatomical
  position. Their shafts, wrist alignment and thumb direction were previously
  reversed and have been corrected. Wrist rows now progress radial to
  ulnar in the appropriate order.
- Patellae are anterior; scapulae are posterior; clavicle and sternum
  are anterior. Visibility filters now hide these from the opposite side.
- Femoral shafts have been realigned relative to pelvis and knee.
- The vertebral column retains 7 cervical, 12 thoracic, and 5 lumbar
  vertebrae, followed by the fused sacrum and coccyx.

Reference comparisons verify these positional relationships and the bone
inventory, **not the exact contours or clinical positional accuracy** of
all 206 hand-authored projection shapes.

### Muscular manual checks

- Open **Muscular** from the sidebar. Verify a nonempty full-body diagram
  and searchable Structures list in Both, Front, and Back.
- Front-select pectoralis major, biceps brachii, rectus abdominis,
  rectus femoris and tibialis anterior. Back-select trapezius,
  latissimus dorsi, triceps brachii, gluteus maximus and gastrocnemius.
- Confirm the **Both** overlay keeps posterior muscles subdued while
  retaining selection, and that left/right labels match anatomical
  orientation when switching to Back.
- Switch through every muscular region; verify the geometry is framed,
  its corresponding list is populated, and selecting a muscle does not
  change the viewport. Test zoom, Z scrub, wheel pan and Fit.
- Check narrow screens and dark mode, including the floating inspector.
- Switch back to Skeletal; bone counts and geometry must be unchanged.

## Manual verification

- Open `/anatomy/` from the Tools category and directly through its URL.
- Switch all 11 systems and Both/Front/Back modes; inspect anatomy
  regions, selecting bones in the diagram and searchable structure list.
- Check that the inventory is exactly 206, broken into 80 axial and 126
  appendicular bones, with distinct left/right IDs, fused adult hip bones,
  and each finger/toe phalanx.
- Check that all bones have selectable geometry in both orientations; skull,
  auditory ossicles, wrists, and feet need a high zoom to separate.
- Verify click-drag pans from both empty space and directly over bone shapes
  without accidentally selecting; a stationary click selects.
- Verify Z+horizontal drag scrubs continuously around the initial cursor
  position, and Z+click zooms one step; releasing Z restores pan.
- Verify wheel/trackpad vertical panning, Shift+wheel horizontal panning,
  Ctrl+wheel anchored zoom, and reset from a scrolled or dragged state.
- Collapse/reopen both body-system and structure panels independently,
  including the bottom Structures panel at narrower widths.
- Verify the “Lymphatic and immune” entry stays on one line.
- Confirm the selected structure's name and description appear in a small
  floating card at the right side of the viewer, even if Structures is
  collapsed or docked below.
- Confirm selecting and dismissing the floating card does not resize, move,
  or reflow the SVG, zoom controls, or workspace.
- Confirm system, region, orientation, and zoom appear in the single white
  viewer bar; the former heading/toolbar rows are gone.
- Compare average, tall, and short windows: the whole skeleton fits
  at the default 91%, without clipping its head or toes or filling the
  screen excessively.
- Zoom below 100% (down to 10%) and far above (up to 1,600%); drag
  to pan even at lower zoom. Fit restores the centered 91% view.
- Check head/torso/limb regional framing and structure filters, returning
  to Whole body with no stale camera state.
- Verify Front hides scapula/occulted deep structures and Back hides
  sternum, face and patella; Both restores all skeletal entries.
- Compare the thigh and lower-leg lengths against the torso and
  finger lengths against the forearms on both front and back views.
- Verify there is no instruction strip below the diagram, and skeletal
  fill/outline styles are neutral and consistent in both themes.
- Check empty-state messaging for non-skeletal systems, with no unwanted
  bone-count or illustration labels in the controls.
- Check narrow screens, light/dark themes, keyboard focus, and reduced motion.
- Confirm offline navigation and no unintended workspace backup changes.

## Reference inventory and limitations

Standard adult counts follow the US National Cancer Institute's
[SEER Anatomy Training](https://training.seer.cancer.gov/anatomy/skeletal/divisions/)
and [OpenStax Anatomy and Physiology 2e](https://openstax.org/books/anatomy-and-physiology-2e/pages/7-1-divisions-of-the-skeletal-system).
This 2D artwork is original and neither source's imagery is copied.

**Count-checked data and clickable geometry do not constitute medical
accuracy of the drawing.** The frontal/posterior whole-body views
approximate deep elements' positions; middle-ear ossicles, sphenoid,
ethmoid, palatine and other occluded bones need separate detail or
cutaway views and qualified anatomical review. Do not advertise the
atlas as a fully clinically validated 206-bone anatomy plate until
that review and regional illustration work are complete.
