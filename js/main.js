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
        }

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
    render();
}

function render() {
    // Clear
    ctx.fillStyle = '#020617'; // Match bg
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Grid (Background)
    drawGrid();

    // Render Blocks
    if (!state.world) return;

    const layer = state.world.get(state.currentLayer);
    const materials = new Map();
    let blockCount = 0;

    if (layer) {
        // Optimization: Iterate blocks
        // Map<x, Map<z, block>>
        for (const [x, row] of layer) {
            for (const [z, block] of row) {
                drawBlock(x, z, block.type);

                // Stats
                blockCount++;
                materials.set(block.type, (materials.get(block.type) || 0) + 1);
            }
        }
    }

    // Draw Ghost/Lower layers for context? (Optional, maybe too messy)
    // For now strict slicing is cleaner for blueprints.

    updateSidebar(materials, blockCount);
}

function drawGrid() {
    const gridSize = 10 * state.zoom;
    const offsetX = state.offsetX % gridSize;
    const offsetZ = state.offsetZ % gridSize;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = offsetX; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    // Horizontal lines
    for (let z = offsetZ; z < canvas.height; z += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, z);
        ctx.lineTo(canvas.width, z);
        ctx.stroke();
    }

    // Center Axes
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    // Z Axis (Vertical on screen)
    ctx.beginPath();
    ctx.moveTo(state.offsetX, 0);
    ctx.lineTo(state.offsetX, canvas.height);
    ctx.stroke();
    // X Axis (Horizontal on screen)
    ctx.beginPath();
    ctx.moveTo(0, state.offsetZ);
    ctx.lineTo(canvas.width, state.offsetZ);
    ctx.stroke();
}

function drawBlock(x, z, type) {
    const size = state.zoom;
    // Transform coordinates:
    // World X -> Screen X
    // World Z -> Screen Y (Canvas coords)

    const screenX = state.offsetX + (x * size);
    const screenY = state.offsetZ + (z * size);

    // Culling
    if (screenX < -size || screenX > canvas.width || screenY < -size || screenY > canvas.height) return;

    const color = COLORS[type] || '#ff00ff';
    ctx.fillStyle = color;

    // Fill
    ctx.fillRect(Math.floor(screenX), Math.floor(screenY), Math.ceil(size), Math.ceil(size));
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
