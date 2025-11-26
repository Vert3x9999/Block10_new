
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
  movesLeft: number; // Snapshot for Undo
}

// --- Level Mode Types ---

export interface LevelConfig {
  id: string;
  label: string;
  targetScore: number; // Score needed for 1 Crown (Pass)
  maxMoves: number;    // Turn limit
}

export interface ChapterData {
  id: string;
  title: string;
  description: string;
  levels: LevelConfig[];
  souvenirId: string; // The ID of the souvenir unlocked by completing this chapter
}

export interface LevelProgress {
  [levelId: string]: number; // number of crowns
}

// --- Inventory & Meta Types ---

export interface Inventory {
  hints: number;
  undos: number;
  refreshes: number;
}

export interface Souvenir {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name or simple string identifier
  color: string;
}
