
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GridType, ShapeObj, Position, GameState, LevelConfig, LevelProgress } from './types';
import { SHAPE_COLORS, BOARD_SIZE, SHAPES, CHAPTERS } from './constants';
import { createEmptyGrid, canPlaceShape, placeShapeOnGrid, findClearedLines, clearLines, checkGameOver, findBestMove } from './utils/gameLogic';
import { playPlaceSound, playClearSound, playGameOverSound, playShuffleSound, playLevelWinSound, playLevelFailSound } from './utils/soundEffects';
import GridCell from './components/GridCell';
import ShapeTray from './components/ShapeTray';
import ShapeRenderer from './components/ShapeRenderer';
import { Trophy, RefreshCw, AlertCircle, Lightbulb, RotateCcw, RotateCw, Play, Home, ListOrdered, ArrowLeft, History, Trash2, Calendar, Crown, Shuffle, Map as MapIcon, Star, Lock, CheckCircle2 } from 'lucide-react';

// Static dragging info that doesn't trigger re-renders
interface DragInfo {
  shapeIdx: number;
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

type ViewState = 'home' | 'game' | 'leaderboard' | 'chapter-select' | 'level-select';
type GameMode = 'infinite' | 'level';

const App: React.FC = () => {
  // --- View State ---
  const [view, setView] = useState<ViewState>('home');
  const [gameMode, setGameMode] = useState<GameMode>('infinite');

  // --- Game State ---
  const [grid, setGrid] = useState<GridType>(createEmptyGrid());
  const [score, setScore] = useState<number>(0);
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false);
  
  // Level Mode State
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [currentLevel, setCurrentLevel] = useState<LevelConfig | null>(null);
  const [levelProgress, setLevelProgress] = useState<LevelProgress>(() => {
    try {
      const saved = localStorage.getItem('blockfit-level-progress');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [levelResult, setLevelResult] = useState<{success: boolean, crowns: number} | null>(null);

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
          timestamp: Date.now()
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
  const [refreshLeft, setRefreshLeft] = useState<number>(3);
  
  // Dragging Refs (Optimization: Don't use State for high-frequency updates)
  const dragInfoRef = useRef<DragInfo | null>(null);
  const floatingShapeRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false); // Only for UI visibility toggles

  // Undo/Redo Stacks
  const [history, setHistory] = useState<GameState[]>([]);
  const [redoStack, setRedoStack] = useState<GameState[]>([]);

  // --- Helpers ---
  const generateNewShapes = useCallback(() => {
    const newShapes: ShapeObj[] = [];
    const shapePool = SHAPES; // Use full pool for now

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
  }, []);

  const saveScoreToLeaderboard = (finalScore: number) => {
    if (finalScore === 0) return;
    const currentBest = leaderboard.length > 0 ? leaderboard[0].score : 0;
    if (finalScore > currentBest) setIsNewHighScore(true);

    const newRecord: ScoreRecord = {
      score: finalScore,
      timestamp: Date.now()
    };

    const newLeaderboard = [...leaderboard, newRecord]
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.timestamp - a.timestamp;
      })
      .slice(0, 100);

    setLeaderboard(newLeaderboard);
    localStorage.setItem('blockfit-leaderboard', JSON.stringify(newLeaderboard));
  };

  const saveLevelProgress = (levelId: string, crowns: number) => {
    const existingCrowns = levelProgress[levelId] || 0;
    if (crowns > existingCrowns) {
      const newProgress = { ...levelProgress, [levelId]: crowns };
      setLevelProgress(newProgress);
      localStorage.setItem('blockfit-level-progress', JSON.stringify(newProgress));
    }
  };

  const clearLeaderboard = () => {
    if (confirm('Are you sure you want to clear all history?')) {
      setLeaderboard([]);
      localStorage.removeItem('blockfit-leaderboard');
    }
  };

