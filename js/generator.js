/**
 * Minas Tirith Procedural Generator
 * Generates a voxel-like data structure for the city.
 * 
 * Data Structure:
 * Map<y, Map<x, Map<z, {type: string, meta: number}>>>
 */

export const COLORS = {
    'stone_brick': '#787878',
    'white_concrete': '#eeeeee',
    'grass_block': '#5b8c47',
    'stone': '#606060',
    'dirt': '#795548',
    'wood': '#8d6e63',
    'water': '#4fc3f7',
    'gold_block': '#ffd700',
    'wall_outline': '#b0bec5',
    'iron_block': '#e0e0e0',
    'cobblestone': '#505050',
    'obsidian': '#1a1a1a'
};

export function generateMinasTirith() {
    console.time('Generation');
    console.log('Starting generation...');
    const world = new Map(); // Y -> X -> Z -> Block
    let totalBlocks = 0;

    const setBlock = (x, y, z, blockType) => {
        // Simple optimization: don't store air
        if (!blockType) return;

        if (!world.has(y)) world.set(y, new Map());
        const layer = world.get(y);

        if (!layer.has(x)) layer.set(x, new Map());
        const row = layer.get(x);

        row.set(z, { type: blockType });
        totalBlocks++;
    };

    // --- CONFIGURATION ---
    const TOTAL_LEVELS = 7;
    const CENTER_X = 0;
    const CENTER_Z = 0;
    const BASE_Y = 64;

    // Radii for the 7 levels (outermost to innermost)
    const TIER_RADII = [280, 230, 185, 145, 110, 80, 45];
    const TIER_HEIGHTS = [15, 15, 15, 15, 15, 15, 60]; // How tall each wall/cliff is
    const FLOOR_THICKNESS = 1;

    // The "Prow" (Keel) configuration
    const PROW_WIDTH_START = 40;
    const PROW_EXTENSION = 320; // How far out it goes

    let currentY = BASE_Y;

    // --- GENERATION LOOP ---

    // 0. Base Terrain (Circle)
    const baseRadius = TIER_RADII[0] + 50;
    for (let x = -baseRadius; x <= baseRadius; x++) {
        for (let z = -baseRadius; z <= baseRadius; z++) {
            const dist = Math.sqrt(x * x + z * z);
            if (dist <= baseRadius) {
                // Slight noisy terrain variance could go here, for now flat
                setBlock(x, 63, z, 'grass_block');
            }
        }
    }

    // Generate Tiers
    for (let t = 0; t < TOTAL_LEVELS; t++) {
        const outerRadius = TIER_RADII[t];
        const innerRadius = (t < TOTAL_LEVELS - 1) ? TIER_RADII[t + 1] : 0;
        const tierHeight = TIER_HEIGHTS[t];
        const wallHeight = 8; // Height of the wall itself above the tier floor

        // 1. Build the Tier Floor (Grass/Roads)
        // Everything inside outerRadius at this level

        for (let x = -outerRadius; x <= outerRadius; x++) {
            for (let z = -outerRadius; z <= outerRadius; z++) {
                const dist = Math.sqrt(x * x + z * z);

                // Prow Checking (The wedge facing East)
                // Assume +X is East. The prow is a wedge usually.
                // Simplified: A rectangle/triangle protruding on +X axis
                const isProw = (x > 0 && Math.abs(z) < (PROW_WIDTH_START * (1 - x / PROW_EXTENSION) + 10)); // Tapering

                if (dist <= outerRadius) {

                    // Don't fill if inside the NEXT tier (unless it's the solid rock foundation of that tier)
                    // Actually, we construct solid cylinders going UP.

                    // But for the "Floor" of THIS tier (t):
                    // It exists between outerRadius and innerRadius.
                    if (dist > innerRadius) {
                        // This is the walkable area of the tier
                        // Fill with Grass
                        setBlock(x, currentY, z, 'grass_block');

                        // Add a road ring?
                        if (dist > (outerRadius - 6) && dist < (outerRadius - 1)) {
                            setBlock(x, currentY, z, 'stone'); // Road
                        }
                    } else {
                        // Inside innerRadius: This is the foundation for the NEXT tier up
                        // Fill with solid rock up to next level
                        // We'll handle this vertical fill in a moment
                    }
                }
            }
        }

        // 2. Build Walls (The outer rim of this tier)
        for (let x = -outerRadius; x <= outerRadius; x++) {
            for (let z = -outerRadius; z <= outerRadius; z++) {
                const dist = Math.sqrt(x * x + z * z);

                // Wall is roughly at outerRadius
                if (dist <= outerRadius && dist > outerRadius - 3) {
                    // Build Wall upwards
                    for (let h = 0; h < wallHeight; h++) {
                        // Skip Prow section for lower walls (it cuts through)
                        const isProw = (x > 0 && Math.abs(z) < 20); // Simplified Prow check for walls
                        if (!isProw || t === 6) { // Top level has wall all around? Or Prow ends?
                            setBlock(x, currentY + h, z, 'white_concrete');
                        }
                    }
                }
            }
        }

        // 3. Build the CLIFF/FOUNDATION for the NEXT level
        // (If not the top level)
        if (t < TOTAL_LEVELS - 1) {
            const nextRadius = TIER_RADII[t + 1];
            const foundationHeight = tierHeight; // Height to reach next floor

            for (let x = -nextRadius; x <= nextRadius; x++) {
                for (let z = -nextRadius; z <= nextRadius; z++) {
                    const dist = Math.sqrt(x * x + z * z);
                    if (dist <= nextRadius) {
                        // Fill vertical space
                        // Optimization: Hollow out inside if strict performance needed, 
                        // but for blueprint we might want solid to show where to build.
                        // Let's just build the outer shell of the cliff to save memory/processing
                        if (dist > nextRadius - 2) {
                            // Outer shell of cliff
                            for (let h = 1; h <= foundationHeight; h++) {
                                setBlock(x, currentY + h, z, 'stone');
                            }
                        } else {
                            // Internal filler (optional, maybe just show every 5th layer?)
                            // For a blueprint, seeing the "solid" nature at every level is good.
                            // Let's do a top cap only for the next level?
                            // No, the slicer needs to see it at y + h.
                            for (let h = 1; h <= foundationHeight; h++) {
                                // Prow Check for the cliff 
                                // The prow actually STICKS OUT and forms the cliff face on the East
                                const isProw = (x > 0 && Math.abs(z) < 15);
                                if (isProw) {
                                    setBlock(x, currentY + h, z, 'white_concrete'); // Prow is white stone/structure
                                } else {
                                    // Standard cliff
                                    // Optimization: Only draw boundary or pattern
                                    if ((x % 10 === 0 && z % 10 === 0) || dist > nextRadius - 3) { // Grid support pattern
                                        setBlock(x, currentY + h, z, 'stone');
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        currentY += tierHeight; // Move up for next iteration
    }

    // 4. The White Tower (Ecthelion)
    // At the very top (currentY is now at the top of 7th tier)
    const towerRadius = 15;
    const towerHeight = 100;

    for (let h = 0; h < towerHeight; h++) {
        for (let x = -towerRadius; x <= towerRadius; x++) {
            for (let z = -towerRadius; z <= towerRadius; z++) {
                const dist = Math.sqrt(x * x + z * z);
                if (dist <= towerRadius && dist > towerRadius - 2) {
                    setBlock(x, currentY + h, z, 'white_concrete');
                }
                // Central pillar
                if (dist < 3) setBlock(x, currentY + h, z, 'stone');
            }
        }
    }

    console.log(`Generation complete. Total blocks: ${totalBlocks}`);
    console.timeEnd('Generation');
    return world;
}

export function generateEiffelTower() {
    console.time('Generation-Eiffel');
    console.log('Generating Eiffel Tower (Refined)...');
    const world = new Map();
    let totalBlocks = 0;

    const setBlock = (x, y, z, blockType) => {
        if (!blockType) return;
        if (!world.has(y)) world.set(y, new Map());
        const layer = world.get(y);
        if (!layer.has(x)) layer.set(x, new Map());
        const row = layer.get(x);
        row.set(z, { type: blockType });
        totalBlocks++;
    };

    // Constants
    const CENTER_Y = 64;
    const TOWER_HEIGHT = 250;

    for (let y = 0; y <= TOWER_HEIGHT + 20; y++) {
        const absY = CENTER_Y + y;
        const progress = y / TOWER_HEIGHT;

        // --- Antenna (Top) ---
        if (y > TOWER_HEIGHT) {
            const antennaWidth = (y > TOWER_HEIGHT + 15) ? 0 : 1;
            for (let x = -antennaWidth; x <= antennaWidth; x++) {
                for (let z = -antennaWidth; z <= antennaWidth; z++) {
                    setBlock(x, absY, z, 'iron_block');
                }
            }
            continue;
        }

        // --- Main Curve (Exponential) ---
        // Width decreases as we go up
        const w = 36 * Math.pow((1 - progress), 1.8) + 2;

        // --- Platforms ---
        // 1st Floor (~57m), 2nd Floor (~115m), 3rd Floor (Top)
        const isPlatform1 = (y >= 55 && y <= 58);
        const isPlatform2 = (y >= 113 && y <= 116);
        const isTopPlatform = (y >= TOWER_HEIGHT - 5 && y <= TOWER_HEIGHT);

        if (isPlatform1 || isPlatform2 || isTopPlatform) {
            const platW = Math.ceil(w + (isTopPlatform ? 4 : 6));
            const type = isTopPlatform ? 'wall_outline' : 'stone_brick'; // Use existing keys

            for (let x = -platW; x <= platW; x++) {
                for (let z = -platW; z <= platW; z++) {
                    const d = Math.max(Math.abs(x), Math.abs(z));
                    if (d <= platW) {
                        // Floor
                        if (d === platW && (x + z) % 2 === 0) {
                            setBlock(x, absY, z, 'stone'); // Railing substitute
                        } else {
                            setBlock(x, absY, z, type);
                        }
                    }
                }
            }
            continue;
        }

        // --- Legs / Lattice ---
        // 4 Legs at bottom, merging into one spire
        const legOffset = w * 0.85;
        const legThickness = Math.max(1, 4 * (1 - progress));

        const isMerged = y > 130;

        const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        dirs.forEach(([dx, dz]) => {
            const cx = (isMerged ? 0 : dx * legOffset);
            const cz = (isMerged ? 0 : dz * legOffset);

            for (let lx = -legThickness; lx <= legThickness; lx++) {
                for (let lz = -legThickness; lz <= legThickness; lz++) {
                    const finalX = Math.round(cx + lx);
                    const finalZ = Math.round(cz + lz);

                    const isEdge = (Math.abs(lx) >= legThickness - 1 || Math.abs(lz) >= legThickness - 1);
                    const isBrace = ((absY % 6) === 0 || (finalX + finalZ) % 4 === 0);

                    if (isEdge || isBrace) {
                        const mat = (y < 50) ? 'stone' : 'stone_brick';
                        setBlock(finalX, absY, finalZ, mat);
                    }
                }
            }
        });
    }

    console.log(`Generation complete. Total blocks: ${totalBlocks}`);
    console.timeEnd('Generation-Eiffel');
    return world;
}
