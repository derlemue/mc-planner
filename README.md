# MC Planner: Minas Tirith Edition

![License](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)
![Version](https://img.shields.io/badge/Version-1.0.0-blue.svg)

A professional web-based planning tool for recreating **Minas Tirith** in Minecraft. Designed for multiplayer coordination, this tool provides layer-by-layer blueprints generated from a procedural geometric model approximating the iconic city.

## Features
- **Procedural Geometry**: Generates the 7 tiers, the Great Prow, and the White Tower dynamically.
- **Layer-by-Layer Slicing**: Slide through Y-levels to see exactly where to place blocks.
- **Material Manifest**: See a realtime count of materials needed for the currently viewed layer.
- **Coordinates & Grid**: Precise coordinate display for accurate block placement.
- **Premium UI**: Modern dark mode interface with smooth controls.

## Usage
### Quick Start
To run the application, you must use a local web server due to browser security restrictions on loading modules from `file://`.

1. Open a terminal in the project folder.
2. Run a simple HTTP server:
   ```bash
   python3 -m http.server 8080
   ```
3. Open your browser to [http://localhost:8080](http://localhost:8080).

### Controls
- **Level Y Slider**: Select the vertical layer you are building.
- **Pan**: Click and Drag to move the view.
- **Zoom**: Use the `+` / `-` buttons.
- **Material List**: View required blocks for the current layer in the sidebar.

## Inspiration
Based on the architecture of Minas Tirith as seen in *The Lord of the Rings* and popularized in Minecraft by projects like **CraftAttack 13**.
(Reference: [Youtube: CraftAttack 13 Minas Tirith](https://www.youtube.com/watch?v=97VrC-TdKUw))

## License
This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.
You are free to use, adapt, and share this material for non-commercial purposes with attribution.
