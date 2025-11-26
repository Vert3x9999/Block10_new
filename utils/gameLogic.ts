
import { BOARD_SIZE } from '../constants';
import { GridType, ShapeDefinition, Position, ShapeObj } from '../types';

export const createEmptyGrid = (): GridType => {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
};

export const isValidPos = (r: number, c: number): boolean => {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
};

// Check if a shape can be placed at board[r][c] (top-left of shape)
export const canPlaceShape = (
  grid: GridType,
  shape: ShapeDefinition,
  pos: Position
): boolean => {
  const { r: startR, c: startC } = pos;
  
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c] === 1) {
        const boardR = startR + r;
        const boardC = startC + c;

        // Out of bounds
        if (!isValidPos(boardR, boardC)) return false;
        
        // Overlapping existing block
        if (grid[boardR][boardC] !== null) return false;
      }
    }
  }
  return true;
};

// Place shape on grid, returning new grid
export const placeShapeOnGrid = (
  grid: GridType,
  shape: ShapeDefinition,
  pos: Position,
  color: string
): GridType => {
  const newGrid = grid.map(row => [...row]);
  const { r: startR, c: startC } = pos;

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c] === 1) {
        newGrid[startR + r][startC + c] = color;
      }
    }
  }
  return newGrid;
};

// Check for full lines to clear
export const findClearedLines = (grid: GridType): { rowIndices: number[], colIndices: number[] } => {
  const rowIndices: number[] = [];
  const colIndices: number[] = [];

  // Check Rows
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (grid[r].every(cell => cell !== null)) {
      rowIndices.push(r);
    }
  }

  // Check Cols
  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (grid[r][c] === null) {
        full = false;
        break;
      }
    }
    if (full) colIndices.push(c);
  }

  return { rowIndices, colIndices };
};

// Remove lines and return new grid + score
export const clearLines = (grid: GridType, rowIndices: number[], colIndices: number[]): GridType => {
  let newGrid = grid.map(row => [...row]);

  // Clear rows
  rowIndices.forEach(r => {
    for (let c = 0; c < BOARD_SIZE; c++) {
      newGrid[r][c] = null;
    }
  });

  // Clear cols
  colIndices.forEach(c => {
    for (let r = 0; r < BOARD_SIZE; r++) {
      newGrid[r][c] = null;
    }
  });

  return newGrid;
};

// Check if game over
export const checkGameOver = (grid: GridType, shapes: ShapeDefinition[]): boolean => {
  if (shapes.length === 0) return false; 

  for (const shape of shapes) {
    let canPlaceThisShape = false;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (canPlaceShape(grid, shape, { r, c })) {
          canPlaceThisShape = true;
          break; 
        }
      }
      if (canPlaceThisShape) break;
    }
    if (canPlaceThisShape) return false; 
  }

  return true;
};

// Rotate Matrix 90 degrees clockwise
export const rotateShapeMatrix = (matrix: ShapeDefinition): ShapeDefinition => {
  const rows = matrix.length;
  const cols = matrix[0].length;
  // Transpose and reverse rows for clockwise rotation
  const newMatrix: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      newMatrix[c][rows - 1 - r] = matrix[r][c];
    }
  }
  return newMatrix;
};

// AI Logic for Hints
export const findBestMove = (grid: GridType, shapes: ShapeObj[]): { shapeIdx: number, r: number, c: number } | null => {
  let bestScore = -1;
  let bestMove = null;

  shapes.forEach((shape, shapeIdx) => {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (canPlaceShape(grid, shape.matrix, { r, c })) {
          // Simulate placement
          const tempGrid = placeShapeOnGrid(grid, shape.matrix, { r, c }, shape.color);
          const { rowIndices, colIndices } = findClearedLines(tempGrid);
          
          const linesCleared = rowIndices.length + colIndices.length;
          const blocksPlaced = shape.matrix.flat().reduce((a, b) => a + b, 0);
          
          // Heuristic: Prefer clearing lines heavily, then prefer using larger blocks
          const score = (linesCleared * 20) + blocksPlaced;
          
          if (score > bestScore) {
            bestScore = score;
            bestMove = { shapeIdx, r, c };
          }
        }
      }
    }
  });

  return bestMove;
};
