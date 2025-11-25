
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
