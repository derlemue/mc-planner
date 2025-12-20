import { generateMinasTirith, generateEiffelTower, COLORS } from './generator.js';

// --- Global State ---
const state = {
    world: null, // Map<y, Map<x, Map<z, block>>>
    currentLayer: 10, // Changed from 30
    minY: 0,
    maxY: 300,
    zoom: 2, // Pixels per block
    offsetX: 0,
    offsetZ: 0,
    isDragging: false,
    lastMouseX: 0,
    lastMouseZ: 0,
    activeGenerator: 'minas_tirith',
    hiddenMaterials: new Set() // New state for filtering
};

// Expose for debugging
window.dbgState = state;

// --- DOM Elements ---
const canvas = document.getElementById('blueprint-canvas');
const ctx = canvas.getContext('2d');
const layerSlider = document.getElementById('layer-slider');
const layerInput = document.getElementById('layer-input');
const coordX = document.getElementById('coord-x');
const coordZ = document.getElementById('coord-z');
const materialListDom = document.getElementById('material-list');
const layerBlockCountDom = document.getElementById('layer-block-count');
const loadingOverlay = document.getElementById('loading-overlay');
const projectSelect = document.getElementById('project-select');

// --- Initialization ---
// --- Login Logic ---
function init() {
    const loginOverlay = document.getElementById('login-overlay');
    const loginBtn = document.getElementById('login-btn');
    const loginInput = document.getElementById('login-password');
    const errorMsg = document.getElementById('login-error');

    const attemptLogin = () => {
        const pass = loginInput.value;
        if (pass === '1337') {
            loginOverlay.classList.add('hidden');
            setupApp();
        } else {
            errorMsg.classList.remove('hidden');
            loginInput.value = '';
            loginInput.focus();

            // Re-hide error after animation/delay
            setTimeout(() => {
                errorMsg.classList.add('hidden');
            }, 2000);
        }
    };

    loginBtn.onclick = attemptLogin;

    loginInput.onkeydown = (e) => {
        if (e.key === 'Enter') attemptLogin();
    };
}

// Renamed from init()
function setupApp() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Project Selection
    if (projectSelect) {
        projectSelect.onchange = (e) => {
            state.activeGenerator = e.target.value;
            generateWorld();
        };
    }

    // Auto-Hide Legend after 10 seconds
    const legendPanel = document.getElementById('legend-panel');
    if (legendPanel) {
        legendPanel.classList.remove('hidden'); // Ensure visible at start
        setTimeout(() => {
            legendPanel.classList.add('hidden');
        }, 10000);
    }

    generateWorld();
    setupControls();
}

function generateWorld() {
    loadingOverlay.classList.remove('hidden');

    setTimeout(() => {
        if (state.activeGenerator === 'eiffel_tower') {
            state.world = generateEiffelTower();
        } else {
            state.world = generateMinasTirith();
        }

        // Find Y Bounds
        const yLevels = Array.from(state.world.keys()).sort((a, b) => a - b);
        if (yLevels.length > 0) {
            state.minY = yLevels[0];
            state.maxY = yLevels[yLevels.length - 1] + 10;

            layerSlider.min = state.minY;
            layerSlider.max = state.maxY;

            // Ensure current layer is valid, default to 30
            if (!state.world.has(state.currentLayer)) {
                // If 30 isn't valid, try finding closest or default to min
                if (state.world.has(30)) {
                    state.currentLayer = 30;
                } else {
                    state.currentLayer = Math.max(30, state.minY);
                }
            }
        } else {
            state.minY = 0;
            state.maxY = 256;
        }

        updateLayerControls();
        loadingOverlay.classList.add('hidden');
        render();
    }, 50);
}

function updateLayerControls() {
    layerSlider.value = state.currentLayer;
    layerInput.value = state.currentLayer;
}

// --- Canvas & Rendering ---
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    state.offsetX = canvas.width / 2;
    state.offsetZ = canvas.height / 2;
    console.log(`Canvas resized: ${canvas.width}x${canvas.height}`);
    render();
}