  const startNewGame = (mode: GameMode, level?: LevelConfig) => {
    setGameMode(mode);
    setCurrentLevel(level || null);
    
    setGrid(createEmptyGrid());
    setScore(0);
    setIsGameOver(false);
    setLevelResult(null);
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
    setRefreshLeft(3);

    setView('game');
  };

  // --- Initialization ---
  useEffect(() => {
    if (view === 'game' && availableShapes.length === 0 && !isGameOver && !levelResult) {
      generateNewShapes();
    }
  }, [view, availableShapes, isGameOver, levelResult, generateNewShapes]);

  // --- Game Over Check (Infinite & Level Fail) ---
  useEffect(() => {
    if (view !== 'game' || isGameOver || levelResult) return;
    if (availableShapes.length === 0 && !clearingLines) return;

    if (availableShapes.length > 0 && !clearingLines) {
      const matrices = availableShapes.map(s => s.matrix);
      const over = checkGameOver(grid, matrices);
      if (over) {
        if (gameMode === 'infinite') {
          setIsGameOver(true);
          saveScoreToLeaderboard(score);
          playGameOverSound();
        } else if (gameMode === 'level' && currentLevel) {
           // Level Mode: Check if we passed with at least 1 crown
           const crowns = calculateCrowns(score, currentLevel.targetScore);
           if (crowns >= 1) {
              setLevelResult({ success: true, crowns });
              saveLevelProgress(currentLevel.id, crowns);
              playLevelWinSound();
           } else {
              setIsGameOver(true); // Failed
              playLevelFailSound();
           }
        }
      }
    }
  }, [view, availableShapes, grid, clearingLines, isGameOver, score, gameMode, currentLevel, levelResult]);


  const calculateCrowns = (currentScore: number, target: number) => {
    if (currentScore >= target * 2) return 3;
    if (currentScore >= target * 1.5) return 2;
    if (currentScore >= target) return 1;
    return 0;
  };

  // --- Core Placement Logic ---
  const attemptPlaceShape = useCallback((shapeIdx: number, r: number, c: number) => {
    if (clearingLines || levelResult) return;
    
    const shapeObj = availableShapes[shapeIdx];
    if (!shapeObj) return;

    const canPlace = canPlaceShape(grid, shapeObj.matrix, { r, c });

    if (canPlace) {
      const currentState: GameState = {
        grid, score, availableShapes, isGameOver, comboCount
      };
      setHistory(prev => [...prev, currentState]);
      setRedoStack([]);
      setHint(null);

      const newGrid = placeShapeOnGrid(grid, shapeObj.matrix, { r, c }, shapeObj.color);
      
      const justPlaced: {r: number, c: number}[] = [];
      shapeObj.matrix.forEach((row, dr) => {
        row.forEach((val, dc) => {
          if (val === 1) justPlaced.push({r: r + dr, c: c + dc});
        });
      });
      setPlacedAnimationCells(justPlaced);
      setTimeout(() => setPlacedAnimationCells([]), 400);

      const blocksCount = shapeObj.matrix.flat().reduce((acc, val) => acc + val, 0);
      let newScore = score + (blocksCount * 50);

      const { rowIndices, colIndices } = findClearedLines(newGrid);

      if (rowIndices.length > 0 || colIndices.length > 0) {
        const newCombo = comboCount + 1;
        setComboCount(newCombo);
        playClearSound(rowIndices.length + colIndices.length);

        setGrid(newGrid);
        setClearingLines({ rows: rowIndices, cols: colIndices });
        
        const nextShapes = availableShapes.filter((_, idx) => idx !== shapeIdx);
        setAvailableShapes(nextShapes);

        setTimeout(() => {
          const clearedGrid = clearLines(newGrid, rowIndices, colIndices);
          setGrid(clearedGrid);
          
          const totalLines = rowIndices.length + colIndices.length;
          const baseLineBonus = (totalLines * 1000) + (totalLines > 1 ? (totalLines - 1) * 500 : 0);
          const multipliedBonus = baseLineBonus * newCombo;
          
          const finalNewScore = newScore + multipliedBonus;
          setScore(finalNewScore);
          setClearingLines(null);
          
          // Check Level Win Condition (Instant 3 Crowns)
          if (gameMode === 'level' && currentLevel) {
            const crowns = calculateCrowns(finalNewScore, currentLevel.targetScore);
            if (crowns === 3) {
              setLevelResult({ success: true, crowns: 3 });
              saveLevelProgress(currentLevel.id, 3);
              playLevelWinSound();
            }
          }

        }, 400);
      } else {
        setComboCount(0);
        playPlaceSound();
        setGrid(newGrid);
        setScore(newScore);
        const nextShapes = availableShapes.filter((_, idx) => idx !== shapeIdx);
        setAvailableShapes(nextShapes);
        
        // Check Level Win Condition (Instant 3 Crowns)
        if (gameMode === 'level' && currentLevel) {
            const crowns = calculateCrowns(newScore, currentLevel.targetScore);
            if (crowns === 3) {
              setLevelResult({ success: true, crowns: 3 });
              saveLevelProgress(currentLevel.id, 3);
              playLevelWinSound();
            }
        }
      }
    }
  }, [grid, availableShapes, clearingLines, score, comboCount, isGameOver, gameMode, currentLevel, levelResult]);

