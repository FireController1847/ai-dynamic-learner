# @dynamic-learner/tips

Reusable guided-tips UI for Vue applications.

This package owns the TIPS engine, guide UI, DOM spotlighting and placement, draggable cards, progress state, browser-local tip preferences, and the generic tutorial-action event boundary.

The package deliberately has no imports from Dynamic Learner. The host application supplies its own guide catalog, current feature descriptor, browser-local storage key, and optional feature adapters for prepare actions.

Feature-specific demo data stays in the host application. The package only asks the host to perform a named action.

The package is source-consumable in this repository so it can be moved to its own repository later without changing its internal imports. Vue is the only runtime peer dependency.
