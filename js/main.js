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
window.render = render;

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
function init() {
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
    // Basic Run-Length Labeling
    // We scan visible Horizontal rows and Vertical columns

    ctx.font = `bold ${Math.max(10, state.zoom * 0.6)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round'; // Smooth corners
    // No shadow needed if we stroke

    // Viewport bounds for iteration (Increased padding)
    const startX = Math.floor((-state.offsetX / state.zoom) - 5);
    const endX = Math.ceil(((canvas.width - state.offsetX) / state.zoom) + 5);
    const startZ = Math.floor((-state.offsetZ / state.zoom) - 5);
    const endZ = Math.ceil(((canvas.height - state.offsetZ) / state.zoom) + 5);

    // Unified Label Storage
    const hLabels = [];
    const vLabels = [];

    // Horizontal Scanning
    for (let z = startZ; z <= endZ; z++) {
        let runStart = null;
        let lastType = null;
        for (let x = startX; x <= endX + 1; x++) {
            let block = null;
            if (layer.has(x) && layer.get(x).has(z)) {
                block = layer.get(x).get(z);
                // SKIP HIDDEN MATERIALS in Labeling
                if (state.hiddenMaterials.has(block.type)) {
                    block = null; // Treat as empty space
                }
            }
            if (block && (!runStart || block.type === lastType)) {
                if (runStart === null) runStart = x;
                lastType = block.type;
            } else {
                if (runStart !== null) {
                    const len = x - runStart;
                    if (len > 2) {
                        hLabels.push({ x: runStart, z: z, len: len, type: 'h' });
                    }
                    runStart = null;
                }
                if (block) {
                    runStart = x;
                    lastType = block.type;
                }
            }
        }
    }

    // Vertical Scanning
    for (let x = startX; x <= endX; x++) {
        if (!layer.has(x)) continue;
        const col = layer.get(x);
        let runStart = null;
        let lastType = null;
        for (let z = startZ; z <= endZ + 1; z++) {
            let block = col.has(z) ? col.get(z) : null;
            if (block && state.hiddenMaterials.has(block.type)) {
                block = null; // Treat as empty
            }

            if (block && (!runStart || block.type === lastType)) {
                if (runStart === null) runStart = z;
                lastType = block.type;
            } else {
                if (runStart !== null) {
                    const len = z - runStart;
                    if (len > 2) {
                        vLabels.push({ x: x, z: runStart, len: len, type: 'v' });
                    }
                    runStart = null;
                }
                if (block) {
                    runStart = z;
                    lastType = block.type;
                }
            }
        }
    }

    // Merging Logic
    // We merge H-labels that are stacked vertically (same x, same len, adjacent z)
    const mergeLabels = (labels, orient) => {
        if (labels.length === 0) return;
        // Sort: primary by secondary-coord, then by primary-coord
        // For H (vary Z): sort by X, then Len, then Z
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

    // Pick the "middle" item's coordinates
    // If H-run: x is same, z varies. Center Z = (first.z + last.z) / 2
    let labelZ = (first.z + last.z) / 2;
    let labelX = (orient === 'h') ? (first.x + first.len / 2 - 0.5) : first.x;

    if (orient === 'v') {
        labelX = (first.x + last.x) / 2;
        labelZ = first.z + first.len / 2 - 0.5;
    }

    // Only draw if the width of the group (ortho to run) is small OR if we are in the middle of a huge block.
    // If we have a 27x27 block, we have one group of 27 H-labels and one group of 27 V-labels.
    // Both will try to draw a "27" in the exact center.
    // This results in two "27"s on top of each other. That's fine, looks like one bold 27.

    drawLabelText(labelX, labelZ, first.len, orient);
}

function drawLabelText(cx, cz, length, orient) {
    const screenX = state.offsetX + (cx * state.zoom) + (state.zoom / 2); // Center of block
    // Actually cx is already centered? 
    // Wait, in previous code: cx = start + len/2 - 0.5. 
    // ScreenX = offset + cx*zoom + zoom/2.
    // If cx is 0.5 (center of 0 and 1), screenX = off + 0.5*z + 0.5*z = off + z. Correct.

    // Check our cx calculation above.
    // H-run: labelX = startX + len/2 - 0.5. Correct.

    const sx = state.offsetX + (cx * state.zoom) + (state.zoom / 2);
    const sy = state.offsetZ + (cz * state.zoom) + (state.zoom / 2);

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
            // Horizontal Line
            ctx.moveTo(sx - halfLenPx + 2, sy);
            ctx.lineTo(sx + halfLenPx - 2, sy);

            // Arrows
            // Left Arrow
            ctx.moveTo(sx - halfLenPx + 2 + arrowSize, sy - arrowSize);
            ctx.lineTo(sx - halfLenPx + 2, sy);
            ctx.lineTo(sx - halfLenPx + 2 + arrowSize, sy + arrowSize);

            // Right Arrow
            ctx.moveTo(sx + halfLenPx - 2 - arrowSize, sy - arrowSize);
            ctx.lineTo(sx + halfLenPx - 2, sy);
            ctx.lineTo(sx + halfLenPx - 2 - arrowSize, sy + arrowSize);

        } else {
            // Vertical Line
            ctx.moveTo(sx, sy - halfLenPx + 2);
            ctx.lineTo(sx, sy + halfLenPx - 2);

            // Top Arrow
            ctx.moveTo(sx - arrowSize, sy - halfLenPx + 2 + arrowSize);
            ctx.lineTo(sx, sy - halfLenPx + 2);
            ctx.lineTo(sx + arrowSize, sy - halfLenPx + 2 + arrowSize);

            // Bottom Arrow
            ctx.moveTo(sx - arrowSize, sy + halfLenPx - 2 - arrowSize);
            ctx.lineTo(sx, sy + halfLenPx - 2);
            ctx.lineTo(sx + arrowSize, sy + halfLenPx - 2 - arrowSize);
        }
        ctx.stroke();
        ctx.restore();
    }

    // Text (with background box for readability over lines)
    // Actually, just stroke is enough if line is thin.
    // Or clear rect behind text?
    // Let's rely on the thick black stroke of the text.

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

    // Mouse Wheel Zoom
    // Attach to parent to ensure we catch it even if canvas has issues
    canvas.parentElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        if (e.deltaY < 0) {
            // Zoom In
            state.zoom = Math.min(state.zoom * zoomFactor, 40);
        } else {
            // Zoom Out
            state.zoom = Math.max(state.zoom / zoomFactor, 1);
        }
        render();
    }, { passive: false });

    // Keyboard Navigation (Layers)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
            // Layer Up
            const next = Math.min(state.currentLayer + 1, state.maxY);
            updateLayer(next);
        } else if (e.key === 'ArrowLeft') {
            // Layer Down
            const prev = Math.max(state.currentLayer - 1, state.minY);
            updateLayer(prev);
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

// Start
init();
