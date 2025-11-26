
import { ShapeDefinition, ChapterData, Souvenir } from './types';

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

const generateLevels = (
  chapterId: string, 
  baseScore: number, 
  scoreIncrement: number, 
  baseMoves: number, 
  moveDecrement: number,
  startGlobalIndex: number,
  startCoinValue: number
): any[] => {
  return Array.from({ length: 15 }, (_, i) => {
    // Coin Reward: Base start value + 1 per level index
    // Ch1: 10, 11, 12... 24
    // Ch2: 25, 26, 27... 39
    const coinReward = startCoinValue + i;

    return {
      id: `${chapterId}-${i + 1}`,
      label: `${i + 1}`,
      targetScore: baseScore + (i * scoreIncrement),
      // Decrease moves slightly as levels get harder, but keep a floor
      maxMoves: Math.max(15, baseMoves - Math.floor(i * moveDecrement)),
      coinReward: coinReward
    };
  });
};

export const CHAPTERS: ChapterData[] = [
  {
    id: 'ch1',
    title: 'Chapter 1: Genesis',
    description: 'The journey begins. Master the basics.',
    souvenirId: 's_genesis_cube',
    levels: generateLevels('ch1', 1000, 300, 40, 0.5, 0, 10) // Coins 10-24
  },
  {
    id: 'ch2',
    title: 'Chapter 2: Challenge',
    description: 'Tight spaces, limited moves.',
    souvenirId: 's_golden_compass',
    levels: generateLevels('ch2', 5000, 1000, 30, 0.8, 15, 25) // Coins 25-39
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
    id: 's_placeholder_3',
    name: 'Crystal Prism',
    description: 'Coming soon in Chapter 3...',
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