  // --- Interaction Handlers ---
  const handleSelectShape = (index: number) => {
    if (isGameOver || showResetConfirm || clearingLines || levelResult) return;
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

  const handleClickCell = useCallback((r: number, c: number) => {
    if (isDragging) return;
    if (selectedShapeIdx === null || isGameOver || showResetConfirm || clearingLines || levelResult) return;
    attemptPlaceShape(selectedShapeIdx, r, c);
    setSelectedShapeIdx(null);
    setHoverPos(null);
  }, [isDragging, selectedShapeIdx, isGameOver, showResetConfirm, clearingLines, levelResult, attemptPlaceShape]);

  // --- Drag & Drop ---
  const handleDragStart = (index: number, e: React.PointerEvent, trayCellSize: number) => {
    if (isGameOver || showResetConfirm || clearingLines || levelResult) return;

    let gridCellSize = 0;
    if (gridRef.current) {
      gridCellSize = gridRef.current.getBoundingClientRect().width / BOARD_SIZE;
    } else {
      gridCellSize = 35; // Fallback
    }

    const isTouch = e.pointerType === 'touch';
    const touchOffset = isTouch ? 100 : 0; 
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const shape = availableShapes[index];
    const shapeCols = shape.matrix[0].length;
    const shapeRows = shape.matrix.length;
    const shapePixelWidth = shapeCols * trayCellSize;
    const shapePixelHeight = shapeRows * trayCellSize;
    const offsetLeft = (rect.width - shapePixelWidth) / 2;
    const offsetTop = (rect.height - shapePixelHeight) / 2;
    const shapeAbsLeft = rect.left + offsetLeft;
    const shapeAbsTop = rect.top + offsetTop;
    const grabOffsetX = e.clientX - shapeAbsLeft;
    const grabOffsetY = e.clientY - shapeAbsTop;
    
    dragInfoRef.current = {
      shapeIdx: index,
      gridCellSize,
      trayCellSize,
      touchOffset,
      pointerId: e.pointerId,
      grabOffsetX,
      grabOffsetY
    };

    setIsDragging(true);
    setSelectedShapeIdx(index);
    setHint(null);
    
    if (floatingShapeRef.current) {
      const scale = gridCellSize / trayCellSize;
      const visualX = e.clientX - (grabOffsetX * scale);
      const visualY = e.clientY - (grabOffsetY * scale) - touchOffset;
      floatingShapeRef.current.style.transform = `translate(${visualX}px, ${visualY}px)`;
      floatingShapeRef.current.style.opacity = '1';
    }
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const dragInfo = dragInfoRef.current;
    if (!dragInfo) return;
    if (e.pointerId !== dragInfo.pointerId) return;
    e.preventDefault();

    const scale = dragInfo.gridCellSize / dragInfo.trayCellSize;
    const visualX = e.clientX - (dragInfo.grabOffsetX * scale);
    const visualY = e.clientY - (dragInfo.grabOffsetY * scale) - dragInfo.touchOffset;
    
    if (floatingShapeRef.current) {
       floatingShapeRef.current.style.transform = `translate(${visualX}px, ${visualY}px)`;
    }

    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const cellSize = rect.width / BOARD_SIZE;
      const relX = visualX - rect.left;
      const relY = visualY - rect.top;
      const pointerC = relX / cellSize;
      const pointerR = relY / cellSize;
      const targetR = Math.round(pointerR);
      const targetC = Math.round(pointerC);

      setHoverPos(prev => {
        if (prev?.r === targetR && prev?.c === targetC) return prev;
        if (targetR >= -5 && targetR < BOARD_SIZE + 5 && targetC >= -5 && targetC < BOARD_SIZE + 5) {
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
    
    if (clearingLines || levelResult) {
        setSelectedShapeIdx(null);
        dragInfoRef.current = null;
        setIsDragging(false);
        setHoverPos(null);
        return;
    }

    let dropR: number | null = null;
    let dropC: number | null = null;

    if (gridRef.current) {
      const scale = dragInfo.gridCellSize / dragInfo.trayCellSize;
      const visualX = e.clientX - (dragInfo.grabOffsetX * scale);
      const visualY = e.clientY - (dragInfo.grabOffsetY * scale) - dragInfo.touchOffset;
      const rect = gridRef.current.getBoundingClientRect();
      const cellSize = rect.width / BOARD_SIZE;
      const relX = visualX - rect.left;
      const relY = visualY - rect.top;
      dropC = Math.round(relX / cellSize);
      dropR = Math.round(relY / cellSize);
    }

    if (dropR !== null && dropC !== null) {
        attemptPlaceShape(dragInfo.shapeIdx, dropR, dropC);
    }
    
    setSelectedShapeIdx(null); 
    dragInfoRef.current = null;
    setIsDragging(false);
    setHoverPos(null);
  }, [availableShapes, clearingLines, levelResult, attemptPlaceShape]);

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
    if (history.length === 0 || clearingLines || showResetConfirm || levelResult) return;
    if (undoLeft <= 0) return;

    const previousState = history[history.length - 1];
    setRedoStack([...redoStack, { grid, score, availableShapes, isGameOver, comboCount }]);
    setGrid(previousState.grid);
    setScore(previousState.score);
    setAvailableShapes(previousState.availableShapes);
    setIsGameOver(previousState.isGameOver);
    setIsNewHighScore(false);
    setComboCount(previousState.comboCount);
    setHistory(history.slice(0, -1));
    setSelectedShapeIdx(null);
    setHint(null);
    setUndoLeft(prev => prev - 1);
  };

  const handleRedo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (redoStack.length === 0 || clearingLines || showResetConfirm || isGameOver || levelResult) return;
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

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGameOver || showResetConfirm || clearingLines || levelResult) return;
    if (refreshLeft <= 0) return;
    playShuffleSound();
    generateNewShapes();
    setRefreshLeft(prev => prev - 1);
    setSelectedShapeIdx(null);
    setHint(null);
  };

