import { generateMinasTirith, COLORS } from './generator.js';

// --- Global State ---
const state = {
    world: null, // Map<y, Map<x, Map<z, block>>>
    currentLayer: 70,
    minY: 0,
    maxY: 300,
    zoom: 2, // Pixels per block
    offsetX: 0,
    offsetZ: 0,
    isDragging: false,
    lastMouseX: 0,
    lastMouseZ: 0
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

// --- Initialization ---
function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Start Generation
    loadingOverlay.classList.remove('hidden');

    // Zero-timeout to let UI render loading state
    setTimeout(() => {
        state.world = generateMinasTirith();

        // Find Y Bounds
        const yLevels = Array.from(state.world.keys()).sort((a, b) => a - b);
        if (yLevels.length > 0) {
            state.minY = yLevels[0];
            state.maxY = yLevels[yLevels.length - 1] + 50; // Rendering buffer

            // Set slider bounds
            layerSlider.min = state.minY;
            layerSlider.max = state.maxY;

            // Set initial layer to something interesting if 70 is empty (though it shouldn't be)
            if (!state.world.has(70)) {
                state.currentLayer = yLevels[0];
            }
        }

        console.log(`Initialized. MinY: ${state.minY}, MaxY: ${state.maxY}, Current: ${state.currentLayer}`);
        loadingOverlay.classList.add('hidden');
        render();
    }, 50);

    setupControls();
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
                drawBlock(x, z, block.type);
                visibleBlocks.add(`${x},${z}`);

                // Stats
                blockCount++;
                materials.set(block.type, (materials.get(block.type) || 0) + 1);
            }
        }

        // PASS 2: Labels
        // Only run if zoom is high enough to read
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
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 2;

    // Viewport bounds for iteration
    const startX = Math.floor((-state.offsetX / state.zoom) - 2);
    const endX = Math.ceil(((canvas.width - state.offsetX) / state.zoom) + 2);
    const startZ = Math.floor((-state.offsetZ / state.zoom) - 2);
    const endZ = Math.ceil(((canvas.height - state.offsetZ) / state.zoom) + 2);

    // Horizontal Runs (scan z, then x)
    for (let z = startZ; z <= endZ; z++) {
        let runStart = null;
        let lastType = null;

        for (let x = startX; x <= endX + 1; x++) {
            // Get block safely
            let block = null;
            if (layer.has(x) && layer.get(x).has(z)) {
                block = layer.get(x).get(z);
            }

            if (block && (!runStart || block.type === lastType)) {
                // Continue run
                if (runStart === null) runStart = x;
                lastType = block.type;
            } else {
                // Break run
                if (runStart !== null) {
                    const len = x - runStart;
                    if (len > 1) { // Only label runs > 1
                        drawLabel(runStart, z, len, 'h');
                    }
                    runStart = null;
                }
                // If this is a new block, start new run
                if (block) {
                    runStart = x;
                    lastType = block.type;
                }
            }
        }
    }

    // Vertical Runs
    // (Optimization needed: Avoid double labeling? For now, just label > 2 vertical too)
    // To scan vertically efficiently we need a better structure or just query

    for (let x = startX; x <= endX; x++) {
        if (!layer.has(x)) continue;
        const col = layer.get(x);

        let runStart = null;
        let lastType = null;

        for (let z = startZ; z <= endZ + 1; z++) {
            let block = col.has(z) ? col.get(z) : null;

            if (block && (!runStart || block.type === lastType)) {
                if (runStart === null) runStart = z;
                lastType = block.type;
            } else {
                if (runStart !== null) {
                    const len = z - runStart;
                    if (len > 1) {
                        drawLabel(x, runStart, len, 'v');
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
}

function drawLabel(startCoord, otherCoord, length, orient) {
    if (length < 2) return;

    // Calculate center of run
    let cx, cz;
    if (orient === 'h') {
        // startCoord is X, other is Z
        cx = startCoord + (length / 2) - 0.5; // -0.5 to center on boundary?? No. 
        // Blocks at 0 and 1. Center is 1. 0.5 + 0.5 = 1.0
        // Correct is (start + end)/2. End is start + length - 1.
        // (start + start + length - 1) / 2 = start + length/2 - 0.5
        cx = startCoord + (length / 2) - 0.5;
        cz = otherCoord;
    } else {
        cx = otherCoord;
        cz = startCoord + (length / 2) - 0.5;
    }

    const screenX = state.offsetX + (cx * state.zoom) + (state.zoom / 2);
    const screenY = state.offsetZ + (cz * state.zoom) + (state.zoom / 2);

    ctx.fillText(`${length}`, screenX, screenY);
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
        const color = COLORS[type] || '#fff';

        item.innerHTML = `
            <div class="color-swatch" style="background-color: ${color}"></div>
            <span class="material-name">${formatName(type)}</span>
            <span class="material-count">${qty}</span>
        `;
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
