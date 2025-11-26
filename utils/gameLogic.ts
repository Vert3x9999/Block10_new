
import { BOARD_SIZE, SHAPES_TIER_1, SHAPES_TIER_2, SHAPES_TIER_3, SHAPE_COLORS } from '../constants';
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

// Helper to check if a shape can fit ANYWHERE on the grid
export const canShapeFitAnywhere = (grid: GridType, shape: ShapeDefinition): boolean => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (canPlaceShape(grid, shape, { r, c })) {
        return true;
      }
    }
  }
  return false;
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

// --- Smart Shape Generation for Infinite Mode ---

export const generateSmartShapes = (currentScore: number, grid: GridType): ShapeObj[] => {
  const newShapes: ShapeObj[] = [];
  
  // 1. Determine Difficulty Weights based on Score
  let w1, w2, w3; // Probabilities for Tier 1, 2, 3
  
  if (currentScore < 2000) {
    w1 = 0.7; w2 = 0.3; w3 = 0.0;
  } else if (currentScore < 10000) {
    w1 = 0.4; w2 = 0.4; w3 = 0.2;
  } else {
    // Cap max difficulty at 30% Tier 3 to prevent "impossible hands"
    w1 = 0.3; w2 = 0.4; w3 = 0.3;
  }

  const getWeightedTier = () => {
    const r = Math.random();
    if (r < w1) return SHAPES_TIER_1;
    if (r < w1 + w2) return SHAPES_TIER_2;
    return SHAPES_TIER_3;
  };

  const createShape = (matrix: ShapeDefinition): ShapeObj => ({
    id: Math.random().toString(36).substr(2, 9),
    matrix,
    color: SHAPE_COLORS[Math.floor(Math.random() * SHAPE_COLORS.length)],
  });

  // 2. Generate Initial 3 Shapes
  // Always ensure at least ONE Tier 1 shape is present for safety
  newShapes.push(createShape(SHAPES_TIER_1[Math.floor(Math.random() * SHAPES_TIER_1.length)]));
  
  // Generate remaining 2 based on weights
  for (let i = 0; i < 2; i++) {
    const tier = getWeightedTier();
    newShapes.push(createShape(tier[Math.floor(Math.random() * tier.length)]));
  }

  // Shuffle the guaranteed T1 shape position
  for (let i = newShapes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newShapes[i], newShapes[j]] = [newShapes[j], newShapes[i]];
  }

  // 3. Safety Check: Impossible Hand Prevention
  // Ensure at least one shape can theoretically fit on the board
  // If the board is not full, we shouldn't give 3 unplayable shapes.
  
  // First, check if board is full (no empty cells)
  let hasEmptyCell = false;
  for(let r=0; r<BOARD_SIZE; r++) {
     if(grid[r].some(c => c === null)) { hasEmptyCell = true; break; }
  }

  if (hasEmptyCell) {
    // Check if any of the generated shapes fit
    const anyFits = newShapes.some(s => canShapeFitAnywhere(grid, s.matrix));

    if (!anyFits) {
      // If none fit, replace the first one with a 1x1 block (ultimate safety)
      // or a very small Tier 1 block
      newShapes[0] = createShape([[1]]); // 1x1 block
    }
  }

  return newShapes;
};
