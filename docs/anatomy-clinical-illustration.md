# Source-backed skeletal artwork in Anatomy

This replaces the hand-drawn procedural skeleton with anatomically authored SVG
artwork supplied by the DigitalHealthZurich project, **Open-Source Anatomical
Illustration for Digital Back Pain Documentation: Development and Evaluation**.
https://github.com/DigitalHealthZurich/open-pain-illustration

**Source:** `illustration/1.0/anatomical_illustration.svg` version 1.0.
**License:** Creative Commons Attribution 4.0 International (CC BY 4.0).
https://creativecommons.org/licenses/by/4.0/
**Credit:** Yanick X. Lukic, Sonja Schläpfer, Alessandro Holler, Giovanni
Colacicco, Dennis Baumli, Leana Wirth, Steven Häsler, Christoph J. Laux,
Reto Sutter, Georg Wilhelm Kajdi, Benedikt Herzog, Sebastiano Caprara,
Claudia M. Witt, Philipp Ackermann. No endorsement is implied.
**Article:** https://doi.org/10.2196/preprints.75737

**Adaptations:** separate the combined anterior/posterior SVG into offline
self-contained view crops; extract exact authored paths as transparent
selection/quiz targets. Coordinates and rendered contour shapes are unchanged.
All source assets are bundled in the repository, without runtime downloads.

**Important incompleteness:** This medical illustration maps 182
unique canonical bones (out of 206) in at least one view. Some deep skull and
auditory structures lack independent contours; named but unmapped bones are not
rendered or treated as selectable and remain in the saved semantic catalogue.
Anatomical verification and full browser screenshot QA remain outstanding.
Tests confirm catalog integrity and source provenance, **not** clinical accuracy.

See docs/anatomy-source-model.md for the complete 206-bone gate and possible
later migration to a reviewed, fully covered 3D source mesh.
