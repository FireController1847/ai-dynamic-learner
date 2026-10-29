# Anatomy atlas

Anatomy is a self-contained, offline-first reference tool in Dynamic Learner's
**Tools** group. Its 11 body-system categories, independently collapsible
navigation/structure panels, **Both / Front / Back** visibility, regional
views, zoomable SVG stage, structure list and data contracts are functional.
Skeletal, Muscular, Nervous, Endocrine and Cardiovascular have original
teaching illustrations; the remaining six systems retain neutral placeholders.
The skeletal atlas now enumerates 206 individual adult bones (80 axial and
126 appendicular). Each bone has a stable ID and an individually selectable
vector shape in the front and back 2D projections. This is an **authored,
schematic projection**, not clinically validated morphology; especially
deep skull bones and middle-ear ossicles require dedicated sectional or
regional plates to represent their precise 3D positions and contours.
The Muscular system also contains a curated introductory atlas of major
superficial muscles in the anterior and posterior views, with individual
selection, descriptions, and regional navigation. Nervous also contains an introductory atlas of the brain, spinal cord
and major peripheral nerve pathways, with independently selectable
structures and descriptions. Endocrine now includes the major endocrine
glands and their subregions, including mutually exclusive gonadal anatomy.

## Source ownership

- `atlas-model.ts`: immutable, versioned domain contract for systems, regions,
  structures, attributed sources, views, depth layers, and diagram geometry.
- `atlas-catalog.ts`: bundled catalog with all systems and the early skeletal pack.
- `muscular-structures.ts`: 46 named superficial muscle types, 91 individual
  selectable anatomical structures, region membership, actions, and curated
  anterior/posterior surface coverage.
- `muscular-geometry.ts`: separately authored front/back muscle silhouettes
  with a completeness guard for all curated surface-view entries.
- `nervous-structures.ts`: CNS/PNS/autonomic named structures, actions,
  source attributions, and anterior/posterior availability.
- `nervous-geometry.ts`: original selectable neural paths and a
  completeness guard for all illustrated structure IDs.
- `endocrine-structures.ts`: stable gland and subregion records,
  side-specific anatomy, hormones, and gonad configuration.
- `endocrine-geometry.ts`: original anterior/posterior gland shapes,
  anatomical guide contours and completeness checks.
- `cardiovascular-structures.ts`: major systemic, pulmonary and coronary
  pathways plus four heart chambers, with direction-specific coverage.
- `cardiovascular-geometry.ts`: original cardiac cutaway and anterior/posterior
  SVG vessels with a coverage guard for every published structure.
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

## Nervous atlas

Nervous adds **35 major nervous structures or named nerve groups**, with
left/right counterparts where anatomically appropriate. The selection
includes cerebral/cerebellar hemispheres, midbrain, pons, medulla, spinal
cord, cauda equina, selected cranial nerves, cervical/brachial/lumbar/sacral
plexuses and major thoracic, arm and leg nerve courses.

- Front: cerebral hemispheres, CNS pathways, selected cranial nerves,
  brachial and cervical plexuses, phrenic/intercostal nerves, median/ulnar
  nerves, lumbar plexus and femoral/obturator/saphenous nerves.
- Back: cerebellar hemispheres, brainstem, cord, accessory nerve,
  posterior plexus pathways, radial, sciatic, tibial and sural nerves.
- Both: anterior routes plus posterior-only pathways at lower opacity,
  with shared structures drawn only once.
- Regions: Whole body, Brain & head, Spinal cord, Chest nerves,
  Abdomen, Pelvis, Arms & hands, and Legs & feet.

The viewer's compact body silhouette is not a source anatomical plate.
CNS structures use lavender, peripheral nerve routes amber. The
spinal cord terminates near the upper lumbar vertebrae instead of
extending down the entire lumbar canal; the *cauda equina* continues
below it. Nerve curves are **schematic territory guides**, not precise
clinical tracing of root levels, foramina or individual fascicles.
The atlas is neither complete neuroanatomy nor medically validated.