  const handleHint = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGameOver || availableShapes.length === 0 || showResetConfirm || clearingLines || levelResult) return;
    if (hintLeft <= 0) return;
    const bestMove = findBestMove(grid, availableShapes);
    if (bestMove) {
      setHint(bestMove);
      setHintLeft(prev => prev - 1);
    }
  };

  // --- View Rendering ---

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
          onClick={() => startNewGame('infinite')}
          className="group relative flex items-center justify-center gap-3 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95"
        >
          <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <Play fill="currentColor" size={24} />
          INFINITE MODE
        </button>

        <button 
          onClick={() => setView('chapter-select')}
          className="group relative flex items-center justify-center gap-3 w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-purple-500/25 transition-all hover:scale-105 active:scale-95"
        >
          <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <MapIcon fill="currentColor" size={24} />
          ADVENTURE MODE
        </button>

        <button 
          onClick={() => setView('leaderboard')}
          className="group flex items-center justify-center gap-3 w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-lg border border-slate-700 transition-all hover:scale-105 active:scale-95"
        >
          <History size={24} className="text-yellow-500" />
          MY RECORDS
        </button>
      </div>

      <div className="absolute bottom-4 text-slate-500 text-[10px] font-mono opacity-60">
        Author: Vertex Wei
      </div>
    </div>
  );

  const renderChapterSelect = () => (
    <div className="flex flex-col items-center min-h-screen p-4 w-full max-w-md mx-auto animate-in slide-in-from-right duration-300">
      <div className="w-full flex items-center justify-between mb-8">
        <button onClick={() => setView('home')} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-2xl font-bold text-white">Select Chapter</h2>
        <div className="w-10"></div>
      </div>
      
      <div className="flex flex-col gap-6 w-full">
        {CHAPTERS.map(chapter => (
          <button
            key={chapter.id}
            onClick={() => {
              setCurrentChapterId(chapter.id);
              setView('level-select');
            }}
            className="flex flex-col gap-2 p-6 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-2xl text-left transition-all hover:scale-105 active:scale-95 shadow-xl"
          >
            <h3 className="text-xl font-black text-white">{chapter.title}</h3>
            <p className="text-slate-400 text-sm">{chapter.description}</p>
            <div className="mt-2 flex items-center gap-2 text-xs font-bold text-purple-400">
              <span>15 LEVELS</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderLevelSelect = () => {
    const chapter = CHAPTERS.find(c => c.id === currentChapterId);
    if (!chapter) return null;

    return (
      <div className="flex flex-col items-center min-h-screen p-4 w-full max-w-md mx-auto animate-in slide-in-from-right duration-300">
        <div className="w-full flex items-center justify-between mb-8">
          <button onClick={() => setView('chapter-select')} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-xl font-bold text-white truncate">{chapter.title}</h2>
          <div className="w-10"></div>
        </div>

        <div className="grid grid-cols-3 gap-4 w-full">
          {chapter.levels.map((level, i) => {
            const crowns = levelProgress[level.id] || 0;
            // First level always unlocked. Others unlocked if previous has > 0 crowns.
            const isUnlocked = i === 0 || (levelProgress[chapter.levels[i-1].id] || 0) > 0;
            
            return (
              <button
                key={level.id}
                disabled={!isUnlocked}
                onClick={() => startNewGame('level', level)}
                className={`
                  relative aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all
                  ${isUnlocked 
                    ? 'bg-slate-800 border-slate-600 hover:bg-slate-700 active:scale-95' 
                    : 'bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed'}
                `}
              >
                {!isUnlocked ? (
                  <Lock size={24} className="text-slate-600" />
                ) : (
                  <>
                    <span className="text-2xl font-black text-slate-200">{level.label}</span>
                    <div className="flex gap-0.5 mt-1">
                      {[1, 2, 3].map(c => (
                        <Crown 
                          key={c} 
                          size={12} 
                          className={c <= crowns ? 'text-yellow-500 fill-yellow-500' : 'text-slate-600'} 
                        />
                      ))}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderGame = () => {
    const historicalBest = leaderboard.length > 0 ? leaderboard[0].score : 0;
    const currentBestScore = Math.max(score, historicalBest);
    
    // Level Mode HUD calculation
    const isLevelMode = gameMode === 'level' && currentLevel;
    const target1 = isLevelMode ? currentLevel.targetScore : 0;
    const target2 = target1 * 1.5;
    const target3 = target1 * 2;
    const progressPercent = isLevelMode ? Math.min((score / target3) * 100, 100) : 0;

    const ghostCells: {r: number, c: number, color: string, valid: boolean}[] = [];
    if (selectedShapeIdx !== null && hoverPos && availableShapes[selectedShapeIdx]) {
      const shape = availableShapes[selectedShapeIdx];
      const isValid = canPlaceShape(grid, shape.matrix, hoverPos);
      
      shape.matrix.forEach((row, dr) => {
        row.forEach((val, dc) => {
          if (val === 1) {
            ghostCells.push({
              r: hoverPos.r + dr,
              c: hoverPos.c + dc,
              color: shape.color,
              valid: isValid
            });
          }
        });
      });
    }

    const hintCells: {r: number, c: number, color: string}[] = [];
    if (hint && availableShapes[hint.shapeIdx]) {
       const shape = availableShapes[hint.shapeIdx];
       shape.matrix.forEach((row, dr) => {
         row.forEach((val, dc) => {
           if (val === 1) {
             hintCells.push({
               r: hint.r + dr,
               c: hint.c + dc,
               color: shape.color
             });
           }
         });
       });
    }

    return (
      <div 
        className="flex flex-col items-center justify-center min-h-screen p-4 w-full max-w-lg mx-auto"
        onClick={handleBackgroundClick}
      >
        {/* Header */}
        <div className="w-full grid grid-cols-[auto_1fr_auto] items-center mb-8 gap-4">
          <div className="flex items-center gap-2 justify-self-start">
             <button 
                onClick={() => setShowResetConfirm(true)}
                className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors border border-slate-700 shadow-lg"
              >
                <Home size={20} />
              </button>
          </div>
          
          <div className="flex flex-col items-center justify-self-center relative">
             <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-1">
               {isLevelMode ? `Level ${currentLevel.label}` : 'Current Score'}
             </span>
             <div className="relative">
                <span className="text-5xl font-mono font-black text-white tracking-tighter drop-shadow-2xl leading-none">
                  {score.toLocaleString()}
                </span>
                {comboCount > 1 && (
                  <div className="absolute -right-8 -top-4 rotate-12 flex items-center justify-center bg-yellow-500 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full animate-bounce shadow-lg ring-2 ring-white/20">
                      x{comboCount}
                  </div>
                )}
             </div>
          </div>
          
          {/* Right Side: Best Score (Infinite) OR Target (Level) */}
          <div className="flex flex-col items-end justify-self-end bg-slate-900/50 p-2 pr-3 pl-4 rounded-xl border border-slate-800/50 backdrop-blur-sm">
             {isLevelMode ? (
               <div className="flex flex-col items-end">
                 <div className="flex items-center gap-1.5 text-yellow-500 mb-0.5">
                    <Crown size={14} fill="currentColor" />
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Goal</span>
                 </div>
                 <span className="text-lg font-mono font-bold text-yellow-500">
                    {target1.toLocaleString()}
                 </span>
               </div>
             ) : (
               <>
                <div className="flex items-center gap-1.5 text-yellow-500 mb-0.5">
                    <Crown size={14} fill="currentColor" className="drop-shadow-glow" />
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Best</span>
                </div>
                <span className="text-xl font-mono font-bold leading-none bg-clip-text text-transparent bg-gradient-to-b from-yellow-300 to-amber-500 drop-shadow-sm">
                  {currentBestScore.toLocaleString()}
                </span>
               </>
             )}
          </div>
        </div>

        {/* Level Progress Bar */}
        {isLevelMode && (
          <div className="w-full max-w-[85vw] mb-6 relative h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
             <div 
               className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
               style={{ width: `${progressPercent}%` }}
             />
             {/* Crown Markers */}
             {[1/2, 1.5/2, 1].map((p, i) => (
                <div 
                  key={i} 
                  className="absolute top-0 bottom-0 w-0.5 bg-white/20 flex flex-col items-center justify-center overflow-visible"
                  style={{ left: `${p * 100}%` }}
                >
                  <Crown size={10} className={`absolute -top-1 ${score >= [target1, target2, target3][i] ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`} />
                </div>
             ))}
          </div>
        )}
  
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
                    className={`relative w-full h-full ${isClearing ? 'animate-clear z-10' : ''} transition-all duration-300`}
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
  
          {/* Level Complete Overlay */}
          {levelResult && levelResult.success && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center rounded-xl z-20 animate-in zoom-in-95 duration-300">
               <div className="flex gap-2 mb-6 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <Crown 
                      key={i} 
                      size={40} 
                      className={`${i <= levelResult.crowns ? 'text-yellow-400 fill-yellow-400 drop-shadow-glow' : 'text-slate-700'}`} 
                    />
                  ))}
               </div>
               <h2 className="text-3xl font-black text-white mb-2">LEVEL CLEARED!</h2>
               <div className="text-lg text-slate-300 mb-8 font-mono">Score: {score.toLocaleString()}</div>
               
               <div className="flex flex-col gap-3 w-3/4">
                 <button 
                   onClick={() => setView('level-select')}
                   className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95"
                 >
                   <ListOrdered size={18} />
                   Select Level
                 </button>
                 <button 
                   onClick={() => startNewGame('level', currentLevel)}
                   className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-xl font-bold transition-all"
                 >
                   <RotateCw size={18} />
                   Replay
                 </button>
               </div>
            </div>
          )}

          {/* Game Over / Fail Overlay */}
          {isGameOver && !levelResult && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center rounded-xl z-20 animate-in zoom-in-95 duration-300">
              {isNewHighScore ? (
                <div className="flex flex-col items-center animate-bounce mb-2">
                  <Crown size={48} className="text-yellow-400 fill-yellow-400/20" />
                  <span className="text-yellow-400 font-black tracking-widest text-lg drop-shadow-glow">NEW BEST!</span>
                </div>
              ) : (
                <AlertCircle size={48} className="text-red-500 mb-4" />
              )}
              
              <h2 className="text-3xl font-black text-white mb-2">
                {isLevelMode ? 'LEVEL FAILED' : 'GAME OVER'}
              </h2>
              
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
                  onClick={() => startNewGame(gameMode, currentLevel || undefined)}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95"
                >
                  <RefreshCw size={18} />
                  Try Again
                </button>
                <button 
                  onClick={() => isLevelMode ? setView('level-select') : setView('home')}
                  className="text-slate-500 hover:text-white text-sm font-bold py-2 transition-colors"
                >
                  {isLevelMode ? 'Back to Levels' : 'Back to Menu'}
                </button>
              </div>
            </div>
          )}

          {/* Reset Confirmation Overlay */}
          {showResetConfirm && (
             <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-30 p-6 text-center animate-in fade-in duration-200">
               <h2 className="text-xl font-bold text-white mb-2">Quit Game?</h2>
               <p className="text-slate-400 mb-6 text-sm">Progress will be lost.</p>
               <div className="flex flex-col gap-3 w-full">
                 <button 
                   onClick={() => startNewGame(gameMode, currentLevel || undefined)}
                   className="w-full py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg"
                 >
                   Restart
                 </button>
                 <button 
                   onClick={() => setView('home')}
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
        </div>
  
        {/* Tools & Shape Tray */}
        <div className="w-full max-w-md flex flex-col gap-4">
           <div className="flex justify-between items-center px-4">
             <div className="flex gap-4">
               <button 
                 onClick={handleUndo} 
                 disabled={history.length === 0 || !!clearingLines || showResetConfirm || undoLeft <= 0 || !!levelResult}
                 className="relative group p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-all active:scale-95 border border-slate-700/50"
               >
                 <RotateCcw size={20} />
                 <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full border-2 border-slate-950">{undoLeft}</span>
               </button>
               <button 
                 onClick={handleRedo} 
                 disabled={redoStack.length === 0 || !!clearingLines || showResetConfirm || isGameOver || redoLeft <= 0 || !!levelResult}
                 className="relative group p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-all active:scale-95 border border-slate-700/50"
               >
                 <RotateCw size={20} />
                 <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full border-2 border-slate-950">{redoLeft}</span>
               </button>
               <button 
                 onClick={handleRefresh} 
                 disabled={!!clearingLines || showResetConfirm || isGameOver || refreshLeft <= 0 || !!levelResult}
                 className="relative group p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-all active:scale-95 border border-slate-700/50"
               >
                 <Shuffle size={20} />
                 <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full border-2 border-slate-950">{refreshLeft}</span>
               </button>
             </div>
  
             <button 
                onClick={handleHint}
                disabled={isGameOver || availableShapes.length === 0 || showResetConfirm || !!clearingLines || hintLeft <= 0 || !!levelResult}
                className="relative flex items-center gap-2 px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-xl disabled:opacity-30 disabled:bg-transparent transition-all border border-yellow-500/20 active:scale-95"
              >
                <Lightbulb size={18} className={hint ? "fill-yellow-500" : ""} />
                <span className="font-bold text-sm">HINT</span>
                <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">{hintLeft}</span>
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
            <div className="text-center text-xs text-yellow-500 animate-pulse font-bold">Check the board!</div>
          )}
        </div>
  
        <div 
          ref={floatingShapeRef}
          style={{ position: 'fixed', left: 0, top: 0, transform: 'translate(0,0)', pointerEvents: 'none', zIndex: 50, opacity: 0, transformOrigin: '50% 50%' }}
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
  };

  const renderLeaderboard = () => (
    <div className="flex flex-col items-center min-h-screen p-4 w-full max-w-md mx-auto animate-in slide-in-from-right duration-300">
      <div className="w-full flex items-center justify-between mb-8">
        <button onClick={() => setView('home')} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ArrowLeft size={24} /></button>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><ListOrdered className="text-purple-500" /> My Best Scores</h2>
        {leaderboard.length > 0 ? (
          <button onClick={clearLeaderboard} className="p-2 bg-slate-800 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"><Trash2 size={20} /></button>
        ) : <div className="w-10"></div>}
      </div>

      <div className="w-full bg-slate-900 rounded-2xl p-4 shadow-xl border border-slate-800 flex flex-col max-h-[70vh]">
        {leaderboard.length === 0 ? (
          <div className="text-center py-12 text-slate-500 italic flex flex-col items-center gap-4">
            <Trophy size={48} className="text-slate-700" />
            <p>No games played on this device yet.</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {leaderboard.map((record, i) => {
              const dateObj = new Date(record.timestamp);
              return (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${i === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-transparent border border-yellow-500/30' : i === 1 ? 'bg-slate-800/80 border border-slate-700' : i === 2 ? 'bg-slate-800/50 border border-slate-800' : 'bg-transparent border-b border-slate-800'}`}>
                  <div className="flex items-center gap-4">
                     <div className={`w-8 h-8 flex items-center justify-center rounded-full font-black text-sm shrink-0 ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-slate-400 text-black' : i === 2 ? 'bg-orange-700 text-white' : 'text-slate-500'}`}>{i + 1}</div>
                     <div className="flex flex-col">
                        <span className="text-slate-200 font-mono text-lg leading-tight">{record.score.toLocaleString()}</span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500"><Calendar size={10} /><span>{dateObj.toLocaleDateString()}</span></div>
                     </div>
                  </div>
                  {i === 0 && <Trophy size={16} className="text-yellow-500" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-slate-950 min-h-screen text-slate-200 font-sans selection:bg-blue-500/30 touch-none overflow-hidden">
      {view === 'home' && renderHome()}
      {view === 'leaderboard' && renderLeaderboard()}
      {view === 'chapter-select' && renderChapterSelect()}
      {view === 'level-select' && renderLevelSelect()}
      {view === 'game' && renderGame()}
    </div>
  );
};

export default App;