function render() {
    // console.log(`Rendering Layer ${state.currentLayer} ...`);

    // Clear
    ctx.fillStyle = '#020617'; // Match bg
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid (Background)
    drawGrid();

    // Render Blocks
    if (!state.world) return;

    const layer = state.world.get(parseInt(state.currentLayer)); // Ensure int
    const materials = new Map();
    let blockCount = 0;

    // We need to collect blocks to do the labeling pass effectively?
    // Actually, we can just iterate. But for labels we need to know neighbors.
    // Let's dump visible blocks into a sparse structure for the labeler.
    const visibleBlocks = new Set(); // Strings "x,z"

    if (layer) {
        for (const [x, row] of layer) {
            for (const [z, block] of row) {
                // Collect Stats (BEFORE filtering?)
                // User requirement: "materialien per klick ... ein und aufgeblendet".
                // Usually stats remain constant, but let's hide them from view.
                blockCount++;
                materials.set(block.type, (materials.get(block.type) || 0) + 1);

                // Filter visibility
                if (state.hiddenMaterials.has(block.type)) {
                    continue;
                }

                drawBlock(x, z, block.type);
                visibleBlocks.add(`${x},${z}`);
            }
        }

        // PASS 2: Labels
        // Only run if zoom is high enough to read
        // Pass the filtered Set 'visibleBlocks' to drawLabels to ignore hidden blocks?
        // drawLabels currently iterates 'layer'. We should make it respect hiddenMaterials.
        if (state.zoom > 10) {
            drawLabels(layer);
        }

    } else {
        // console.log(`No data for layer ${state.currentLayer}`);
    }

    updateSidebar(materials, blockCount);
}

function drawGrid() {
    const gridSize = state.zoom;

    // We want lines at World Coordinates.
    // Start X/Z in World Space
    // screenX = offsetX + worldX * zoom
    // 0 = offsetX + startX * zoom  ->  startX = -offsetX / zoom

    const startX = Math.floor(-state.offsetX / state.zoom);
    const endX = Math.ceil((canvas.width - state.offsetX) / state.zoom);
    const startZ = Math.floor(-state.offsetZ / state.zoom);
    const endZ = Math.ceil((canvas.height - state.offsetZ) / state.zoom);

    ctx.lineWidth = 1;

    // Optimization: Draw main grid less frequently if zoom is low?
    // Just draw lines.

    for (let x = startX; x <= endX; x++) {
        const screenX = state.offsetX + (x * gridSize);

        ctx.beginPath();
        if (x === 0) {
            ctx.strokeStyle = '#6366f1'; // Axis
            ctx.lineWidth = 2;
        } else if (x % 10 === 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; // 10s
            ctx.lineWidth = 1;
        } else if (x % 5 === 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // 5s
            ctx.lineWidth = 1;
        } else {
            if (state.zoom < 5) continue; // Cull detail
            ctx.strokeStyle = '#1e293b'; // Standard
            ctx.lineWidth = 1;
        }

        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, canvas.height);
        ctx.stroke();
    }

    for (let z = startZ; z <= endZ; z++) {
        const screenZ = state.offsetZ + (z * gridSize);

        ctx.beginPath();
        if (z === 0) {
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
        } else if (z % 10 === 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
        } else if (z % 5 === 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
        } else {
            if (state.zoom < 5) continue;
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
        }

        ctx.moveTo(0, screenZ);
        ctx.lineTo(canvas.width, screenZ);
        ctx.stroke();
    }
}

function drawBlock(x, z, type) {
    const size = state.zoom;
    const screenX = state.offsetX + (x * size);
    const screenY = state.offsetZ + (z * size);

    // Culling
    if (screenX < -size || screenX > canvas.width || screenY < -size || screenY > canvas.height) return;

    const color = COLORS[type] || '#ff00ff';
    ctx.fillStyle = color;

    ctx.fillRect(Math.floor(screenX), Math.floor(screenY), Math.ceil(size), Math.ceil(size));

    // Checkerboard Overlay
    if ((Math.abs(x) + Math.abs(z)) % 2 !== 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(Math.floor(screenX), Math.floor(screenY), Math.ceil(size), Math.ceil(size));
    }
}

