import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GridType, ShapeObj, Position, GameState } from './types';
import { SHAPE_COLORS, BOARD_SIZE, SHAPES } from './constants';
import { createEmptyGrid, canPlaceShape, placeShapeOnGrid, findClearedLines, clearLines, checkGameOver, findBestMove } from './utils/gameLogic';
import { playPlaceSound, playClearSound, playGameOverSound } from './utils/soundEffects';
import GridCell from './components/GridCell';
import ShapeTray from './components/ShapeTray';
import ShapeRenderer from './components/ShapeRenderer';
import { Trophy, RefreshCw, AlertCircle, Lightbulb, RotateCcw, RotateCw, Zap, Play, Home, ListOrdered, ArrowLeft, History, Trash2, Calendar, Crown } from 'lucide-react';

// Static dragging info that doesn't trigger re-renders
interface DragInfo {
  shapeIdx: number;
  startX: number;
  startY: number;
  gridCellSize: number;
  trayCellSize: number;
  touchOffset: number;
  pointerId: number;
  grabOffsetX: number;
  grabOffsetY: number;
}

interface ScoreRecord {
  score: number;
  timestamp: number;
}

type ViewState = 'home' | 'game' | 'leaderboard';

const App: React.FC = () => {
  // --- View State ---
  const [view, setView] = useState<ViewState>('home');

  // --- Game State ---
  const [grid, setGrid] = useState<GridType>(createEmptyGrid());
  const [score, setScore] = useState<number>(0);
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false);
  
  // Leaderboard State (Local Only)
  const [leaderboard, setLeaderboard] = useState<ScoreRecord[]>(() => {
    try {
      const saved = localStorage.getItem('blockfit-leaderboard');
      if (!saved) return [];
      
      const parsed = JSON.parse(saved);
      
      // Migration: If old format (number[]), convert to ScoreRecord[]
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'number') {
        const migrated = parsed.map((s: number) => ({
          score: s,
          timestamp: Date.now() // Use current time for legacy scores
        }));
        return migrated;
      }
      
      return parsed;
    } catch (e) {
      return [];
    }
  });

  const [availableShapes, setAvailableShapes] = useState<ShapeObj[]>([]);
  const [selectedShapeIdx, setSelectedShapeIdx] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<Position | null>(null);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [clearingLines, setClearingLines] = useState<{rows: number[], cols: number[]} | null>(null);
  const [placedAnimationCells, setPlacedAnimationCells] = useState<{r: number, c: number}[]>([]);
  const [hint, setHint] = useState<{shapeIdx: number, r: number, c: number} | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [comboCount, setComboCount] = useState<number>(0);

  // --- Limits State ---
  const [hintLeft, setHintLeft] = useState<number>(3);
  const [undoLeft, setUndoLeft] = useState<number>(3);
  const [redoLeft, setRedoLeft] = useState<number>(3);
  
  // Dragging Refs (Optimization: Don't use State for high-frequency updates)
  const dragInfoRef = useRef<DragInfo | null>(null);
  const floatingShapeRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false); // Only for UI visibility toggles

  // Undo/Redo Stacks
  const [history, setHistory] = useState<GameState[]>([]);
  const [redoStack, setRedoStack] = useState<GameState[]>([]);

  // --- Difficulty Logic ---
  const getDifficultyPool = useCallback((currentScore: number) => {
    return SHAPES;
  }, []);

  // --- Helpers ---
  const generateNewShapes = useCallback(() => {
    const newShapes: ShapeObj[] = [];
    const shapePool = getDifficultyPool(score);

    for (let i = 0; i < 3; i++) {
      const randomShapeIdx = Math.floor(Math.random() * shapePool.length);
      const randomColorIdx = Math.floor(Math.random() * SHAPE_COLORS.length);
      newShapes.push({
        id: Math.random().toString(36).substr(2, 9),
        matrix: shapePool[randomShapeIdx],
        color: SHAPE_COLORS[randomColorIdx],
      });
    }
    setAvailableShapes(newShapes);
    setHint(null);
  }, [score, getDifficultyPool]);

  const saveScoreToLeaderboard = (finalScore: number) => {
    // Only save significant scores
    if (finalScore === 0) return;

    // Check if it's a new high score
    const currentBest = leaderboard.length > 0 ? leaderboard[0].score : 0;
    if (finalScore > currentBest) {
      setIsNewHighScore(true);
    }

    const newRecord: ScoreRecord = {
      score: finalScore,
      timestamp: Date.now()
    };

    const newLeaderboard = [...leaderboard, newRecord]
      .sort((a, b) => b.score - a.score)
      .slice(0, 100); // Keep top 100

    setLeaderboard(newLeaderboard);
    localStorage.setItem('blockfit-leaderboard', JSON.stringify(newLeaderboard));
  };

  const clearLeaderboard = () => {
    if (confirm('Are you sure you want to clear all history?')) {
      setLeaderboard([]);
      localStorage.removeItem('blockfit-leaderboard');
    }
  };

  const startNewGame = () => {
    setGrid(createEmptyGrid());
    setScore(0);
    setIsGameOver(false);
    setIsNewHighScore(false);
    setSelectedShapeIdx(null);
    setClearingLines(null);
    setPlacedAnimationCells([]);
    setHint(null);
    setAvailableShapes([]); 
    setHistory([]);
    setRedoStack([]);
    setComboCount(0);
    dragInfoRef.current = null;
    setIsDragging(false);
    
    // Reset Limits
    setHintLeft(3);
    setUndoLeft(3);
    setRedoLeft(3);

    setView('game');
  };

  // --- Initialization ---
  useEffect(() => {
    if (view === 'game' && availableShapes.length === 0 && !isGameOver) {
      generateNewShapes();
    }
  }, [view, availableShapes, isGameOver, generateNewShapes]);

  // --- Game Over Check ---
  useEffect(() => {
    if (view !== 'game') return;
    if (availableShapes.length === 0 && !clearingLines) return;

    if (availableShapes.length > 0 && !clearingLines && !isGameOver) {
      const matrices = availableShapes.map(s => s.matrix);
      const over = checkGameOver(grid, matrices);
      if (over) {
        setIsGameOver(true);
        saveScoreToLeaderboard(score);
      }
    }
  }, [view, availableShapes, grid, clearingLines, isGameOver, score]);

  useEffect(() => {
    if (isGameOver) {
      playGameOverSound();
    }
  }, [isGameOver]);

  // --- Core Placement Logic ---
  const attemptPlaceShape = (shapeIdx: number, r: number, c: number) => {
    const shapeObj = availableShapes[shapeIdx];
    if (!shapeObj) return;

    const canPlace = canPlaceShape(grid, shapeObj.matrix, { r, c });

    if (canPlace) {
      // Save State
      const currentState: GameState = {
        grid,
        score,
        availableShapes,
        isGameOver,
        comboCount
      };
      setHistory(prev => [...prev, currentState]);
      setRedoStack([]);

      setHint(null);

      // Place
      const newGrid = placeShapeOnGrid(grid, shapeObj.matrix, { r, c }, shapeObj.color);
      
      // Animation cells
      const justPlaced: {r: number, c: number}[] = [];
      shapeObj.matrix.forEach((row, dr) => {
        row.forEach((val, dc) => {
          if (val === 1) {
            justPlaced.push({r: r + dr, c: c + dc});
          }
        });
      });
      setPlacedAnimationCells(justPlaced);
      setTimeout(() => setPlacedAnimationCells([]), 400);

      const blocksCount = shapeObj.matrix.flat().reduce((acc, val) => acc + val, 0);
      
      // Increased scoring: 50 points per block placed
      let newScore = score + (blocksCount * 50);

      const { rowIndices, colIndices } = findClearedLines(newGrid);

      if (rowIndices.length > 0 || colIndices.length > 0) {
        const newCombo = comboCount + 1;
        setComboCount(newCombo);
        playClearSound(rowIndices.length + colIndices.length);

        setGrid(newGrid);
        setClearingLines({ rows: rowIndices, cols: colIndices });
        
        // Remove shape
        const nextShapes = availableShapes.filter((_, idx) => idx !== shapeIdx);
        setAvailableShapes(nextShapes);

        setTimeout(() => {
          const clearedGrid = clearLines(newGrid, rowIndices, colIndices);
          setGrid(clearedGrid);
          
          const totalLines = rowIndices.length + colIndices.length;
          // Massive scoring for lines
          const baseLineBonus = (totalLines * 1000) + (totalLines > 1 ? (totalLines - 1) * 500 : 0);
          const multipliedBonus = baseLineBonus * newCombo;

          setScore(newScore + multipliedBonus);
          setClearingLines(null);
        }, 300);
      } else {
        setComboCount(0);
        playPlaceSound();
        setGrid(newGrid);
        setScore(newScore);
        const nextShapes = availableShapes.filter((_, idx) => idx !== shapeIdx);
        setAvailableShapes(nextShapes);
      }
    }
  };

  // --- Click / Select Interactions ---
  const handleSelectShape = (index: number) => {
    if (isGameOver || showResetConfirm) return;
    setHint(null);
    setSelectedShapeIdx(prev => prev === index ? null : index);
  };

  const handleMouseEnterCell = (r: number, c: number) => {
    if (isDragging) return; 
    if (selectedShapeIdx === null) {
      setHoverPos(null);
      return;
    }
    setHoverPos({ r, c });
  };

  const handleClickCell = (r: number, c: number) => {
    if (isDragging) return;
    if (selectedShapeIdx === null || isGameOver || showResetConfirm) return;
    
    attemptPlaceShape(selectedShapeIdx, r, c);
    setSelectedShapeIdx(null);
    setHoverPos(null);
  };

  // --- Drag & Drop Logic (Optimized) ---

  const handleDragStart = (index: number, e: React.PointerEvent, trayCellSize: number) => {
    if (isGameOver || showResetConfirm) return;

    let gridCellSize = 0;
    if (gridRef.current) {
      gridCellSize = gridRef.current.getBoundingClientRect().width / BOARD_SIZE;
    } else {
      gridCellSize = 35; // Fallback
    }

    const isTouch = e.pointerType === 'touch';
    // Increased touch offset for better visibility on mobile
    const touchOffset = isTouch ? 100 : 0; 

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Store drag info in Ref to avoid re-renders during move
    dragInfoRef.current = {
      shapeIdx: index,
      startX: e.clientX,
      startY: e.clientY,
      gridCellSize,
      trayCellSize,
      touchOffset,
      pointerId: e.pointerId,
      grabOffsetX: e.clientX - centerX,
      grabOffsetY: e.clientY - centerY
    };

    setIsDragging(true);
    setSelectedShapeIdx(index);
    setHint(null);
    
    // Initialize floating shape position
    if (floatingShapeRef.current) {
      const scale = gridCellSize / trayCellSize;
      const visualX = e.clientX - (dragInfoRef.current.grabOffsetX * scale);
      const visualY = e.clientY - (dragInfoRef.current.grabOffsetY * scale) - touchOffset;
      floatingShapeRef.current.style.transform = `translate(${visualX}px, ${visualY}px)`;
      floatingShapeRef.current.style.opacity = '1';
    }
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const dragInfo = dragInfoRef.current;
    if (!dragInfo) return;
    if (e.pointerId !== dragInfo.pointerId) return;

    e.preventDefault();

    const newX = e.clientX;
    const newY = e.clientY;
    
    // Direct DOM manipulation for smooth 60fps dragging
    if (floatingShapeRef.current) {
       const scale = dragInfo.gridCellSize / dragInfo.trayCellSize;
       const visualX = newX - (dragInfo.grabOffsetX * scale);
       const visualY = newY - (dragInfo.grabOffsetY * scale) - dragInfo.touchOffset;
       floatingShapeRef.current.style.transform = `translate(${visualX}px, ${visualY}px)`;
    }

    // Logic for grid snapping (State update, throttled implicitly by React)
    if (gridRef.current) {
      const scale = dragInfo.gridCellSize / dragInfo.trayCellSize;
      const visualX = newX - (dragInfo.grabOffsetX * scale);
      const visualY = newY - (dragInfo.grabOffsetY * scale) - dragInfo.touchOffset;

      const rect = gridRef.current.getBoundingClientRect();
      const cellSize = rect.width / BOARD_SIZE;
      
      const shape = availableShapes[dragInfo.shapeIdx];
      // Safety check if shape was removed
      if (!shape) return;

      const shapeRows = shape.matrix.length;
      const shapeCols = shape.matrix[0].length;

      // Calculate center of the dragged shape
      const relX = visualX - rect.left;
      const relY = visualY - rect.top;

      // Convert to grid coordinates (float)
      const pointerC = relX / cellSize;
      const pointerR = relY / cellSize;

      // The shape's anchor is its top-left (0,0). 
      // If we are dragging by center, we need to subtract half dimension to find top-left index.
      const targetR = Math.round(pointerR - (shapeRows / 2));
      const targetC = Math.round(pointerC - (shapeCols / 2));

      // Only update state if changed to avoid heavy diffing
      setHoverPos(prev => {
        if (prev?.r === targetR && prev?.c === targetC) return prev;
        
        if (targetR >= -2 && targetR < BOARD_SIZE + 2 && targetC >= -2 && targetC < BOARD_SIZE + 2) {
          return { r: targetR, c: targetC };
        }
        return null;
      });
    }
  }, [availableShapes]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    const dragInfo = dragInfoRef.current;
    if (!dragInfo) return;
    if (e.pointerId !== dragInfo.pointerId) return;

    let dropR: number | null = null;
    let dropC: number | null = null;

    if (gridRef.current) {
      const scale = dragInfo.gridCellSize / dragInfo.trayCellSize;
      const visualX = e.clientX - (dragInfo.grabOffsetX * scale);
      const visualY = e.clientY - (dragInfo.grabOffsetY * scale) - dragInfo.touchOffset;
      const rect = gridRef.current.getBoundingClientRect();
      const cellSize = rect.width / BOARD_SIZE;
      const shape = availableShapes[dragInfo.shapeIdx];
      
      if (shape) {
        const shapeRows = shape.matrix.length;
        const shapeCols = shape.matrix[0].length;
        const relX = visualX - rect.left;
        const relY = visualY - rect.top;
        const pointerC = relX / cellSize;
        const pointerR = relY / cellSize;
        dropR = Math.round(pointerR - (shapeRows / 2));
        dropC = Math.round(pointerC - (shapeCols / 2));
      }
    }

    if (dropR !== null && dropC !== null && 
        dropR >= -2 && dropR < BOARD_SIZE + 2 && 
        dropC >= -2 && dropC < BOARD_SIZE + 2) {
        attemptPlaceShape(dragInfo.shapeIdx, dropR, dropC);
    }
    
    setSelectedShapeIdx(null); 
    dragInfoRef.current = null;
    setIsDragging(false);
    setHoverPos(null);
  }, [availableShapes, grid]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const handleBackgroundClick = () => {
    if (!isDragging) setSelectedShapeIdx(null);
  };

  // --- Tool Actions ---

  const handleUndo = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Allow undo on game over (removed isGameOver check)
    if (history.length === 0 || clearingLines || showResetConfirm) return;
    if (undoLeft <= 0) return;

    const previousState = history[history.length - 1];
    setRedoStack([...redoStack, { grid, score, availableShapes, isGameOver, comboCount }]);
    
    // Restore logic
    setGrid(previousState.grid);
    setScore(previousState.score);
    setAvailableShapes(previousState.availableShapes);
    setIsGameOver(previousState.isGameOver); // This will revive the game if it was over
    setIsNewHighScore(false); // Reset high score flag on undo
    setComboCount(previousState.comboCount);
    
    setHistory(history.slice(0, -1));
    setSelectedShapeIdx(null);
    setHint(null);
    setUndoLeft(prev => prev - 1);
  };

  const handleRedo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (redoStack.length === 0 || clearingLines || showResetConfirm || isGameOver) return;
    if (redoLeft <= 0) return;

    const nextState = redoStack[redoStack.length - 1];
    setHistory([...history, { grid, score, availableShapes, isGameOver, comboCount }]);
    setGrid(nextState.grid);
    setScore(nextState.score);
    setAvailableShapes(nextState.availableShapes);
    setIsGameOver(nextState.isGameOver);
    setComboCount(nextState.comboCount);
    setRedoStack(redoStack.slice(0, -1));
    setSelectedShapeIdx(null);
    setHint(null);
    setRedoLeft(prev => prev - 1);
  };

  const handleHint = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGameOver || availableShapes.length === 0 || showResetConfirm) return;
    if (hintLeft <= 0) return;

    const bestMove = findBestMove(grid, availableShapes);
    if (bestMove) {
      setHint(bestMove);
      setHintLeft(prev => prev - 1);
    }
  };

  const handleNewGameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isEmpty = grid.every(row => row.every(cell => cell === null));
    if (isGameOver || (score === 0 && isEmpty)) {
      startNewGame();
      return;
    }
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    startNewGame();
    setShowResetConfirm(false);
  };

  const exitToHome = () => {
    setView('home');
    setShowResetConfirm(false);
  };

  // --- Render Helpers ---

  const getGhostCells = () => {
    const activeShapeIdx = isDragging && dragInfoRef.current ? dragInfoRef.current.shapeIdx : selectedShapeIdx;
    
    if (activeShapeIdx === null || !hoverPos) return [];
    
    const shape = availableShapes[activeShapeIdx];
    if (!shape) return [];

    const cells: {r: number, c: number, color: string, valid: boolean}[] = [];
    const valid = canPlaceShape(grid, shape.matrix, hoverPos);
    
    shape.matrix.forEach((row, dr) => {
      row.forEach((val, dc) => {
        if (val === 1) {
          const targetR = hoverPos.r + dr;
          const targetC = hoverPos.c + dc;
          if (targetR >= 0 && targetR < BOARD_SIZE && targetC >= 0 && targetC < BOARD_SIZE) {
            cells.push({
               r: targetR, 
               c: targetC, 
               color: shape.color, 
               valid 
            });
          }
        }
      });
    });
    return cells;
  };

  const getHintCells = () => {
    if (!hint) return [];
    const shape = availableShapes[hint.shapeIdx];
    if (!shape) return [];
    const cells: {r: number, c: number, color: string}[] = [];
    shape.matrix.forEach((row, dr) => {
      row.forEach((val, dc) => {
        if (val === 1) cells.push({ r: hint.r + dr, c: hint.c + dc, color: shape.color });
      });
    });
    return cells;
  };

  const ghostCells = getGhostCells();
  const hintCells = getHintCells();

  // --- Views ---

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4 animate-in fade-in duration-500 relative">
      <div className="text-center space-y-2">
        <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
          BlockFit
        </h1>
        <p className="text-slate-400 text-sm tracking-[0.3em] uppercase font-semibold">
          10x10 Puzzle
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button 
          onClick={startNewGame}
          className="group relative flex items-center justify-center gap-3 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95"
        >
          <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <Play fill="currentColor" size={24} />
          START GAME
        </button>

        <button 
          onClick={() => setView('leaderboard')}
          className="group flex items-center justify-center gap-3 w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-lg border border-slate-700 transition-all hover:scale-105 active:scale-95"
        >
          <History size={24} className="text-yellow-500" />
          MY RECORDS
        </button>
      </div>

      <div className="absolute bottom-10 text-slate-600 text-xs text-center">
        Block fitting puzzle • No time limit • Combo system
      </div>
      
      <div className="absolute bottom-4 text-slate-500 text-[10px] font-mono opacity-60">
        Author: Vertex Wei
      </div>
    </div>
  );

  const renderLeaderboard = () => (
    <div className="flex flex-col items-center min-h-screen p-4 w-full max-w-md mx-auto animate-in slide-in-from-right duration-300">
      <div className="w-full flex items-center justify-between mb-8">
        <button 
          onClick={() => setView('home')}
          className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <ListOrdered className="text-purple-500" />
          My Best Scores
        </h2>
        
        {leaderboard.length > 0 ? (
          <button 
            onClick={clearLeaderboard}
            className="p-2 bg-slate-800 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            title="Clear History"
          >
            <Trash2 size={20} />
          </button>
        ) : (
          <div className="w-10"></div>
        )}
      </div>

      <div className="w-full bg-slate-900 rounded-2xl p-4 shadow-xl border border-slate-800 flex flex-col max-h-[70vh]">
        {leaderboard.length === 0 ? (
          <div className="text-center py-12 text-slate-500 italic flex flex-col items-center gap-4">
            <Trophy size={48} className="text-slate-700" />
            <p>No games played on this device yet.</p>
            <p className="text-sm">Start a game to set a record!</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {leaderboard.map((record, i) => {
              const dateObj = new Date(record.timestamp);
              const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

              return (
                <div 
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    i === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-transparent border border-yellow-500/30' : 
                    i === 1 ? 'bg-slate-800/80 border border-slate-700' :
                    i === 2 ? 'bg-slate-800/50 border border-slate-800' : 'bg-transparent border-b border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-4">
                     <div className={`
                       w-8 h-8 flex items-center justify-center rounded-full font-black text-sm shrink-0
                       ${i === 0 ? 'bg-yellow-500 text-black' : 
                         i === 1 ? 'bg-slate-400 text-black' :
                         i === 2 ? 'bg-orange-700 text-white' : 'text-slate-500'}
                     `}>
                       {i + 1}
                     </div>
                     <div className="flex flex-col">
                        <span className="text-slate-200 font-mono text-lg leading-tight">{record.score.toLocaleString()}</span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Calendar size={10} />
                          <span>{dateStr}</span>
                          <span className="opacity-50">|</span>
                          <span>{timeStr}</span>
                        </div>
                     </div>
                  </div>
                  {i === 0 && <Trophy size={16} className="text-yellow-500" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="text-center text-xs text-slate-600 mt-4">
         * Records are stored locally on your device browser.
      </div>
    </div>
  );

  const renderGame = () => (
    <div 
      className="flex flex-col items-center justify-center p-4 w-full max-w-lg mx-auto"
      onClick={handleBackgroundClick}
    >
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowResetConfirm(true)}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-700"
          >
            <Home size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 leading-none">
              BlockFit
            </h1>
          </div>
        </div>
        
        <div className="flex flex-col items-end relative">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Current Score</span>
          <div className="flex items-center gap-2">
            <span className="text-white font-mono font-bold text-3xl leading-none tracking-tight">{score.toLocaleString()}</span>
            {comboCount > 1 && (
              <div className="absolute right-0 top-full mt-1 flex items-center gap-1 text-yellow-400 animate-pulse whitespace-nowrap">
                  <Zap size={12} className="fill-yellow-400" />
                  <span className="text-xs font-bold italic tracking-wider">x{comboCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div 
        ref={gridRef}
        className="relative bg-slate-900 p-3 rounded-xl shadow-2xl shadow-black ring-1 ring-slate-800 touch-none mb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="grid gap-1"
          style={{ 
            gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
            width: 'min(85vw, 380px)',
            height: 'min(85vw, 380px)',
          }}
          onMouseLeave={() => !isDragging && setHoverPos(null)}
        >
          {grid.map((row, r) => (
            row.map((cellColor, c) => {
              const isClearing = clearingLines && (clearingLines.rows.includes(r) || clearingLines.cols.includes(c));
              const isPlacement = placedAnimationCells.some(p => p.r === r && p.c === c);
              
              const ghost = ghostCells.find(g => g.r === r && g.c === c);
              const hintCell = hintCells.find(h => h.r === r && h.c === c);
              
              let displayColor = cellColor;
              let isGhost = false;
              let isHint = false;
              let isValid = true;

              if (ghost) {
                if (!cellColor) {
                  displayColor = ghost.color;
                  isGhost = true;
                  isValid = ghost.valid;
                }
              } else if (hintCell && !cellColor && selectedShapeIdx === null && !isDragging) {
                displayColor = hintCell.color;
                isHint = true;
              }

              return (
                <div 
                  key={`${r}-${c}`} 
                  className={`
                    relative w-full h-full
                    ${isClearing ? 'scale-0 opacity-0' : ''}
                    transition-all duration-300
                  `}
                >
                   <GridCell 
                      color={displayColor}
                      isGhost={isGhost}
                      isHint={isHint}
                      isPlacement={isPlacement}
                      isValid={isValid}
                      onClick={() => handleClickCell(r, c)}
                      onMouseEnter={() => handleMouseEnterCell(r, c)}
                   />
                </div>
              );
            })
          ))}
        </div>

        {/* Reset Confirmation Overlay */}
        {showResetConfirm && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-30 p-6 text-center animate-in fade-in duration-200">
            <h2 className="text-xl font-bold text-white mb-2">Quit Game?</h2>
            <p className="text-slate-400 mb-6 text-sm">Progress will be lost.</p>
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={confirmReset}
                className="w-full py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg"
              >
                Restart
              </button>
              <button 
                onClick={exitToHome}
                className="w-full py-3 rounded-lg font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Exit to Home
              </button>
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="w-full py-3 rounded-lg font-bold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {isGameOver && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center rounded-xl z-20 animate-in zoom-in-95 duration-300">
            {isNewHighScore ? (
              <div className="flex flex-col items-center animate-bounce mb-2">
                <Crown size={48} className="text-yellow-400 fill-yellow-400/20" />
                <span className="text-yellow-400 font-black tracking-widest text-lg drop-shadow-glow">NEW BEST!</span>
              </div>
            ) : (
              <AlertCircle size={48} className="text-red-500 mb-4" />
            )}
            
            <h2 className="text-3xl font-black text-white mb-2">GAME OVER</h2>
            <div className={`
              px-6 py-3 rounded-xl border mb-8 flex flex-col items-center
              ${isNewHighScore ? 'bg-yellow-500/10 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'bg-slate-800/50 border-slate-700'}
            `}>
              <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">Final Score</span>
              <span className={`text-3xl font-mono ${isNewHighScore ? 'text-yellow-400' : 'text-white'}`}>{score.toLocaleString()}</span>
            </div>
            
            <div className="flex flex-col gap-3 w-3/4">
              <button 
                onClick={handleUndo}
                disabled={history.length === 0 || undoLeft <= 0}
                className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
              >
                <RotateCcw size={18} />
                Undo Last Move {undoLeft > 0 && <span className="bg-black/20 px-1.5 py-0.5 rounded text-xs ml-1">{undoLeft}</span>}
              </button>
              <button 
                onClick={startNewGame}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95"
              >
                <RefreshCw size={18} />
                Try Again
              </button>
              <button 
                onClick={exitToHome}
                className="text-slate-500 hover:text-white text-sm font-bold py-2 transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tools & Shape Tray */}
      <div className="w-full max-w-md flex flex-col gap-4">
         <div className="flex justify-between items-center px-4">
           
           <div className="flex gap-4">
             <button 
               onClick={handleUndo} 
               disabled={history.length === 0 || !!clearingLines || showResetConfirm || undoLeft <= 0}
               className="relative group p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-all active:scale-95 border border-slate-700/50"
               title="Undo"
             >
               <RotateCcw size={20} />
               <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full border-2 border-slate-950">
                 {undoLeft}
               </span>
             </button>
             
             <button 
               onClick={handleRedo} 
               disabled={redoStack.length === 0 || !!clearingLines || showResetConfirm || isGameOver || redoLeft <= 0}
               className="relative group p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-all active:scale-95 border border-slate-700/50"
               title="Redo"
             >
               <RotateCw size={20} />
               <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full border-2 border-slate-950">
                 {redoLeft}
               </span>
             </button>
           </div>

           <button 
              onClick={handleHint}
              disabled={isGameOver || hint !== null || showResetConfirm || hintLeft <= 0}
              className="relative flex items-center gap-2 px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-xl disabled:opacity-30 disabled:bg-transparent transition-all border border-yellow-500/20 active:scale-95"
            >
              <Lightbulb size={18} className={hint ? "fill-yellow-500" : ""} />
              <span className="font-bold text-sm">HINT</span>
              <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                 {hintLeft}
               </span>
            </button>
        </div>
        
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 pb-2">
          <ShapeTray 
            shapes={availableShapes} 
            selectedIndex={selectedShapeIdx} 
            draggingIndex={isDragging && dragInfoRef.current ? dragInfoRef.current.shapeIdx : null}
            onSelectShape={handleSelectShape} 
            onDragStart={handleDragStart}
          />
        </div>

        {hint !== null && !isDragging && (
          <div className="text-center text-xs text-yellow-500 animate-pulse font-bold">
             Check the board!
          </div>
        )}
      </div>

      {/* Floating Shape when dragging - Optimized with ref */}
      <div 
        ref={floatingShapeRef}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          transform: 'translate(0,0)',
          pointerEvents: 'none',
          zIndex: 50,
          opacity: 0, // Hidden initially until positioned
          transformOrigin: '50% 50%'
        }}
      >
        {isDragging && dragInfoRef.current && (
           <ShapeRenderer 
             matrix={availableShapes[dragInfoRef.current.shapeIdx].matrix} 
             color={availableShapes[dragInfoRef.current.shapeIdx].color} 
             cellSize={dragInfoRef.current.gridCellSize}
             className="drop-shadow-2xl opacity-90"
           />
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 font-sans select-none overflow-hidden text-slate-100">
      {view === 'home' && renderHome()}
      {view === 'leaderboard' && renderLeaderboard()}
      {view === 'game' && renderGame()}
    </div>
  );
};

export default App;