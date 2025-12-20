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

// Start
init();