function drawLabels(layer) {
    // Improved Labeling Logic:
    // 1. Show labels at lower zoom ( > 4)
    // 2. Scan off-screen to get TRUE total length
    // 3. Dynamic clutter filtering

    if (state.zoom <= 4) return; // Threshold lowered from 10

    ctx.font = `bold ${Math.max(10, state.zoom * 0.6)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    // Viewport bounds
    // We scan slightly outside viewport to catch runs starting just off-screen
    // preventing "pop-in" of labels.
    const padding = 2; // Blocks
    const startX = Math.floor((-state.offsetX / state.zoom) - padding);
    const endX = Math.ceil(((canvas.width - state.offsetX) / state.zoom) + padding);
    const startZ = Math.floor((-state.offsetZ / state.zoom) - padding);
    const endZ = Math.ceil(((canvas.height - state.offsetZ) / state.zoom) + padding);

    const hLabels = [];
    const vLabels = [];

    // Helper: Scan full length of a run
    const getRunLength = (x, z, type, dir) => {
        let length = 1; // Current block

        // Scan Backwards
        let scan = (dir === 'h') ? x - 1 : z - 1;
        while (true) {
            // Check world limits or arbitrary safe usage limit (e.g. 500 blocks away)
            const mapX = (dir === 'h') ? scan : x;
            const mapZ = (dir === 'h') ? z : scan;

            // Access deeply nested map safely
            let block = null;
            if (layer.has(mapX) && layer.get(mapX).has(mapZ)) {
                block = layer.get(mapX).get(mapZ);
            }

            if (block && block.type === type && !state.hiddenMaterials.has(block.type)) {
                length++;
                scan--;
            } else {
                break;
            }
        }
        const runStart = scan + 1; // Actual start index

        // Scan Forwards
        scan = (dir === 'h') ? x + 1 : z + 1;
        while (true) {
            const mapX = (dir === 'h') ? scan : x;
            const mapZ = (dir === 'h') ? z : scan;

            let block = null;
            if (layer.has(mapX) && layer.get(mapX).has(mapZ)) {
                block = layer.get(mapX).get(mapZ);
            }

            if (block && block.type === type && !state.hiddenMaterials.has(block.type)) {
                length++;
                scan++;
            } else {
                break;
            }
        }
        // runEnd is scan - 1

        return { length, start: runStart };
    };

    // Horizontal Scanning (Visible Area)
    for (let z = startZ; z <= endZ; z++) {
        let lastType = null;
        let visitedX = -Infinity; // Optimize: skip checking blocks we already counted in current loop run

        for (let x = startX; x <= endX; x++) {
            if (x <= visitedX) continue;

            let block = null;
            if (layer.has(x) && layer.get(x).has(z)) {
                block = layer.get(x).get(z);
                if (state.hiddenMaterials.has(block.type)) block = null;
            }

            if (block) {
                if (block.type !== lastType) {
                    // New run found
                    // Full scan!
                    const { length, start } = getRunLength(x, z, block.type, 'h');

                    // Filter: Clutter control
                    // At low zoom, hide small runs
                    if (state.zoom < 8 && length < 5) {
                        // Skip adding label
                    } else if (length > 2) { // Determine minimum length to label generally
                        // Only add if not already added?
                        // We are iterating X. If we find a run that started way back at -100, 
                        // and we are at startX (e.g. 0), we should add it.
                        // But if we encounter the SAME run at x+1, we shouldn't add it twice.
                        // Simple dedup: We only add if x == start OR x == startX (first visible block of run)

                        // Better: We found a run. We know its start and length.
                        // We can define the "ID" of this run by its start coord.
                        // We add it to hLabels.
                        hLabels.push({ x: start, z: z, len: length, type: 'h' });
                    }

                    // Optimization: Skip loop to end of *visible* part of this run?
                    // No, because we might have different materials interleaved (unlikely if contig run logic holds)
                    // If we found a run of length 10 starting at X, we know X+1..X+9 are same type.
                    // We can skip visibleX set.
                    const runEnd = start + length - 1;
                    visitedX = runEnd;
                }
                lastType = block.type;
            } else {
                lastType = null;
            }
        }
    }

    // Vertical Scanning
    // Note: Iterate X then Z is more cache friendly usually, but map structure is Y->X->Z.
    // So for Vertical (Iterate Z along fixed X), we pick an X and go down Z.
    for (let x = startX; x <= endX; x++) {
        if (!layer.has(x)) continue;
        const row = layer.get(x);

        let lastType = null;
        let visitedZ = -Infinity;

        for (let z = startZ; z <= endZ; z++) {
            if (z <= visitedZ) continue;

            let block = row.has(z) ? row.get(z) : null;
            if (block && state.hiddenMaterials.has(block.type)) block = null;

            if (block) {
                if (block.type !== lastType) {
                    const { length, start } = getRunLength(x, z, block.type, 'v');

                    if (state.zoom < 8 && length < 5) {
                        // skip
                    } else if (length > 2) {
                        vLabels.push({ x: x, z: start, len: length, type: 'v' });
                    }

                    // Skip ahead
                    const runEnd = start + length - 1;
                    visitedZ = runEnd;
                }
                lastType = block.type;
            } else {
                lastType = null;
            }
        }
    }

    // Deduplicate?
    // Our logic pushes a label for every 'segment start' encountered.
    // Since we skip 'visited', we generally won't duplicate within one frame for one axis.
    // However, hLabels might contain duplicates if we re-scanned? No, visual loop is linear.

    // Merging Logic (Keep existing Merged logic for stacked walls)
    // We just need to fit our new simple label objects into the merge function expectations.

    const mergeLabels = (labels, orient) => {
        if (labels.length === 0) return;
        if (orient === 'h') {
            labels.sort((a, b) => a.x - b.x || a.len - b.len || a.z - b.z);
        } else {
            labels.sort((a, b) => a.z - b.z || a.len - b.len || a.x - b.x);
        }

        let currentGroup = [labels[0]];

        for (let i = 1; i < labels.length; i++) {
            const prev = currentGroup[currentGroup.length - 1];
            const curr = labels[i];

            let isAdjacent = false;
            // Strict adjacency for merging stacking walls
            if (orient === 'h') {
                isAdjacent = (curr.x === prev.x && curr.len === prev.len && curr.z === prev.z + 1);
            } else {
                isAdjacent = (curr.z === prev.z && curr.len === prev.len && curr.x === prev.x + 1);
            }

            if (isAdjacent) {
                currentGroup.push(curr);
            } else {
                drawMergedLabel(currentGroup, orient);
                currentGroup = [curr];
            }
        }
        drawMergedLabel(currentGroup, orient);
    };

    mergeLabels(hLabels, 'h');
    mergeLabels(vLabels, 'v');
}

function drawMergedLabel(group, orient) {
    if (!group || group.length === 0) return;
    const first = group[0];
    const last = group[group.length - 1];

    let labelZ = (first.z + last.z) / 2;
    // For position x, we use the CENTER of the run.
    // first.x is the start block. len is length. Center is start + len/2 - 0.5
    let labelX = (orient === 'h') ? (first.x + first.len / 2 - 0.5) : first.x;

    if (orient === 'v') {
        labelX = (first.x + last.x) / 2;
        labelZ = first.z + first.len / 2 - 0.5;
    }

    // CLAMPING to Viewport
    // The calculated labelX/labelZ is the true center of the wall.
    // If the wall is huge, this center might be off-screen.
    // We want to draw the text at a visible position along the wall, closest to center?
    // Or just clamped to screen edges with padding.

    // Convert World Center to Screen Center
    let screenX = state.offsetX + (labelX * state.zoom) + (state.zoom / 2);
    let screenY = state.offsetZ + (labelZ * state.zoom) + (state.zoom / 2); // screenY corresponds to Z in world

    // Bounds for text clamping
    const margin = 50;

    // Logic: 
    // If Horizontal wall: screenY is fixed (row). screenX (column/length) can slide.
    // Valid ScreenX range for this wall: 
    // StartWorldX -> ScreenStart, EndWorldX -> ScreenEnd.

    if (orient === 'h') {
        const worldStart = first.x;
        const worldEnd = first.x + first.len;
        const sStart = state.offsetX + (worldStart * state.zoom);
        const sEnd = state.offsetX + (worldEnd * state.zoom);

        // Clamp screenX to be within [sStart, sEnd] AND within [0+margin, canvas.width-margin]
        // But strictly within the wall bounds is priority.

        const visibleMin = Math.max(sStart, margin);
        const visibleMax = Math.min(sEnd, canvas.width - margin);

        if (visibleMin < visibleMax) {
            // We have visible space. Center within that space? 
            // Or stick to true center if visible?
            // "Sticky" behavior: Keep true center if visible. If getting clipped, slide.
            screenX = Math.max(visibleMin, Math.min(screenX, visibleMax));
        } else {
            // Not visible enough? Or simple clamping.
            // If completely offscreen, we don't draw text anyway?
            // drawLabelText handles 'if' checks? No, we just pass coords.
            // However, if sEnd < 0 or sStart > width, we generally shouldn't draw.
            if (sEnd < 0 || sStart > canvas.width) return;
        }
    } else {
        // Vertical wall
        const worldStart = first.z;
        const worldEnd = first.z + first.len;
        const sStart = state.offsetZ + (worldStart * state.zoom);
        const sEnd = state.offsetZ + (worldEnd * state.zoom);

        const visibleMin = Math.max(sStart, margin);
        const visibleMax = Math.min(sEnd, canvas.height - margin);

        if (visibleMin < visibleMax) {
            screenY = Math.max(visibleMin, Math.min(screenY, visibleMax));
        } else {
            if (sEnd < 0 || sStart > canvas.height) return;
        }
    }

    // Inverse convert back to "label centered relative coords" for drawLabelText?
    // FIX: We need to pass BOTH the true World Center (for arrows) and the Screen Center (for text).
    // drawLabelText takes World Coords (cx, cz). 

    // We already have labelX, labelZ as true world centers.
    // And screenX, screenY as the sticky text position.

    drawLabelText(labelX, labelZ, first.len, orient, screenX, screenY);
}

function drawLabelText(cx, cz, length, orient, textSx, textSy) {
    // True World Center for Arrows
    const arrowSx = state.offsetX + (cx * state.zoom) + (state.zoom / 2);
    const arrowSy = state.offsetZ + (cz * state.zoom) + (state.zoom / 2);

    // Use sticky text position if provided, else default to arrow position
    const sx = textSx !== undefined ? textSx : arrowSx;
    const sy = textSy !== undefined ? textSy : arrowSy;

    // CAD Style Dimension Lines
    // If length > 3, draw arrows. If not, just text.
    if (length > 3) {
        ctx.save();
        ctx.strokeStyle = '#ffd700'; // Gold for dimensions
        ctx.lineWidth = 2; // Slightly thinner than text stroke
        ctx.beginPath();

        const halfLenPx = (length * state.zoom) / 2;
        const arrowSize = Math.min(6, state.zoom / 3);

        if (orient === 'h') {
            // Horizontal Line (Uses Arrow Position)
            ctx.moveTo(arrowSx - halfLenPx + 2, arrowSy);
            ctx.lineTo(arrowSx + halfLenPx - 2, arrowSy);

            // Arrows
            // Left Arrow
            ctx.moveTo(arrowSx - halfLenPx + 2 + arrowSize, arrowSy - arrowSize);
            ctx.lineTo(arrowSx - halfLenPx + 2, arrowSy);
            ctx.lineTo(arrowSx - halfLenPx + 2 + arrowSize, arrowSy + arrowSize);

            // Right Arrow
            ctx.moveTo(arrowSx + halfLenPx - 2 - arrowSize, arrowSy - arrowSize);
            ctx.lineTo(arrowSx + halfLenPx - 2, arrowSy);
            ctx.lineTo(arrowSx + halfLenPx - 2 - arrowSize, arrowSy + arrowSize);

        } else {
            // Vertical Line
            ctx.moveTo(arrowSx, arrowSy - halfLenPx + 2);
            ctx.lineTo(arrowSx, arrowSy + halfLenPx - 2);

            // Top Arrow
            ctx.moveTo(arrowSx - arrowSize, arrowSy - halfLenPx + 2 + arrowSize);
            ctx.lineTo(arrowSx, arrowSy - halfLenPx + 2);
            ctx.lineTo(arrowSx + arrowSize, arrowSy - halfLenPx + 2 + arrowSize);

            // Bottom Arrow
            ctx.moveTo(arrowSx - arrowSize, arrowSy + halfLenPx - 2 - arrowSize);
            ctx.lineTo(arrowSx, arrowSy + halfLenPx - 2);
            ctx.lineTo(arrowSx + arrowSize, arrowSy + halfLenPx - 2 - arrowSize);
        }
        ctx.stroke();
        ctx.restore();
    }

    // Text (uses Sticky Position sx, sy)
    ctx.fillStyle = '#ffffff'; // White text
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(`${length}`, sx, sy);
    ctx.fillText(`${length}`, sx, sy);
}

function updateSidebar(materials, count) {
    layerBlockCountDom.textContent = count;
    materialListDom.innerHTML = '';

    if (materials.size === 0) {
        materialListDom.innerHTML = '<div class="empty-state">No blocks on this layer</div>';
        return;
    }

    materials.forEach((qty, type) => {
        const item = document.createElement('div');
        item.className = 'material-item';

        // Add disabled class if hidden
        if (state.hiddenMaterials.has(type)) {
            item.classList.add('disabled');
        }

        const color = COLORS[type] || '#fff';

        item.innerHTML = `
            <div class="color-swatch" style="background-color: ${color}"></div>
            <span class="material-name">${formatName(type)}</span>
            <span class="material-count">${qty}</span>
        `;

        // Click listener to toggle visibility
        item.onclick = () => {
            if (state.hiddenMaterials.has(type)) {
                state.hiddenMaterials.delete(type);
            } else {
                state.hiddenMaterials.add(type);
            }
            render();
        };

        materialListDom.appendChild(item);
    });
}

function formatName(str) {
    return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// --- Interaction Logic ---
function setupControls() {
    // Zoom
    document.getElementById('zoom-in').onclick = () => {
        state.zoom = Math.min(state.zoom * 1.5, 40);
        render();
    };
    document.getElementById('zoom-out').onclick = () => {
        state.zoom = Math.max(state.zoom / 1.5, 1);
        render();
    };
    document.getElementById('reset-view').onclick = () => {
        state.zoom = 2;
        state.offsetX = canvas.width / 2;
        state.offsetZ = canvas.height / 2;
        render();
    };

    // Mouse Wheel Zoom (Zoom to Cursor)
    // Attach to parent to ensure capture
    canvas.parentElement.addEventListener('wheel', (e) => {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate world coordinates under mouse BEFORE zoom
        const worldX = (mouseX - state.offsetX) / state.zoom;
        const worldZ = (mouseY - state.offsetZ) / state.zoom;

        const zoomFactor = 1.1;
        let newZoom = state.zoom;

        if (e.deltaY < 0) {
            // Zoom In
            newZoom = Math.min(state.zoom * zoomFactor, 100);
        } else {
            // Zoom Out
            newZoom = Math.max(state.zoom / zoomFactor, 0.5);
        }

        state.zoom = newZoom;

        // Recalculate offset so that worldX/Z is still under mouseX/Y
        // mouseX = newOffsetX + (worldX * newZoom)
        // newOffsetX = mouseX - (worldX * newZoom)
        state.offsetX = mouseX - (worldX * state.zoom);
        state.offsetZ = mouseY - (worldZ * state.zoom);

        render();
    }, { passive: false });

    // Keyboard Navigation (Layers)
    window.addEventListener('keydown', (e) => {
        // Prevent scrolling with arrows
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }

        let delta = 0;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            delta = 1;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            delta = -1;
        }

        if (delta !== 0) {
            const current = parseInt(state.currentLayer) || 0;
            const next = Math.min(Math.max(current + delta, state.minY), state.maxY);
            // console.log(`Navigating Layer: ${current} -> ${next}`);
            updateLayer(next);
        }
    });

    // Legend
    const legendPanel = document.getElementById('legend-panel');
    const legendToggle = document.getElementById('legend-toggle');
    const closeLegend = document.getElementById('close-legend');

    const toggleLegend = () => {
        if (legendPanel.classList.contains('hidden')) {
            legendPanel.classList.remove('hidden');
        } else {
            legendPanel.classList.add('hidden');
        }
    };

    if (legendToggle) legendToggle.onclick = toggleLegend;
    if (closeLegend) closeLegend.onclick = toggleLegend;

    // Layer
    const updateLayer = (val) => {
        state.currentLayer = parseInt(val);
        layerSlider.value = state.currentLayer;
        layerInput.value = state.currentLayer;
        render();
    };

    layerSlider.oninput = (e) => updateLayer(e.target.value);
    layerInput.onchange = (e) => updateLayer(e.target.value);

    // Mouse Interaction (Pan & Hover)
    canvas.onmousedown = (e) => {
        state.isDragging = true;
        state.lastMouseX = e.clientX;
        state.lastMouseZ = e.clientY;
        canvas.style.cursor = 'grabbing';
    };

    window.onmouseup = () => {
        state.isDragging = false;
        canvas.style.cursor = 'grab';
    };

    canvas.onmousemove = (e) => {
        // Pan
        if (state.isDragging) {
            const dx = e.clientX - state.lastMouseX;
            const dy = e.clientY - state.lastMouseZ;
            state.offsetX += dx;
            state.offsetZ += dy;
            state.lastMouseX = e.clientX;
            state.lastMouseZ = e.clientY;
            render();
        }

        // Coordinates Hover
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Reverse transform
        // mx = offsetX + (worldX * zoom)  =>  worldX = (mx - offsetX) / zoom
        const worldX = Math.floor((mx - state.offsetX) / state.zoom);
        const worldZ = Math.floor((my - state.offsetZ) / state.zoom);

        coordX.textContent = worldX;
        coordZ.textContent = worldZ;
    };
}

// Move window.render assignment to after definition, or at least keep it here since functions are hoisted in module top level?
// In modules, function declarations *are* hoisted.
// But earlier the error was "render is not defined".
// This was likely due to the function BEGING MISSING.
// Re-adding assignment here for safety.
window.render = render;

// Start
init();
