# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-19
### Added
- Initial release of MC Planner (Minas Tirith Edition).
- Procedural Generator for Minas Tirith geometry (7 tiers, Prow, White Tower).
- Web-based blueprint viewer with Canvas rendering.
- Layer-by-layer slicing (Y-level) controls.
- Material list generation per layer.
- Dark mode "Glassmorphism" UI.

## [1.4.0] - 2025-12-20
### Added
- **Dimension System**: Visual arrow indicators for block lengths (widths/depths).
- **Collapsible Legend**: A help overlay explaining grid lines, dimensions, and controls.
- **Improved UI**: Cleaner overlay styles and transitions.

## [1.3.0] - 2025-12-20
### Fixed
- Corrected layer switching mechanism for automated screenshot generation.
- Validated meaningful content in documentation images.

## [1.2.0] - 2025-12-19
### Added
- Decorative elements: Sea lanterns and Redstone lamps for lighting details.
- Fountain generated in the Prow area of Minas Tirith.
- Beacons and lights for Eiffel Tower.

### Changed
- **Label Optimization**: Adjacent run-length labels are now merged into single, centered labels. This fixes the clutter issue (e.g. "27 / 9").
- Improved label visibility with text outlining.
- Updated screenshots to match new rendering style.
