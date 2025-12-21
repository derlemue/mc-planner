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

## [2.2.0] - 2025-12-21
### Fixed
- **Label Positioning**: Dimension labels are now strictly fixed to the wall centers and no longer float/slide view-dependently.
- **Label Overlap**: Implemented collision detection to prevent dimension labels from rendering on top of each other.
- **Edge Visibility**: Added background checkerboard rendering to allow counting blocks in empty space ("Void") at building edges.

## [2.1.0] - 2025-12-20
### Added
- **Secure Login**: Access protection with password authentication ("1337").
- **Live Demo**: Link added to README.

### Changed
- **Rotation**: Minas Tirith generator rotated 180 degrees (Entrance facing West).
- **Responsive Login UI**: Improved mobile layout for login screen.
- **Input Grouping**: Refined CSS for seamless input/button integration.

## [2.0.0-beta] - 2025-12-20
### Added
- **Auto-Hide Legend**: The legend overlay automatically minimizes after 10 seconds to reduce clutter.
- **Interactive Material Filter**: Click on materials in the sidebar to toggle their visibility on the blueprint.
- **Visual Feedback**: Disabled materials are now grayed out in the sidebar.

## [1.5.0] - 2025-12-20
### Documentation
- Updated all screenshots to reflect v1.4.0 UI changes.
- Refined "Dimension Detail" view for better clarity.

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
