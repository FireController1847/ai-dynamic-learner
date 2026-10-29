# Anatomy: replacing the illustrative skeleton with source-backed anatomy

**Status: architecture and source evaluation; no anatomically validated replacement has been shipped.**
This document supersedes the earlier strategy of improving `skeletal-geometry.ts`
with more hand-authored SVG curves. The current schematic remains a temporary,
explicitly nonclinical illustration, not evidence of anatomical fidelity.

## Decision

Use bone-by-bone, anatomically sourced **3D surface meshes** as the geometric
source of truth. Render them through an **offline-bundled 3D viewer**, with
orthographic anterior and posterior camera presets and optional region focus.
Do **not** infer realistic bone morphology by scaling procedural ellipses or
cylinders. Keep the existing semantic `skeletalStructures` catalogue and
completed identification history; geometry belongs to a separate, replaceable
source asset, not the record schema.

The 3D renderer shall support per-bone picking (raycasting), independent
highlight/visibility, pan, zoom, and the existing Front, Back and Both teaching
modes. FitB shall project each bone's authored mesh anchor/bounds into the
current screen view and place leader lines in the overlay layer, not reuse
hard-coded points from the discontinued SVG. Front/Back are orthographic camera
projections of the same articulated model; neither side is an independently
invented illustration. Both must be explicitly defined as an educational
through-body overlay, not a physically realistic single surface.

The source assets **must ship with the app**. There will be no required network
request, account, online database or runtime model downloader. Preserve the
existing unified offline workspace storage and existing result IDs. Keep
the non-skeletal systems' current SVG renderers until they are separately
replaced.

## Source inventory and licensing audit (29 October 2026)

### Primary candidate: BodyParts3D 4.0

- Official source: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- Official archive license: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
- Data: anatomical surface meshes and naming tables; release 4.0 is published
  under **CC BY 4.0**, with attribution to the Database Center for Life Science.
- Geometry is suitable for a proof-of-concept and much stronger than our
  homegrown paths; this is **not** certification of medical-grade accuracy.
- **Completeness blocker:** independent BodyParts3D-based skeleton explorers
  report that the coccyx and six middle-ear ossicles are absent from their
  sourced mesh set. Before integration, reconcile the **source release** and
  every required bone ID against `skeletalStructures`. Do not substitute
  shapes invented in code and claim the source is complete.

Reference demonstrations:
- https://github.com/organui/skeleton-3d : 5.2 MB bundled source-based GLB,
  242 clickable structures (some are non-bone cartilage and discs); the
  project's source explicitly notes missing coccyx and ossicles.
- https://sciencequest.in/tools/full-skeleton-explorer/ : another independent
  206-vs-source audit.

### Secondary source: Z-Anatomy

- https://github.com/LluisV/Z-Anatomy
- Models are BodyParts3D-derived and include a **CC BY-SA** attribution and
  redistribution obligation. Some broader Z-Anatomy packs include
  **noncommercial third-party** assets for non-skeletal structures; do not
  import those into a general-purpose distributable anatomy pack.
- A secondary bone source may be considered only with explicit per-object
  provenance, redistribution permission, and a documented mesh-to-bone map.
- Retain the original source's license notices with every derived asset.

### Rejected as a 206-bone source of truth: clinical 2D SVG

- https://github.com/DigitalHealthZurich/open-pain-illustration
- A strong, CC BY 4.0 anterior/posterior illustration from an interdisciplinary
  anatomical review, but it is designed for pain documentation. It does not
  furnish individually modeled geometry for every deep bone in our 206-bone
  catalogue. It could be a visual comparison reference, not a full replacement
  for independent bone selection.
- Article: https://doi.org/10.2196/75737

## Required gate before enabling the replacement

1. Pin a source release, model checksum, license, attribution, modification
   log and conversion script. A derivative `.glb` is a separate licensed
   asset from our application code.
2. Establish **206 exact, independent canonical mappings** to real, nonempty
   named mesh nodes in an offline asset (the `skeletal-mesh-contract.ts`
   validation guards this semantic prerequisite). No one mesh may substitute
   for two separately scored bones. Grouped source parts such as the sternum
   must be mapped without changing the adult 206 convention.
3. Reconcile absent source structures (especially the coccyx and six ossicles)
   with verifiably licensed supplementary source geometry **or do not claim
   completion**. Do not invent the missing bones with procedural primitives.
4. Validate 3D transforms, consistent units, coordinate orientation,
   articulations, bilateral laterality, proximity and surface intersections.
   Confirm hands are joined by carpal-metacarpal-phalangeal joints and toes
   by tarsal-metatarsal-phalangeal articulations.
5. Inspect rendered **anterior, posterior, full-body, pelvis, skull, hands,
   and feet** with credible anatomical references, including medically
   knowledgeable review. A typecheck, 206-entry count, hash check or
   screenshot alone never certifies anatomical correctness.
6. Run real-browser checks of click picking, keyboard access, drag, zoom,
   Front/Back/Both, FitB leaders, results persistence, local-only asset loading,
   mobile performance, WebGL loss/fallback, and safe workspace initialization.
7. Only after the above gates pass: replace the default skeletal viewer and
   remove the old procedural drawing. Keep study IDs and saved attempts stable.

## Deliberate non-change

No source-backed model is checked into this PR yet. The gate is intentionally
strict: adopting a convenient but incomplete model and claiming that all 206
bones are anatomically accurate would repeat the exact failure this
replacement is intended to fix.
