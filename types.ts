
export type CellState = string | null; // null = empty, string = color hex
export type GridType = CellState[][];

export type ShapeDefinition = number[][]; // 1 for block, 0 for empty

export interface ShapeObj {
  id: string;
  matrix: ShapeDefinition;
  color: string;
}

export interface Position {
  r: number;
  c: number;
}

export interface GameState {
  grid: GridType;
  score: number;
  availableShapes: ShapeObj[];
  isGameOver: boolean;
  comboCount: number;
}

// --- Level Mode Types ---

export interface LevelConfig {
  id: string;
  label: string;
  targetScore: number; // Score needed for 1 Crown (Pass)
}

export interface ChapterData {
  id: string;
  title: string;
  description: string;
  levels: LevelConfig[];
}

export interface LevelProgress {
  [levelId: string]: number; // number of crowns (0 = locked/unplayed if logic dictates, though 0 usually means played but failed or just unplayed. We'll use existence key for unlocked)
}