Naming and basic functions draw from [OpenStax CNS](https://openstax.org/books/anatomy-and-physiology-2e/pages/13-2-the-central-nervous-system)
and [OpenStax PNS](https://openstax.org/books/anatomy-and-physiology-2e/pages/13-4-the-peripheral-nervous-system).
No externally sourced diagrams are embedded; all SVG geometry is
hand-authored and bundled offline.

### Nervous manual verification

- Confirm Front/Back/Both diagrams are nonempty and the Structures list
  contains only illustrated nerve entries in the selected view.
- In Front, select optic, trigeminal, brachial plexus and median nerves.
  In Back, select cerebellum, accessory, radial, sciatic and tibial nerves.
- Verify central vs peripheral colors, left/right labels and the floating
  structure inspector with short descriptions.
- Check Spinal cord, Brain & head, Arms & hands and Legs & feet crops;
  verify selection remains stable when zooming and moving across regions.
- Check wheel pan, Z scrub zoom, sidebars, mobile, dark mode and
  keyboard selection; return to Skeletal and Muscular for regressions.

## Endocrine atlas

The Endocrine system adds **15 named anatomical structures or tissue types**,
yielding **21 independently selectable records** when the four parathyroids,
paired adrenal subregions and paired gonads are counted separately.
The full-body view includes the hypothalamus, pituitary stalk, anterior and
posterior pituitary, pineal, thyroid, four parathyroids, thymus, both adrenal
cortices and medullae, pancreatic islets, and ovaries **or** testes.

Anatomical conventions:

- The pineal is shown posteriorly and the pituitary and hypothalamus use
  a transparent intracranial teaching projection. They are not visible
  through the skull at the surface.
- The thyroid is an anterior-neck butterfly-shaped gland. The normally
  four parathyroids sit on its **posterior** surface, so Front omits
  them while Back and Both make them individually selectable.
- The thymus is in the anterior superior mediastinum and ordinarily
  becomes smaller with age. Its teaching shape is exaggerated.
- The adrenal cortex surrounds the medulla; both are projected just
  superior to the kidneys. The pancreatic islets are microscopic cell
  clusters *throughout* the pancreas, represented by several shared-ID
  dots, not a single macroscopic endocrine organ.
- The **Gonads** selector offers *Ovaries*, *Testes*, or *Hidden*.
  Ovaries and testes never appear together in one figure.
- **Front / Back / Both** use anatomical diagrams rather than claims
  of skin-level visibility. Both overlays rear-only deep glands with
  softer opacity over the front teaching view.

Regional views: Whole body, Brain glands, Thyroid & parathyroids,
Chest, Abdominal glands and Gonads. Each region uses its own framing
rectangle within the original 320 × 700 drawing, without changing the
structure IDs or persistence model.

Terminology, locations and hormone descriptions were checked against
[OpenStax Anatomy and Physiology 2e, Chapter 17](https://openstax.org/books/anatomy-and-physiology-2e/pages/17-introduction)
and [MedlinePlus: Endocrine glands](https://medlineplus.gov/ency/article/002351.htm).
All drawings are hand-authored, offline illustrations. Size, exact
surgical anatomy and microscopic tissue detail are **not medically
validated**. This atlas is for introductory study, not clinical decisions.

### Endocrine manual verification

- Switch to Endocrine and confirm the whole-body illustration,
  searchable structure list, selected structure details and sidebar
  collapse controls all work.
- Check Front/Both/Back: four separately selectable parathyroids
  should appear only in Back and Both; pineal is similarly posterior.
- Zoom into Brain glands and select hypothalamus, pituitary stalk,
  anterior/posterior pituitary and pineal. Fit should restore framing.
- Zoom into Thyroid & parathyroids and Abdominal glands; distinguish
  thyroid, cortex/medulla and the distributed islet markers.
- In Gonads, verify only ovaries or testes appear when selected,
  and none appear when Hidden is selected. The list and inspector
  must update with the same choice.
- Confirm wheel pan, Z scrub zoom, keyboard focus, narrow screens,
  dark mode and selection responsiveness. Switch back to each
  already-implemented system to check for regressions.

## Cardiovascular atlas

Cardiovascular introduces **60 named heart chambers and major vascular structures
or groups**, with independently selectable right/left vessels where appropriate.
It is a teaching-scale projection of the **heart, pulmonary circuit and major
systemic arteries and veins**; it does not represent every microscopic vessel,
capillary bed or anatomic variant.

- **Heart:** four chamber cutaways (right/left atria and ventricles),
  ascending aorta, pulmonary trunk and pulmonary vessels, and named major
  coronary arteries and veins. The heart lies in the mediastinum with
  its apex directed toward the person's left side.
- **Arteries:** aortic arch, descending thoracic and abdominal aorta,
  carotid/subclavian branches, arm and leg artery pathways, renal and
  mesenteric branches. Left/right IDs follow anatomical laterality.
- **Veins:** superior and inferior venae cavae, jugular/brachiocephalic
  venous return, deep and superficial upper/lower limb pathways, renal,
  hepatic and portal venous channels and coronary drainage.
- **Pulmonary circulation:** right ventricle → pulmonary trunk/arteries →
  lungs → pulmonary veins → left atrium. **Pulmonary arteries carry
  oxygen-poor blood**, unlike most systemic arteries. The pulmonary veins
  return oxygen-rich blood.
- **Both / Front / Back:** Front and Back offer separate schematics;
  Both overlays posterior-only structures at reduced opacity over
  the front. Shared structures are not drawn twice.
- **Vessels filter:** All, Arteries or Veins. Heart chambers remain
  selectable in every filter. Colors indicate *relative oxygenation*
  (warm red for oxygen-rich and muted blue for oxygen-poor) rather
  than a universal "arteries red, veins blue" assumption.
- **Regional views:** Whole body, Heart & coronary vessels,
  Head & neck, Chest circulation, Abdominal circulation,
  Pelvic vessels, Arms & hands, Legs & feet.

Paths are original 2D schematic routes with simplified curves, **not**
clinically reviewed anatomical traces of vessel depth, normal variants,
anastomoses, precise branching angle or coronary dominance. The
four-chamber heart is a transparent cutaway, not what is all visible
from the body's front surface. Relative vessel dimensions and
capillary exchange are deliberately simplified.

Anatomical relationships and pathway descriptions were checked against
[OpenStax Anatomy and Physiology 2e — Heart Anatomy](https://openstax.org/books/anatomy-and-physiology-2e/pages/19-1-heart-anatomy)
and [Circulatory Pathways](https://openstax.org/books/anatomy-and-physiology-2e/pages/20-5-circulatory-pathways).
No reference artwork is copied. All assets are bundled offline.

### Cardiovascular manual verification

- Switch to Cardiovascular, check whole body shows selectable arterial
  and venous routes and a four-chamber heart cutaway.
- Zoom into Heart & coronary vessels to select all four chambers,
  aortic arch, pulmonary trunk, coronary arteries and coronary sinus.
- Confirm red/blue assignments: systemic arteries and pulmonary
  veins are oxygen-rich; systemic veins and pulmonary arteries are
  oxygen-poor. Atria and ventricles use the corresponding sides.
- Switch Arteries / Veins / All, verifying the structure list and
  outlines update together while the chamber selection remains.
- Switch Front / Back / Both and confirm back-only popliteal and
  posterior intercostal paths are correctly displayed and subdued
  when overlaid in Both.
- Test every vascular region, its crop, and the search results.
  Verify normal drag, mouse wheel, Ctrl+wheel, Z scrub, and Fit.
- Verify selected structure inspector, collapsed panels, responsive
  layout, dark theme, keyboard focus and switching to older systems.

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

## Anatomy history compatibility (v0.12.1)

Anatomy's first saved-results release required `attempts: []` while
IndexedDB workspaces predating Anatomy often lacked the corresponding
`featureState` row. The hydrator incorrectly synthesized only
`{ items: [] }`, which failed validation and prevented the **entire
workspace** from opening with the message "Saved Anatomy results have
an invalid structure." Version 0.12.1 supplies `emptyAnatomy()`
during hydration and normalizes a missing `attempts` field in
older backups. Actual saved attempt arrays must still validate:
**malformed present results are never silently cleared**.

Manual verification: load a pre-Anatomy IndexedDB workspace without
an Anatomy feature-state row and confirm all apps/data open normally.
Import a backup without `features.anatomy` or with
`anatomy: { items: [] }`; both should migrate without deleting
other content. Verify a valid populated Anatomy attempt history
survives reload/export/restore, while a present invalid `attempts`
value still blocks unsafe loading. No database reset or schema bump.

## Structures hierarchy

The right-hand **Structures** index groups visible anatomical records
using the *same classification parser* as Fill in the Blanks
(\`anatomy-structure-groups.ts\`). A classification such as
\`Axial skeleton · Cervical vertebrae\` produces the disclosure hierarchy:

- **Axial skeleton** (category, with a count of visible structures)
  - **Cervical vertebrae** (subgroup, with a count)
    - C1, C2, … C7 (selectable individual structures)

The structure list preserves the authored anatomical ordering, rather
than mixing all 206 bones in a flat alphabetical list. All illustrated
systems share the hierarchy component; categories with only one
classification level (e.g. "Central nervous system") simply list
their structures directly beneath that heading. Categories start open;
subgroups start collapsed for compact browsing. A diagram selection
automatically opens its corresponding category and subgroup. Search
temporarily expands all groups containing matching names, aliases, or
classifications; clearing search restores the user's earlier disclosure
choices. Counts reflect the current region, orientation and filters.
No duplicate records or taxonomy-specific persistent data are added.

The Fill in the Blanks button uses the existing **Pencil** icon.
The formerly requested \`pencil-line\` icon was not registered and
rendered as an empty SVG with an unexplained gap before the label.
A real close (\`x\`) glyph is also registered for the quiz **Exit** action.

### Structures hierarchy manual checks

- On Skeletal Whole body / Both, verify Axial skeleton and
  Appendicular skeleton, with nested Cranium, Cervical vertebrae,
  Pectoral girdle and other subgroups, and every bone selectable.
- Expand/collapse categories and subgroups using mouse, touch and
  keyboard. Confirm count labels and no duplicated names.
- Search by bone, subgroup, Latin/alias and a classification term;
  only matching structures should appear and all filtered groups should
  expand. Clearing search restores the previously collapsed groups.
- Select a bone from the figure while its group is closed: its group
  must open and the corresponding structure entry become selected.
- Change system, region, Front/Back/Both, and cardiovascular vessel
  filters: groups and counts must accurately reflect visible records.
- Check light/dark and narrow/mobile views, focus rings and reduced
  motion. Confirm the FitB and Exit buttons have **visible icons**
  without wasted space ahead of their text.

## Fill in the blanks · study workspace (Skeletal)

**Fill in the blanks** beside the zoom controls now turns on a distinct,
full-width **study workspace** rather than immediately starting a 206-bone
quiz. The sidebar panels disappear temporarily, and the system/region/
orientation settings remain locked until the user presses the visible
**Exit (×)** action. Normal pan, zoom, Fit, Z scrub and wheel controls
continue working during an active quiz.

### Choosing study sections

Entering study mode displays a scrollable, compact selection screen.
Sections come from the atlas's canonical classifications and currently
visible SVG structure IDs. **Whole body / Both / Skeletal** produces
**27 focused sections plus one All visible structures choice (28 total)**.
The Axial and Appendicular groups include meaningful subdivisions:
separate sternum, upper ribs (1–6) and lower ribs (7–12); humerus versus
radius/ulna; femur/patella versus tibia/fibula; and proximal/middle/distal
hand and toe phalanges. Other anatomical classifications stay together.
Regional and Front/Back filters restrict the available choices and
question counts to those visible when study mode is entered. Sections
with no visible structures do not appear.

The selection screen groups these choices under their anatomical systems
(e.g. Axial skeleton and Appendicular skeleton), each showing a count
of study items, last score, best percentage, and number of completed
attempts. A **Study** button launches the chosen section only. Prompts
remain paginated in groups of at most six, using the established blank
inputs and leader lines that follow bones during pan, zoom and resize.
No names are disclosed through ordinary figure selection or SVG tooltips
during the assessment.

### Results and storage

Completing the last quiz page records a **new attempt** with a unique
ID, system, section, exact region/orientation scope, earned score,
question count and completion timestamp. The full results screen is
shown **before** returning to the section-selection screen; it displays
the final score, skipped count and missed answers. Users can try that
section again or return to the selection screen without exiting study
mode. The close button exits to normal Anatomy viewing.

Completed attempts are stored in the **existing workspace's
\`featureState\` IndexedDB record**, through the common Vue workspace
observer. They persist across app switches, reloads and browser sessions,
participate in cross-tab synchronization, and are included in regular
Dynamic Learner workspace JSON exports/restores. Importing an older
workspace with no Anatomy field creates an empty results model; no
IndexedDB schema upgrade is needed. In-progress responses are
intentionally transient.

Within each section's expandable **Previous results** panel, users may
remove a single attempt or reset that section's history (two-step
confirmation). **Reset all results** at the top of the selection screen
also requires confirmation and clears all Anatomy attempt histories.
Stored results are scoped by selected region/orientation to avoid
comparing a short regional quiz with a full-body assessment. A later
body-system pack can opt in through \`identificationPacks\` and reuse the
section picker, attempts model, and grading flow.

Answer checking accepts canonical bone names and aliases, optionally
without left/right prefixes or generic "bone" / "vertebra" words. Digit
numbers, rib numbers and vertebral levels still need correct identity.

### Identification manual verification

- Skeletal Whole body / Both: entering Fill in the Blanks should show
  about 28 options (27 anatomical sections + All visible bones), **not**
  immediately show blank prompts.
- Choose Cervical vertebrae and verify the quiz contains exactly the
  seven visible cervical vertebrae, with Previous, Skip, Check, Next,
  and connected line prompts. Repeat with Ribs 1–6 and Hand phalanges.
- Complete a quiz; confirm Results displays before **Back to sections**.
  Verify the section now shows Last, Best, Attempts and dated history.
- Navigate to another app, return, and reload: attempt records persist.
  Verify browser same-workspace tab sync and JSON backup/export/restore.
  Import an old backup without an Anatomy field; it must open normally.
- Remove one result and reset a whole section (confirmation required);
  then reset all records, confirming unrelated study/content persists.
- Test another orientation/region with a shorter visible structure
  count: records must not be misattributed to the Whole body/Both scope.
- Close study mode and confirm the normal anatomical panels, camera and
  settings are restored. Study mode remains opt-in for Skeletal only.
- Check light/dark, mobile/short windows, keyboard focus, reduced motion
  and visible Exit icon.


## Viewer layout and camera guardrails

The desktop viewer is a **flexible fill-height surface**: the viewer
grows with the workspace and the diagram stage takes all remaining height
below the compact controls. The SVG is absolutely positioned inside that
stage, so its inherent 320 × 700 viewBox never contributes intrinsic height
to CSS layout. This avoids both a giant scrollable canvas and the opposite
bug of a fixed-height canvas stopping before the workspace's bottom edge.
On phones, where the page itself scrolls, the stage retains an explicit
responsive height rather than stretching unpredictably.

The default Fit view remains centered with a comfortable margin.
Drag pan, vertical/horizontal wheel pan, Ctrl+wheel zoom and Z scrub
remain available. All camera changes are bounded to the focused
anatomical region, with modest 12% overscroll, so ordinary navigation
cannot move the entire figure offscreen. Zoom range is unchanged.

### Viewer regression checks

- On a wide desktop and a tall display, switch through all five
  illustrated systems and confirm the *whole figure is visible immediately*
  below the toolbar, and the canvas **extends to the workspace bottom**
  without a separate empty band underneath.
- Resize the window taller and shorter: the stage must grow/shrink
  with the available height, not stop at a hard maximum height.
- Collapse both sidebar panels, zoom in/out and resize the window:
  the stage height must remain controlled and the drawing must stay
  centered when using Fit.
- Use fast wheel scrolling and drag in all directions: the canvas should
  never be able to move the *whole* focused figure out of the viewport.
  Inspect close-up regions too; their small shapes must remain reachable.
- Test Front, Back, Both, regional changes and the structure inspector;
  ensure they do not resize the stage or reintroduce giant scroll areas.
- Confirm phone/short-window behavior and keyboard-accessible Fit.

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
