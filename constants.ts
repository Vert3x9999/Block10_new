
import { ShapeDefinition, ChapterData, Souvenir, WorldData } from './types';

export const BOARD_SIZE = 10;

export const SHAPE_COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
];

// Tier 1: Basic shapes (1x1, 2x2, small lines, small L)
export const SHAPES_TIER_1: ShapeDefinition[] = [
  [[1]], // 1x1
  [[1, 1]], // 2h
  [[1], [1]], // 2v
  [[1, 1], [1, 1]], // 2x2 square
  [[1, 0], [1, 1]], // L small
  [[0, 1], [1, 1]], 
  [[1, 1], [1, 0]], 
  [[1, 1], [0, 1]], 
  [[1, 1, 1]], // 3h
  [[1], [1], [1]], // 3v
];

// Tier 2: Medium shapes (3x3 corners, 4-lines)
export const SHAPES_TIER_2: ShapeDefinition[] = [
  [[1, 1, 1, 1]], // 4h
  [[1], [1], [1], [1]], // 4v
  [[1, 1, 1], [1, 1, 1]], // 3x3 square
  [[1, 0, 0], [1, 0, 0], [1, 1, 1]], // Big L
  [[0, 0, 1], [0, 0, 1], [1, 1, 1]],
  [[1, 1, 1], [1, 0, 0], [1, 0, 0]],
  [[1, 1, 1], [0, 0, 1], [0, 0, 1]],
];

// Tier 3: Complex shapes (5-lines, T-shapes, Z-shapes, Diagonals)
export const SHAPES_TIER_3: ShapeDefinition[] = [
  [[1, 1, 1, 1, 1]], // 5h
  [[1], [1], [1], [1], [1]], // 5v
  // T-shapes
  [[1, 1, 1], [0, 1, 0]], 
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0], [1, 1], [1, 0]],
  [[0, 1], [1, 1], [0, 1]],
  // Z-shapes / S-shapes
  [[1, 1, 0], [0, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 0], [1, 1], [0, 1]],
  [[0, 1], [1, 1], [1, 0]],
];

export const SHAPES = [...SHAPES_TIER_1, ...SHAPES_TIER_2, ...SHAPES_TIER_3];

// --- Level Data ---

// Helper for Linear Interpolation
const lerp = (start: number, end: number, t: number) => {
  return Math.round(start + (end - start) * t);
};

const generateLevels = (
  chapterId: string,
  movesRange: [number, number], // [start, end]
  spmRange: [number, number],   // Score Per Move [start, end]
  startCoinValue: number
): any[] => {
  return Array.from({ length: 15 }, (_, i) => {
    // 0 to 1 progress factor through the chapter
    const t = i / 14; 

    // Moves decrease or stay steady (floored to avoid decimals)
    // Enforce a hard floor of 20 moves to prevent it becoming unplayable
    const rawMoves = lerp(movesRange[0], movesRange[1], t);
    const maxMoves = Math.max(20, rawMoves);

    // SPM increases as player gets better
    const spm = lerp(spmRange[0], spmRange[1], t);

    // Target Score = Moves * SPM
    // This ensures that even with fewer moves, the difficulty scales by efficiency required
    const targetScore = Math.round(maxMoves * spm);

    // Coin Reward: Base start value + 1 per level index
    const coinReward = startCoinValue + i;

    return {
      id: `${chapterId}-${i + 1}`,
      label: `${i + 1}`,
      targetScore: targetScore,
      maxMoves: maxMoves,
      coinReward: coinReward
    };
  });
};

export const CHAPTERS: ChapterData[] = [
  {
    id: 'ch1',
    title: 'Chapter 1: Genesis',
    description: 'The journey begins. Relax and enjoy.',
    souvenirId: 's_genesis_cube',
    // Moves: 50 -> 40 (Very Generous)
    // SPM: 50 -> 80 (Very Easy. Basic placement is enough to pass)
    levels: generateLevels('ch1', [50, 40], [50, 80], 10) 
  },
  {
    id: 'ch2',
    title: 'Chapter 2: Challenge',
    description: 'Tight spaces, but plenty of time.',
    souvenirId: 's_golden_compass',
    // Moves: 45 -> 35 (Standard+)
    // SPM: 100 -> 180 (Easy. Occasional line clears required)
    levels: generateLevels('ch2', [45, 35], [100, 180], 25) 
  },
  {
    id: 'ch3',
    title: 'Chapter 3: Ascension',
    description: 'Rise above. A smooth step up.',
    souvenirId: 's_crystal_prism',
    // Moves: 40 -> 30 (Normal)
    // SPM: 200 -> 350 (Moderate. consistent play required, but very achievable)
    levels: generateLevels('ch3', [40, 30], [200, 350], 40) 
  }
];

export const WORLDS: WorldData[] = [
  {
    id: 'world1',
    title: 'World 1: The Beginning',
    description: 'Where everything starts. Contains Chapter 1-3.',
    chapterIds: ['ch1', 'ch2', 'ch3']
  }
];

// --- Shop Data ---
export const SHOP_PRICES = {
  hints: 1000,
  undos: 1000,
  refreshes: 1000,
  rotators: 1000,
  revives: 10000
};

// --- Souvenirs ---

export const SOUVENIRS: Souvenir[] = [
  {
    id: 's_genesis_cube',
    name: 'Genesis Cube',
    description: 'A glowing cube representing your first steps into the grid.',
    icon: 'box',
    color: '#3b82f6' // blue
  },
  {
    id: 's_golden_compass',
    name: 'Golden Compass',
    description: 'For navigating the treacherous challenges of Chapter 2.',
    icon: 'compass',
    color: '#eab308' // yellow
  },
  {
    id: 's_crystal_prism',
    name: 'Crystal Prism',
    description: 'A prism that refracts light into infinite possibilities. Reward for Chapter 3.',
    icon: 'gem',
    color: '#a855f7' // purple
  },
  {
    id: 's_placeholder_4',
    name: 'Ancient Tablet',
    description: 'Coming soon...',
    icon: 'scroll',
    color: '#64748b'
  },
  {
    id: 's_placeholder_5',
    name: 'Star Fragment',
    description: 'Coming soon...',
    icon: 'star',
    color: '#ec4899'
  },
  {
    id: 's_placeholder_6',
    name: 'Void Key',
    description: 'Coming soon...',
    icon: 'key',
    color: '#0f172a'
  },
  {
    id: 's_placeholder_7',
    name: 'Time Hourglass',
    description: 'Coming soon...',
    icon: 'hourglass',
    color: '#f97316'
  },
  {
    id: 's_placeholder_8',
    name: 'Victory Cup',
    description: 'Coming soon...',
    icon: 'trophy',
    color: '#ef4444'
  },
  {
    id: 's_placeholder_9',
    name: 'Infinity Loop',
    description: 'Coming soon...',
    icon: 'infinity',
    color: '#22c55e'
  },
  {
    id: 's_placeholder_10',
    name: 'Master Crown',
    description: 'The ultimate symbol of mastery.',
    icon: 'crown',
    color: '#eab308'
  }
];
