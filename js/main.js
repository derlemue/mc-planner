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

    // Draw Grid & Background Checkerboard
    drawGrid();

    // Reset collision buffer for this frame
    state.labelBounds = [];

    // Render Blocks
    if (!state.world) return;

    const layer = state.world.get(parseInt(state.currentLayer)); // Ensure int
    const materials = new Map();
    let blockCount = 0;

    const visibleBlocks = new Set(); // Strings "x,z"

    if (layer) {
        for (const [x, row] of layer) {
            for (const [z, block] of row) {
                // Collect Stats
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
        if (state.zoom > 4) {
            drawLabels(layer);
        }

    }

    updateSidebar(materials, blockCount);
}

function drawGrid() {
    const gridSize = state.zoom;
    const startX = Math.floor(-state.offsetX / state.zoom);
    const endX = Math.ceil((canvas.width - state.offsetX) / state.zoom);
    const startZ = Math.floor(-state.offsetZ / state.zoom);
    const endZ = Math.ceil((canvas.height - state.offsetZ) / state.zoom);

    ctx.lineWidth = 1;

    // Checkerboard Background Pattern
    // We draw this first so it sits behind the grid lines and blocks
    if (state.zoom > 5) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        for (let x = startX; x <= endX; x++) {
            for (let z = startZ; z <= endZ; z++) {
                if ((Math.abs(x) + Math.abs(z)) % 2 !== 0) {
                    const screenX = state.offsetX + (x * gridSize);
                    const screenY = state.offsetZ + (z * gridSize);
                    ctx.fillRect(Math.floor(screenX), Math.floor(screenY), Math.ceil(gridSize), Math.ceil(gridSize));
                }
            }
        }
    }

    // Grid Lines
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
}

function drawLabels(layer) {
    if (state.zoom <= 4) return;

    ctx.font = `bold ${Math.max(10, state.zoom * 0.6)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    const padding = 2;
    const startX = Math.floor((-state.offsetX / state.zoom) - padding);
    const endX = Math.ceil(((canvas.width - state.offsetX) / state.zoom) + padding);
    const startZ = Math.floor((-state.offsetZ / state.zoom) - padding);
    const endZ = Math.ceil(((canvas.height - state.offsetZ) / state.zoom) + padding);

    const hLabels = [];
    const vLabels = [];

    const getRunLength = (x, z, type, dir) => {
        let length = 1;
        // Scan Backwards
        let scan = (dir === 'h') ? x - 1 : z - 1;
        while (true) {
            const mapX = (dir === 'h') ? scan : x;
            const mapZ = (dir === 'h') ? z : scan;
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
        const runStart = scan + 1;

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
        return { length, start: runStart };
    };

    // Horizontal Scanning
    for (let z = startZ; z <= endZ; z++) {
        let lastType = null;
        let visitedX = -Infinity;

        for (let x = startX; x <= endX; x++) {
            if (x <= visitedX) continue;
            let block = null;
            if (layer.has(x) && layer.get(x).has(z)) {
                block = layer.get(x).get(z);
                if (state.hiddenMaterials.has(block.type)) block = null;
            }

            if (block) {
                if (block.type !== lastType) {
                    const { length, start } = getRunLength(x, z, block.type, 'h');
                    if (state.zoom < 8 && length < 5) {
                    } else if (length > 2) {
                        hLabels.push({ x: start, z: z, len: length, type: 'h' });
                    }
                    visitedX = start + length - 1;
                }
                lastType = block.type;
            } else {
                lastType = null;
            }
        }
    }

    // Vertical Scanning
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
                    } else if (length > 2) {
                        vLabels.push({ x: x, z: start, len: length, type: 'v' });
                    }
                    visitedZ = start + length - 1;
                }
                lastType = block.type;
            } else {
                lastType = null;
            }
        }
    }

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
    // first.x is the start block. len is length. Center is start + len/2 - 0.5
    let labelX = (orient === 'h') ? (first.x + first.len / 2 - 0.5) : first.x;

    if (orient === 'v') {
        labelX = (first.x + last.x) / 2;
        labelZ = first.z + first.len / 2 - 0.5;
    }

    // Convert World Center to Screen Center (NO CLAMPING/SLIDING)
    let screenX = state.offsetX + (labelX * state.zoom) + (state.zoom / 2);
    let screenY = state.offsetZ + (labelZ * state.zoom) + (state.zoom / 2);

    drawLabelText(labelX, labelZ, first.len, orient, screenX, screenY);
}

function drawLabelText(cx, cz, length, orient, sx, sy) {
    // Check collision
    // Estimate text width/height
    const fontSize = Math.max(10, state.zoom * 0.6);
    const text = `${length}`;
    const textWidth = ctx.measureText(text).width;
    // Rough box size (text + padding)
    const boxW = textWidth + 10;
    const boxH = fontSize + 4;

    // Bounds: [x, y, w, h] - Centered at sx, sy
    const bounds = {
        x: sx - boxW / 2,
        y: sy - boxH / 2,
        w: boxW,
        h: boxH
    };

    // Simple AABB Collision
    for (const b of state.labelBounds) {
        if (bounds.x < b.x + b.w &&
            bounds.x + bounds.w > b.x &&
            bounds.y < b.y + b.h &&
            bounds.y + bounds.h > b.y) {
            // Collision detected - Skip this label
            return;
        }
    }

    // No collision: Draw and Store
    state.labelBounds.push(bounds);

    if (length > 3) {
        ctx.save();
        ctx.strokeStyle = '#ffd700'; // Gold for dimensions
        ctx.lineWidth = 2;
        ctx.beginPath();

        const halfLenPx = (length * state.zoom) / 2;
        const arrowSize = Math.min(6, state.zoom / 3);

        // Arrow drawing uses the same center point as text now (fixed)
        const arrowSx = sx;
        const arrowSy = sy;

        if (orient === 'h') {
            ctx.moveTo(arrowSx - halfLenPx + 2, arrowSy);
            ctx.lineTo(arrowSx + halfLenPx - 2, arrowSy);
            // Arrows
            ctx.moveTo(arrowSx - halfLenPx + 2 + arrowSize, arrowSy - arrowSize);
            ctx.lineTo(arrowSx - halfLenPx + 2, arrowSy);
            ctx.lineTo(arrowSx - halfLenPx + 2 + arrowSize, arrowSy + arrowSize);
            ctx.moveTo(arrowSx + halfLenPx - 2 - arrowSize, arrowSy - arrowSize);
            ctx.lineTo(arrowSx + halfLenPx - 2, arrowSy);
            ctx.lineTo(arrowSx + halfLenPx - 2 - arrowSize, arrowSy + arrowSize);
        } else {
            ctx.moveTo(arrowSx, arrowSy - halfLenPx + 2);
            ctx.lineTo(arrowSx, arrowSy + halfLenPx - 2);
            // Arrows
            ctx.moveTo(arrowSx - arrowSize, arrowSy - halfLenPx + 2 + arrowSize);
            ctx.lineTo(arrowSx, arrowSy - halfLenPx + 2);
            ctx.lineTo(arrowSx + arrowSize, arrowSy - halfLenPx + 2 + arrowSize);
            ctx.moveTo(arrowSx - arrowSize, arrowSy + halfLenPx - 2 - arrowSize);
            ctx.lineTo(arrowSx, arrowSy + halfLenPx - 2);
            ctx.lineTo(arrowSx + arrowSize, arrowSy + halfLenPx - 2 - arrowSize);
        }
        ctx.stroke();
        ctx.restore();
    }

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(text, sx, sy);
    ctx.fillText(text, sx, sy);
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
