# BizBuddy visual system

Refine the existing landing identity throughout the product. Preserve the current
menu, routes, business workflows and basic screen composition. This brief replaces
the earlier navy/teal workspace direction.

- Deep violet navigation and marketing surfaces: #1b152b / #120d20.
- Lime #c4f05c identifies primary actions and the selected menu item, with dark text.
- Lavender #c9beff supports the landing headline; pale lavender #f0ebf7 groups
  assistant content and selected states. Links use readable violet #5d408c.
- White working surfaces sit on #f7f6f9, with #e3deeb separators.
- Text: #272033 primary; #696174 secondary. Keep semantic success, warning and
  error colors distinct and accompanied by labels.

Plus Jakarta Sans carries headings and the shared wordmark; DM Sans carries
body text and controls. Both are already self-hosted. Use 32px workspace titles,
19–20px section headings, 14px dense app body, 16px marketing prose, and readable
12–13px supporting labels. Buttons have 44px targets and 7px radii; panels 10px.

The public landing is Persuade: retain the existing signature image and content,
refine the typography, remove arbitrary numeric labels and tilted cards, and
provide direct access to the working messages demo. Login and the application
are Operate: use stable geometry, clear contrast, quiet work surfaces and the same
palette. Preserve mobile list/detail chat and keyboard-aware composers.

`src/Brand.css` defines brand roles and shared refinements. Structural layout
remains in the existing workspace and demo stylesheets. No extra font package,
UI framework, animation dependency or external account is needed.

Skill: pbakaus/impeccable, pinned 2fc5e1459efbbf06d92c7306517c286bf12490cf,
reviewed before installation. Apply its polish, theming and craft guidance to the
incumbent design. Optional hooks remain inactive.
