# BizBuddy workspace design

Preserve `LandingPage.jsx` and the existing landing stylesheet without visual changes.

The image-generated dashboard and authentication concepts in this directory are
the implementation references. Dashboard concepts use sample records only to
specify layout; rendered screens always use real records or honest empty states.

## Tokens

- Ink/navy `#162d3d`; teal `#087f73`; white `#ffffff`; canvas `#f6f8fa`;
  subtle border `#e2e8ed`; secondary text `#627180`.
- Plus Jakarta Sans for headings; DM Sans for controls and body. Self-host Latin fonts.
- Type: 32/40 page title, 20/28 section title, 14/22 body, 12/18 metadata.
- Sidebar: 240px, white, always visible at desktop. Header: 76px, white.
- Content: 32px desktop gutters, 20px tablet, 16px phone. Grid spacing 24px.
- Controls: 44px minimum touch targets, 8px radius. Panels: 12px radius.
- Borders convey grouping; shadows reserved for menus and dialogs.

## Behaviour

Deep-link page navigation and browser back/forward. Keyboard-accessible dialogs,
visible focus, reduced motion. Single page heading. Inputs have visible labels,
autocomplete, validation, pending feedback and actionable errors. No fake metrics,
provider connections, billing, testimonials or unsupported password reset actions.

Use tables for inventories, invoices and orders, a split inbox for conversations,
and clearly separated Connections, Assistant and Settings pages. Keep all existing
backend workflows, approval rules, stock updates and customer linking.

## Skill sources

- Anthropic frontend-design, pinned `e4bb5d960d87126ff3b3a8af1a104b7db67560ba`.
- UI UX Pro Max, pinned `3442615dcc7dcb3f70a1c9f69d5c287f37db023e`.

Both installed after a pre-install review. The UX database supplied verified
accessible-authentication guidance. Its general design-system searches returned
marketing-oriented patterns unsuitable for this dashboard; the visual concepts and
these product-specific tokens take precedence over those generic recommendations.

## Workspace refinement

Keep the original public landing. Give the working application a distinct navy
navigation rail, white work surfaces, teal actions and a quiet blue-grey canvas.
Use the existing self-hosted typefaces, with readable body text and larger story
headlines. Dashboard hierarchy: setup progress when needed, actual operating
figures, owner actions and recent conversations. Do not fill empty accounts with
fictional business records. Mobile remains a single focused conversation with a
composer sized to the visual viewport. Motion explains sending and completion.

## Current brand authority

The user's latest brief explicitly authorizes refining the landing and login
and bringing the workspace into the landing's violet/lavender/lime palette.
`DESIGN.md` and `src/Brand.css` now supersede the earlier navy/teal and
landing-preservation directions above. The current menu and basic UI structure
remain the same.
