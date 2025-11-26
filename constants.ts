
import { ShapeDefinition, ChapterData } from './types';

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

const generateLevels = (chapterId: string, baseScore: number, increment: number): any[] => {
  return Array.from({ length: 15 }, (_, i) => ({
    id: `${chapterId}-${i + 1}`,
    label: `${i + 1}`,
    targetScore: baseScore + (i * increment)
  }));
};

export const CHAPTERS: ChapterData[] = [
  {
    id: 'ch1',
    title: 'Chapter 1: Genesis',
    description: 'The journey begins. Master the basics.',
    levels: generateLevels('ch1', 1000, 500) // Level 1: 1000, Level 15: 8000
  },
  {
    id: 'ch2',
    title: 'Chapter 2: Challenge',
    description: 'Higher stakes, higher rewards.',
    levels: generateLevels('ch2', 10000, 1500) // Level 1: 10000, Level 15: 31000
  }
];
