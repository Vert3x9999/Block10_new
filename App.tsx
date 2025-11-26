
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GridType, ShapeObj, Position, GameState, LevelConfig, LevelProgress, Inventory, Souvenir } from './types';
import { SHAPE_COLORS, BOARD_SIZE, SHAPES, CHAPTERS, SOUVENIRS, SHOP_PRICES } from './constants';
import { createEmptyGrid, canPlaceShape, placeShapeOnGrid, findClearedLines, clearLines, checkGameOver, findBestMove, rotateShapeMatrix } from './utils/gameLogic';
import { playPlaceSound, playClearSound, playGameOverSound, playShuffleSound, playLevelWinSound, playLevelFailSound } from './utils/soundEffects';
import GridCell from './components/GridCell';
import ShapeTray from './components/ShapeTray';
import ShapeRenderer from './components/ShapeRenderer';
import { Trophy, RefreshCw, AlertCircle, Lightbulb, RotateCcw, RotateCw, Play, Home, ListOrdered, ArrowLeft, History, Trash2, Calendar, Crown, Shuffle, Map as MapIcon, Star, Lock, CheckCircle2, Package, Gift, Hourglass, Box, Compass, Gem, Scroll, Key, Infinity as InfinityIcon, X, HelpCircle, Coins, ShoppingBag, HeartPulse, Backpack } from 'lucide-react';

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

type ViewState = 'home' | 'game' | 'leaderboard' | 'chapter-select' | 'level-select' | 'souvenirs';
type GameMode = 'infinite' | 'level';

// Icon mapping for Souvenirs
const IconMap: {[key: string]: React.ElementType} = {
  box: Box,
  compass: Compass,
  gem: Gem,
  scroll: Scroll,
  star: Star,
  key: Key,
  hourglass: Hourglass,
  trophy: Trophy,
  infinity: InfinityIcon,
  crown: Crown
};

const App: React.FC = () => {
  // --- View State ---
  const [view, setView] = useState<ViewState>('home');
  const [gameMode, setGameMode] = useState<GameMode>('infinite');

  // --- Game State ---
  const [grid, setGrid] = useState<GridType>(createEmptyGrid());
  const [score, setScore] = useState<number>(0);
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false);
  const [movesLeft, setMovesLeft] = useState<number>(0);
  
  // Level Mode State
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [currentLevel, setCurrentLevel] = useState<LevelConfig | null>(null);
  const [levelProgress, setLevelProgress] = useState<LevelProgress>(() => {
    try {
      const saved = localStorage.getItem('blockfit-level-progress');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [levelResult, setLevelResult] = useState<{success: boolean, crowns: number, rewards?: string[], coinsEarned?: number} | null>(null);
  const [claimedLevelRewards, setClaimedLevelRewards] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('blockfit-claimed-rewards');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Meta System (Inventory, Daily, Souvenirs)
  const [inventory, setInventory] = useState<Inventory>(() => {
    try {
      const saved = localStorage.getItem('blockfit-inventory');
      const parsed = saved ? JSON.parse(saved) : {};
      return {
        hints: parsed.hints ?? 5,
        undos: parsed.undos ?? 5,
        refreshes: parsed.refreshes ?? 5,
        rotators: parsed.rotators ?? 5,
        coins: parsed.coins ?? 500,
        revives: parsed.revives ?? 1
      };
    } catch { return { hints: 5, undos: 5, refreshes: 5, rotators: 5, coins: 500, revives: 1 }; }
  });

  // Separate inventory for infinite mode (resets every game)
  const [infiniteInventory, setInfiniteInventory] = useState<Inventory>({ hints: 3, undos: 3, refreshes: 3, rotators: 3, coins: 0, revives: 0 });

  const [unlockedSouvenirs, setUnlockedSouvenirs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('blockfit-souvenirs');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [lastCheckIn, setLastCheckIn] = useState<string | null>(() => {
     return localStorage.getItem('blockfit-last-checkin');
  });

  // Calendar State
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [checkInHistory, setCheckInHistory] = useState<string[]>(() => {
     try {
       const saved = localStorage.getItem('blockfit-checkin-history');
       return saved ? JSON.parse(saved) : [];
     } catch { return []; }
  });

  // Souvenir Detail State
  const [selectedSouvenir, setSelectedSouvenir] = useState<Souvenir | null>(null);

  const [showDailyReward, setShowDailyReward] = useState<boolean>(false);
  const [dailyRewardItems, setDailyRewardItems] = useState<string[]>([]);
  
  // Shop State
  const [showShop, setShowShop] = useState<boolean>(false);
  
  // Inventory Modal State
  const [showInventory, setShowInventory] = useState<boolean>(false);

  // Revive State
  const [showRevivePrompt, setShowRevivePrompt] = useState<boolean>(false);

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<ScoreRecord[]>(() => {
    try {
      const saved = localStorage.getItem('blockfit-leaderboard');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
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

  // Dragging Refs
  const dragInfoRef = useRef<DragInfo | null>(null);
  const floatingShapeRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Undo/Redo Stacks
  const [history, setHistory] = useState<GameState[]>([]);
  
  // --- Persistence Wrappers ---
  const updateGlobalInventory = (type: keyof Inventory, amount: number) => {
    setInventory(prev => {
      const next = { ...prev, [type]: prev[type] + amount };
      localStorage.setItem('blockfit-inventory', JSON.stringify(next));
      return next;
    });
  };
  
  const updateClaimedRewards = (levelId: string) => {
     setClaimedLevelRewards(prev => {
        const next = [...prev, levelId];
        localStorage.setItem('blockfit-claimed-rewards', JSON.stringify(next));
        return next;
     });
  };

  const updateInfiniteInventory = (type: keyof Inventory, amount: number) => {
    setInfiniteInventory(prev => ({ ...prev, [type]: prev[type] + amount }));
  };

  const useInventoryItem = (type: keyof Inventory) => {
    if (gameMode === 'infinite') {
      updateInfiniteInventory(type, -1);
    } else {
      updateGlobalInventory(type, -1);
    }
  };

  const getCurrentInventory = (type: keyof Inventory) => {
    return gameMode === 'infinite' ? infiniteInventory[type] : inventory[type];
  };

  const unlockSouvenir = (id: string) => {
    if (!unlockedSouvenirs.includes(id)) {
      const next = [...unlockedSouvenirs, id];
      setUnlockedSouvenirs(next);
      localStorage.setItem('blockfit-souvenirs', JSON.stringify(next));
    }
  };

  const registerCheckIn = () => {
    const today = new Date().toDateString();
    setCheckInHistory(prev => {
      if (!prev.includes(today)) {
        const next = [...prev, today];
        localStorage.setItem('blockfit-checkin-history', JSON.stringify(next));
        return next;
      }
      return prev;
    });
    setLastCheckIn(today);
    localStorage.setItem('blockfit-last-checkin', today);
  };

  // --- Helpers ---
  const generateNewShapes = useCallback(() => {
    const newShapes: ShapeObj[] = [];
    const shapePool = SHAPES;

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
      
      // Check for Chapter Completion Souvenir
      const chapter = CHAPTERS.find(c => c.levels.some(l => l.id === levelId));
      if (chapter) {
         const allCleared = chapter.levels.every(l => (newProgress[l.id] || 0) > 0);
         if (allCleared) {
            unlockSouvenir(chapter.souvenirId);
         }
      }
    }
  };

  const clearLeaderboard = () => {
    if (confirm('Are you sure you want to clear all history?')) {
      setLeaderboard([]);
      localStorage.removeItem('blockfit-leaderboard');
    }
  };

  const startNewGame = (mode: GameMode, level?: LevelConfig | null) => {
    setGameMode(mode);
    setCurrentLevel(level || null);
    setMovesLeft(level ? level.maxMoves : 0);
    
    // Reset Infinite Inventory
    setInfiniteInventory({ hints: 3, undos: 3, refreshes: 3, rotators: 3, coins: 0, revives: 0 });
    
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
    setComboCount(0);
    setShowRevivePrompt(false);
    dragInfoRef.current = null;
    setIsDragging(false);
    
    // Ensure overlays are closed
    setShowResetConfirm(false);
    setShowDailyReward(false);
    setShowShop(false);
    setShowInventory(false);
    
    setView('game');
  };

  const calculateCrowns = (currentScore: number, target: number) => {
    if (currentScore >= target * 2) return 3;
    if (currentScore >= target * 1.5) return 2;
    if (currentScore >= target) return 1;
    return 0;
  };

  const handleDailyCheckIn = () => {
     const today = new Date().toDateString();
     if (lastCheckIn !== today) {
        const streak = checkInHistory.length;
        const dayInCycle = (streak % 7) + 1; // 1 to 7

        const rewards: string[] = [];
        
        if (dayInCycle === 7) {
            // Day 7: Big Reward
            updateGlobalInventory('revives', 1);
            rewards.push('+1 Revive');
            updateGlobalInventory('coins', 200);
            rewards.push('+200 Coins');
        } else {
            // Normal Days
            const rand = Math.random();
            if (rand < 0.25) { updateGlobalInventory('hints', 1); rewards.push('+1 Hint'); }
            else if (rand < 0.5) { updateGlobalInventory('undos', 1); rewards.push('+1 Undo'); }
            else if (rand < 0.75) { updateGlobalInventory('refreshes', 1); rewards.push('+1 Shuffle'); }
            else { updateGlobalInventory('rotators', 1); rewards.push('+1 Rotate'); }
            
            updateGlobalInventory('coins', 50);
            rewards.push('+50 Coins');
        }

        setDailyRewardItems(rewards);
        setShowDailyReward(true);
        registerCheckIn();
     }
  };
  
  const handleBuyItem = (item: keyof typeof SHOP_PRICES) => {
      const price = SHOP_PRICES[item];
      if (inventory.coins >= price) {
          updateGlobalInventory('coins', -price);
          updateGlobalInventory(item as keyof Inventory, 1);
          playLevelWinSound(); // Ca-ching!
      } else {
          playLevelFailSound(); // Error sound
      }
  };
  
  const handleUseRevive = () => {
      if (inventory.revives > 0) {
          updateGlobalInventory('revives', -1);
          setMovesLeft(prev => prev + 7);
          generateNewShapes();
          setShowRevivePrompt(false);
          playLevelWinSound(); // Resurrection sound
      }
  };

  const processLevelWin = (crowns: number) => {
      if (!currentLevel) return;
      
      const levelNum = parseInt(currentLevel.label);
      const rewards: string[] = [];
      let coinsEarned = currentLevel.coinReward || 0;
      
      // Always give coins for clearing
      updateGlobalInventory('coins', coinsEarned);
      
      // Check for One-Time Rewards (every 5 levels)
      if (!claimedLevelRewards.includes(currentLevel.id)) {
          if (levelNum % 5 === 0) {
             updateGlobalInventory('refreshes', 1);
             rewards.push('+1 Shuffle');
             updateClaimedRewards(currentLevel.id);
             if (levelNum % 10 === 0) {
                 updateGlobalInventory('undos', 1);
                 rewards.push('+1 Undo');
             }
          }
      }
      
      setLevelResult({ success: true, crowns, rewards: rewards.length > 0 ? rewards : undefined, coinsEarned });
      saveLevelProgress(currentLevel.id, crowns);
      playLevelWinSound();
  };

  // --- Initialization ---
  useEffect(() => {
    if (view === 'game' && availableShapes.length === 0 && !isGameOver && !levelResult && !showRevivePrompt) {
      generateNewShapes();
    }
  }, [view, availableShapes, isGameOver, levelResult, showRevivePrompt, generateNewShapes]);

  // --- Game Over Check ---
  useEffect(() => {
    if (view !== 'game' || isGameOver || levelResult || showRevivePrompt) return;
    
    // Level Mode: Check Moves
    if (gameMode === 'level' && currentLevel && movesLeft <= 0 && !clearingLines) {
        const crowns = calculateCrowns(score, currentLevel.targetScore);
        if (crowns >= 1) {
            processLevelWin(crowns);
        } else {
            setShowRevivePrompt(true); // Prompt Revive instead of immediate fail
        }
        return;
    }

    if (availableShapes.length === 0 && !clearingLines) return;

    // Standard Grid Lock Check
    if (availableShapes.length > 0 && !clearingLines) {
      const matrices = availableShapes.map(s => s.matrix);
      const over = checkGameOver(grid, matrices);
      if (over) {
        if (gameMode === 'infinite') {
          setIsGameOver(true);
          saveScoreToLeaderboard(score);
          playGameOverSound();
        } else if (gameMode === 'level' && currentLevel) {
           const crowns = calculateCrowns(score, currentLevel.targetScore);
           if (crowns >= 1) {
              processLevelWin(crowns);
           } else {
              setShowRevivePrompt(true); // Prompt Revive
           }
        }
      }
    }
  }, [view, availableShapes, grid, clearingLines, isGameOver, score, gameMode, currentLevel, levelResult, movesLeft, showRevivePrompt]);


  // --- Core Placement Logic ---
  const attemptPlaceShape = useCallback((shapeIdx: number, r: number, c: number) => {
    if (clearingLines || levelResult || showRevivePrompt) return;
    
    const shapeObj = availableShapes[shapeIdx];
    if (!shapeObj) return;

    const canPlace = canPlaceShape(grid, shapeObj.matrix, { r, c });

    if (canPlace) {
      const currentState: GameState = {
        grid, score, availableShapes, isGameOver, comboCount, movesLeft
      };
      setHistory(prev => [...prev, currentState]);
      setHint(null);

      // Decrement Moves in Level Mode
      if (gameMode === 'level') {
         setMovesLeft(prev => Math.max(0, prev - 1));
      }

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
          
          // Instant Win Check (3 Crowns)
          if (gameMode === 'level' && currentLevel) {
            const crowns = calculateCrowns(finalNewScore, currentLevel.targetScore);
            if (crowns === 3) {
              processLevelWin(3);
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
        
        if (gameMode === 'level' && currentLevel) {
            const crowns = calculateCrowns(newScore, currentLevel.targetScore);
            if (crowns === 3) {
              processLevelWin(3);
            }
        }
      }
    }
  }, [grid, availableShapes, clearingLines, score, comboCount, isGameOver, gameMode, currentLevel, levelResult, movesLeft, showRevivePrompt]);

  // --- Interaction Handlers ---
  const handleSelectShape = (index: number) => {
    if (isGameOver || showResetConfirm || clearingLines || levelResult || showRevivePrompt) return;
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
    if (selectedShapeIdx === null || isGameOver || showResetConfirm || clearingLines || levelResult || showRevivePrompt) return;
    attemptPlaceShape(selectedShapeIdx, r, c);
    setSelectedShapeIdx(null);
    setHoverPos(null);
  }, [isDragging, selectedShapeIdx, isGameOver, showResetConfirm, clearingLines, levelResult, showRevivePrompt, attemptPlaceShape]);

  // --- Drag & Drop ---
  const handleDragStart = (index: number, e: React.PointerEvent, trayCellSize: number) => {
    if (isGameOver || showResetConfirm || clearingLines || levelResult || showRevivePrompt) return;

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
    
    if (clearingLines || levelResult || showRevivePrompt) {
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
  }, [availableShapes, clearingLines, levelResult, showRevivePrompt, attemptPlaceShape]);

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
    if (history.length === 0 || clearingLines || showResetConfirm || levelResult || showRevivePrompt) return;
    if (getCurrentInventory('undos') <= 0) return;

    const previousState = history[history.length - 1];
    setGrid(previousState.grid);
    setScore(previousState.score);
    setAvailableShapes(previousState.availableShapes);
    setIsGameOver(previousState.isGameOver);
    setIsNewHighScore(false);
    setComboCount(previousState.comboCount);
    setMovesLeft(previousState.movesLeft);

    setHistory(history.slice(0, -1));
    setSelectedShapeIdx(null);
    setHint(null);
    useInventoryItem('undos');
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGameOver || showResetConfirm || clearingLines || levelResult || showRevivePrompt) return;
    if (getCurrentInventory('refreshes') <= 0) return;
    playShuffleSound();
    generateNewShapes();
    useInventoryItem('refreshes');
    setSelectedShapeIdx(null);
    setHint(null);
  };

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGameOver || showResetConfirm || clearingLines || levelResult || showRevivePrompt) return;
    if (selectedShapeIdx === null) return;
    if (getCurrentInventory('rotators') <= 0) return;

    playShuffleSound(); 
    
    const newShapes = [...availableShapes];
    const shape = newShapes[selectedShapeIdx];
    shape.matrix = rotateShapeMatrix(shape.matrix);
    
    setAvailableShapes(newShapes);
    useInventoryItem('rotators');
    setHint(null);
  };

  const handleHint = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGameOver || availableShapes.length === 0 || showResetConfirm || clearingLines || levelResult || showRevivePrompt) return;
    if (getCurrentInventory('hints') <= 0) return;
    const bestMove = findBestMove(grid, availableShapes);
    if (bestMove) {
      setHint(bestMove);
      useInventoryItem('hints');
    }
  };

  // --- View Rendering ---

  const renderHome = () => {
    const today = new Date().toDateString();
    const isCheckedIn = lastCheckIn === today;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4 animate-in fade-in duration-500 relative">
        <div className="text-center space-y-2 mb-4">
          <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            Block10
          </h1>
          <p className="text-slate-400 text-sm tracking-[0.3em] uppercase font-semibold">
            10x10 Puzzle
          </p>
        </div>

        {/* Inventory Dashboard Button */}
        <button 
          onClick={() => setShowInventory(true)}
          className="w-full max-w-xs bg-slate-900/50 hover:bg-slate-800/80 transition-colors p-3 rounded-xl border border-slate-800 backdrop-blur-sm grid grid-cols-3 gap-2 text-xs font-mono mb-2 group active:scale-95"
        >
            <div className="flex flex-col items-center gap-1 text-yellow-500 group-hover:scale-110 transition-transform">
                <Coins size={16} />
                <span>{inventory.coins}</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-pink-500 group-hover:scale-110 transition-transform">
                <HeartPulse size={16} />
                <span>{inventory.revives}</span>
            </div>
            <div className="flex flex-col items-center gap-1 text-blue-400 group-hover:scale-110 transition-transform">
                <div className="flex gap-1">
                    <Lightbulb size={12} /> <RotateCcw size={12} />
                </div>
                <span>{inventory.hints + inventory.undos + inventory.refreshes + inventory.rotators} Items</span>
            </div>
        </button>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button 
            onClick={() => setView('chapter-select')}
            className="group relative flex items-center justify-center gap-3 w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-purple-500/25 transition-all hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <MapIcon fill="currentColor" size={24} />
            ADVENTURE MODE
          </button>

          <button 
            onClick={() => startNewGame('infinite')}
            className="group relative flex items-center justify-center gap-3 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <Play fill="currentColor" size={24} />
            INFINITE MODE
          </button>
          
          <div className="grid grid-cols-3 gap-3">
             <button 
              onClick={() => setShowShop(true)}
              className="group flex flex-col items-center justify-center gap-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl font-bold text-xs border-b-4 border-yellow-800 active:border-b-0 active:translate-y-1 transition-all"
            >
              <ShoppingBag size={20} />
              Shop
            </button>
            <button 
              onClick={() => setView('leaderboard')}
              className="group flex flex-col items-center justify-center gap-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs border border-slate-700 transition-all hover:scale-105 active:scale-95"
            >
              <History size={20} className="text-yellow-500" />
              Records
            </button>
            <button 
              onClick={() => setView('souvenirs')}
              className="group flex flex-col items-center justify-center gap-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs border border-slate-700 transition-all hover:scale-105 active:scale-95"
            >
              <Package size={20} className="text-pink-500" />
              Souvenirs
            </button>
          </div>
          
          <button 
            onClick={() => setShowCalendar(true)}
            className={`
              relative group flex items-center justify-center gap-3 w-full py-3 rounded-xl font-bold text-sm border transition-all hover:scale-105 active:scale-95
              ${!isCheckedIn 
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white border-green-500 shadow-lg shadow-green-500/20' 
                : 'bg-slate-900 text-slate-500 border-slate-800 opacity-80'}
            `}
          >
            <Calendar size={18} />
            {isCheckedIn ? 'Checked In' : 'Daily Check-in'}
            {!isCheckedIn && (
               <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            )}
          </button>

        </div>

        <div className="absolute bottom-4 text-slate-500 text-[10px] font-mono opacity-60">
          Author: Vertex Wei
        </div>

        {/* Inventory Detail Modal */}
        {showInventory && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
             <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl flex flex-col gap-4 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
                <div className="flex justify-between w-full items-center mb-2">
                   <h2 className="text-xl font-bold text-white flex items-center gap-2"><Backpack className="text-blue-500" /> My Inventory</h2>
                   <button onClick={() => setShowInventory(false)}><X className="text-slate-500 hover:text-white" /></button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800 p-3 rounded-xl flex items-center justify-between">
                       <div className="flex items-center gap-2 text-yellow-500 font-bold"><Coins size={20} /> Coins</div>
                       <span className="text-xl font-mono">{inventory.coins}</span>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-xl flex items-center justify-between">
                       <div className="flex items-center gap-2 text-pink-500 font-bold"><HeartPulse size={20} /> Revives</div>
                       <span className="text-xl font-mono">{inventory.revives}</span>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-xl flex items-center justify-between">
                       <div className="flex items-center gap-2 text-yellow-400 font-bold"><Lightbulb size={20} /> Hints</div>
                       <span className="text-xl font-mono">{inventory.hints}</span>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-xl flex items-center justify-between">
                       <div className="flex items-center gap-2 text-blue-400 font-bold"><RotateCcw size={20} /> Undos</div>
                       <span className="text-xl font-mono">{inventory.undos}</span>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-xl flex items-center justify-between">
                       <div className="flex items-center gap-2 text-green-500 font-bold"><Shuffle size={20} /> Shuffles</div>
                       <span className="text-xl font-mono">{inventory.refreshes}</span>
                    </div>
                    <div className="bg-slate-800 p-3 rounded-xl flex items-center justify-between">
                       <div className="flex items-center gap-2 text-purple-500 font-bold"><RefreshCw size={20} /> Rotates</div>
                       <span className="text-xl font-mono">{inventory.rotators}</span>
                    </div>
                </div>

                <button onClick={() => setShowInventory(false)} className="mt-2 w-full py-3 bg-slate-800 text-slate-400 rounded-xl font-bold">Close</button>
             </div>
          </div>
        )}

        {/* Shop Modal */}
        {showShop && (
           <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl flex flex-col gap-4 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
                 <div className="flex justify-between w-full items-center">
                   <h2 className="text-xl font-bold text-white flex items-center gap-2"><ShoppingBag className="text-yellow-500" /> Item Shop</h2>
                   <div className="flex items-center gap-1 text-yellow-400 font-mono text-sm bg-slate-800 px-2 py-1 rounded">
                      <Coins size={14} /> {inventory.coins}
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    {Object.entries(SHOP_PRICES).map(([item, price]) => (
                        <button 
                            key={item}
                            onClick={() => handleBuyItem(item as keyof typeof SHOP_PRICES)}
                            className="bg-slate-800 hover:bg-slate-700 p-3 rounded-xl flex flex-col items-center gap-2 border border-slate-700 active:scale-95 transition-all"
                        >
                            <div className="capitalize text-sm font-bold text-white">{item}</div>
                            <div className="text-xs text-yellow-500 flex items-center gap-1">
                                <Coins size={12}/> {price}
                            </div>
                        </button>
                    ))}
                 </div>
                 <button onClick={() => setShowShop(false)} className="mt-2 w-full py-3 bg-slate-800 text-slate-400 rounded-xl font-bold">Close</button>
              </div>
           </div>
        )}

        {/* Calendar Modal */}
        {showCalendar && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
             <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl flex flex-col items-center gap-4 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
                <div className="flex justify-between w-full items-center">
                   <h2 className="text-xl font-bold text-white flex items-center gap-2"><Calendar className="text-green-500" /> Daily Rewards</h2>
                   <button onClick={() => setShowCalendar(false)}><X className="text-slate-500 hover:text-white" /></button>
                </div>
                
                <div className="grid grid-cols-7 gap-2 w-full">
                  {Array.from({length: 30}, (_, i) => {
                    const day = i + 1;
                    const date = new Date();
                    date.setDate(date.getDate() - (date.getDate() - day)); 
                    const isToday = day === new Date().getDate();
                    const isChecked = checkInHistory.some(d => new Date(d).getDate() === day && new Date(d).getMonth() === new Date().getMonth());
                    const isBigReward = (i + 1) % 7 === 0;

                    return (
                      <div key={i} className={`
                        aspect-square rounded-lg flex flex-col items-center justify-center text-xs border relative
                        ${isToday ? 'border-green-500 bg-green-500/10' : 'border-slate-800 bg-slate-800/50'}
                        ${isChecked ? 'opacity-50' : ''}
                      `}>
                         <span className={isToday ? "text-green-400 font-bold" : "text-slate-400"}>{day}</span>
                         {isBigReward && <Gift size={12} className="text-yellow-500 mt-1" />}
                         {!isBigReward && !isChecked && <Coins size={10} className="text-slate-600 mt-1" />}
                         {isChecked && <CheckCircle2 size={12} className="text-green-500 mt-1" />}
                      </div>
                    )
                  })}
                </div>

                {!isCheckedIn ? (
                  <button 
                    onClick={handleDailyCheckIn}
                    className="mt-2 w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold shadow-lg shadow-green-500/20"
                  >
                    Check In Now
                  </button>
                ) : (
                  <div className="text-green-500 font-bold flex items-center gap-2 mt-2">
                    <CheckCircle2 /> Checked in today
                  </div>
                )}
             </div>
          </div>
        )}

        {/* Daily Reward Collect Overlay */}
        {showDailyReward && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in">
             <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl flex flex-col items-center gap-4 max-w-xs text-center shadow-2xl animate-in zoom-in-95">
                <Gift size={48} className="text-green-500 animate-bounce" />
                <h2 className="text-2xl font-black text-white">Daily Rewards!</h2>
                <div className="flex flex-col gap-2 bg-slate-800 w-full p-4 rounded-xl">
                   {dailyRewardItems.map((item, i) => (
                      <div key={i} className="font-bold text-yellow-400">{item}</div>
                   ))}
                </div>
                <button 
                  onClick={() => setShowDailyReward(false)}
                  className="mt-4 px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
                >
                  Collect
                </button>
             </div>
          </div>
        )}
      </div>
    );
  };

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
        {CHAPTERS.map(chapter => {
          const unlockedCount = chapter.levels.filter(l => (levelProgress[l.id] || 0) > 0).length;
          const totalLevels = chapter.levels.length;
          const isComplete = unlockedCount === totalLevels;

          return (
            <button
              key={chapter.id}
              onClick={() => {
                setCurrentChapterId(chapter.id);
                setView('level-select');
              }}
              className="relative flex flex-col gap-2 p-6 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-2xl text-left transition-all hover:scale-105 active:scale-95 shadow-xl overflow-hidden"
            >
              <div className="flex justify-between items-start z-10">
                 <div>
                    <h3 className="text-xl font-black text-white">{chapter.title}</h3>
                    <p className="text-slate-400 text-sm mt-1">{chapter.description}</p>
                 </div>
                 {isComplete && <CheckCircle2 className="text-green-500" size={24} />}
              </div>
              
              <div className="mt-4 flex items-center justify-between text-xs font-bold z-10">
                <span className="text-purple-400">15 LEVELS</span>
                <span className="text-slate-500">{unlockedCount} / {totalLevels} Completed</span>
              </div>
              
              {/* Progress Bar Background */}
              <div className="absolute bottom-0 left-0 h-1 bg-green-500/50" style={{ width: `${(unlockedCount/totalLevels)*100}%` }} />
            </button>
          );
        })}
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

        <div className="grid grid-cols-3 gap-4 w-full pb-8">
          {chapter.levels.map((level, i) => {
            const crowns = levelProgress[level.id] || 0;
            // First level always unlocked. Others unlocked if previous has > 0 crowns.
            const isUnlocked = i === 0 || (levelProgress[chapter.levels[i-1].id] || 0) > 0;
            const isRewardLevel = (i + 1) % 5 === 0;
            
            return (
              <button
                key={level.id}
                disabled={!isUnlocked}
                onClick={() => startNewGame('level', level)}
                className={`
                  relative aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all overflow-hidden
                  ${isUnlocked 
                    ? 'bg-slate-800 border-slate-600 hover:bg-slate-700 active:scale-95' 
                    : 'bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed'}
                `}
              >
                {/* Reward Indicator */}
                {isRewardLevel && (
                   <div className="absolute top-0 right-0 p-1">
                      <Gift size={12} className={crowns > 0 ? "text-slate-600" : "text-green-500 animate-pulse"} />
                   </div>
                )}
                
                {/* Coin Reward Label */}
                {isUnlocked && (
                  <div className="absolute bottom-1 flex items-center gap-0.5 text-[9px] text-yellow-500">
                     <Coins size={8} /> {level.coinReward}
                  </div>
                )}

                {!isUnlocked ? (
                  <Lock size={24} className="text-slate-600" />
                ) : (
                  <>
                    <span className="text-2xl font-black text-slate-200">{level.label}</span>
                    <div className="flex gap-0.5 mt-1 mb-2">
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

  const renderSouvenirs = () => {
    const totalSouvenirs = SOUVENIRS.length;
    const unlockedCount = unlockedSouvenirs.length;
    const progress = Math.round((unlockedCount / totalSouvenirs) * 100);

    return (
      <div className="flex flex-col items-center min-h-screen p-4 w-full max-w-md mx-auto animate-in slide-in-from-right duration-300">
        <div className="w-full flex items-center justify-between mb-8">
          <button onClick={() => setView('home')} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-2xl font-bold text-white">Collection</h2>
          <div className="w-10"></div>
        </div>

        {/* Collection Progress */}
        <div className="w-full bg-slate-900 rounded-xl p-4 mb-6 border border-slate-800">
           <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-slate-400">Total Progress</span>
              <span className="text-pink-400">{progress}%</span>
           </div>
           <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-pink-500 transition-all duration-1000" style={{width: `${progress}%`}} />
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full overflow-y-auto pb-4 custom-scrollbar">
          {SOUVENIRS.map(souvenir => {
              const isUnlocked = unlockedSouvenirs.includes(souvenir.id);
              const Icon = IconMap[souvenir.icon] || Box;

              return (
                <button 
                  key={souvenir.id} 
                  onClick={() => setSelectedSouvenir(souvenir)}
                  className={`
                    relative flex flex-col items-center p-6 rounded-2xl border transition-all duration-300 group
                    ${isUnlocked 
                      ? 'bg-slate-800 border-slate-700 hover:bg-slate-750 hover:border-slate-600 shadow-lg' 
                      : 'bg-slate-900 border-slate-800 opacity-80 cursor-default'}
                  `}
                >
                    <div className={`
                      w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-300
                      ${isUnlocked ? 'bg-slate-950 shadow-inner ring-1 ring-white/10' : 'bg-slate-950'}
                    `}>
                      {isUnlocked ? (
                          <Icon size={40} color={souvenir.color} className="drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" />
                      ) : (
                          <div className="relative">
                            <Icon size={40} className="text-slate-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.1)] blur-[1px]" />
                            <HelpCircle size={24} className="absolute inset-0 m-auto text-slate-700" />
                          </div>
                      )}
                    </div>
                    {isUnlocked && <div className="absolute top-2 right-2 text-yellow-500"><Star size={12} fill="currentColor"/></div>}
                    
                    {/* Souvenir Name Label */}
                    <div className={`mt-2 text-xs font-bold text-center px-2 line-clamp-1 ${isUnlocked ? 'text-slate-200' : 'text-slate-600'}`}>
                        {isUnlocked ? souvenir.name : '???'}
                    </div>
                </button>
              );
          })}
        </div>

        {/* Premium Souvenir Detail Modal */}
        {selectedSouvenir && (
           <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in">
              <div className="relative bg-slate-900 border border-slate-600 p-8 rounded-2xl flex flex-col items-center gap-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 mx-4 overflow-hidden">
                 
                 {/* Background Glow */}
                 <div 
                   className="absolute -top-20 -left-20 w-40 h-40 rounded-full blur-[80px] opacity-30 pointer-events-none"
                   style={{ backgroundColor: unlockedSouvenirs.includes(selectedSouvenir.id) ? selectedSouvenir.color : '#000' }}
                 />

                 <button onClick={() => setSelectedSouvenir(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white z-10">
                    <X size={24} />
                 </button>

                 {(() => {
                    const isUnlocked = unlockedSouvenirs.includes(selectedSouvenir.id);
                    const Icon = IconMap[selectedSouvenir.icon] || Box;
                    return (
                       <>
                          <div className={`
                             w-32 h-32 rounded-full flex items-center justify-center bg-slate-950 shadow-2xl ring-4 ring-slate-800
                             ${!isUnlocked ? 'grayscale opacity-50' : ''}
                          `}>
                             <Icon 
                               size={64} 
                               color={isUnlocked ? selectedSouvenir.color : '#333'} 
                               className={isUnlocked ? 'drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]' : ''} 
                             />
                          </div>

                          <div className="text-center space-y-2 z-10">
                             <h2 className="text-2xl font-black text-white">{isUnlocked ? selectedSouvenir.name : 'Unknown Artifact'}</h2>
                             <p className="text-slate-400 text-sm leading-relaxed">
                                {isUnlocked ? selectedSouvenir.description : 'Unlock this souvenir by completing specific chapters in Adventure Mode.'}
                             </p>
                          </div>
                          
                          <div className="w-full pt-4 border-t border-slate-800 flex justify-center">
                             {isUnlocked ? (
                                <span className="text-green-500 font-bold flex items-center gap-2 text-sm"><CheckCircle2 size={16}/> Acquired</span>
                             ) : (
                                <span className="text-slate-500 font-bold flex items-center gap-2 text-sm"><Lock size={16}/> Locked</span>
                             )}
                          </div>
                       </>
                    )
                 })()}
              </div>
           </div>
        )}
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
          
          {/* Right Side Info */}
          <div className="flex flex-col items-end justify-self-end bg-slate-900/50 p-2 pr-3 pl-4 rounded-xl border border-slate-800/50 backdrop-blur-sm min-w-[80px]">
             {isLevelMode ? (
               <div className="flex flex-col items-end">
                 <div className="flex items-center gap-1.5 text-blue-400 mb-0.5">
                    <RotateCw size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Moves</span>
                 </div>
                 <span className={`text-lg font-mono font-bold ${movesLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-blue-400'}`}>
                    {movesLeft}
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
          <div className="w-full max-w-[85vw] mb-6 relative h-6 bg-slate-800 rounded-full border border-slate-700 mt-2">
             <div 
               className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
               style={{ width: `${progressPercent}%` }}
             />
             {/* Crown Markers */}
             {[1/2, 1.5/2, 1].map((p, i) => {
                const targetVal = [target1, target2, target3][i];
                return (
                  <div 
                    key={i} 
                    className="absolute top-0 bottom-0 w-0.5 bg-white/20 flex flex-col items-center justify-center overflow-visible"
                    style={{ left: `${p * 100}%` }}
                  >
                    <div className="absolute -top-7 flex flex-col items-center z-10">
                       <Crown size={16} className={`mb-0.5 drop-shadow-md ${score >= targetVal ? 'text-yellow-400 fill-yellow-400' : 'text-slate-500'}`} />
                       <span className="text-[9px] font-mono font-bold text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">{targetVal}</span>
                    </div>
                  </div>
                );
             })}
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
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center rounded-xl z-20 animate-in zoom-in-95 duration-300 p-6 text-center">
               <div className="flex gap-2 mb-4 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <Crown 
                      key={i} 
                      size={40} 
                      className={`${i <= levelResult.crowns ? 'text-yellow-400 fill-yellow-400 drop-shadow-glow' : 'text-slate-700'}`} 
                    />
                  ))}
               </div>
               <h2 className="text-3xl font-black text-white mb-2">LEVEL CLEARED!</h2>
               <div className="text-lg text-slate-300 mb-2 font-mono">Score: {score.toLocaleString()}</div>
               {movesLeft > 0 && <div className="text-xs text-blue-400 mb-2">+{(movesLeft * 100).toLocaleString()} Move Bonus!</div>}
               {levelResult.coinsEarned && (
                  <div className="flex items-center gap-1 text-yellow-500 font-bold mb-4">
                     <Coins size={16} /> +{levelResult.coinsEarned}
                  </div>
               )}

               {/* Rewards Display */}
               {levelResult.rewards && (
                  <div className="mb-6 bg-slate-800/50 p-4 rounded-xl border border-slate-700 w-full">
                     <div className="text-xs font-bold uppercase text-slate-400 mb-2">Rewards Claimed</div>
                     <div className="flex flex-col gap-1">
                        {levelResult.rewards.map((r, i) => (
                           <div key={i} className="text-green-400 font-bold flex items-center justify-center gap-2">
                              <Gift size={14} /> {r}
                           </div>
                        ))}
                     </div>
                  </div>
               )}
               
               <div className="flex flex-col gap-3 w-full">
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

          {/* Revive Overlay */}
          {showRevivePrompt && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center rounded-xl z-30 animate-in zoom-in-95 duration-300 p-6 text-center">
                  <HeartPulse size={48} className="text-pink-500 animate-pulse mb-4" />
                  <h2 className="text-2xl font-black text-white mb-2">Out of Moves!</h2>
                  <p className="text-slate-400 mb-6">Use a Revive to get +7 Moves and refresh shapes?</p>
                  
                  <div className="flex flex-col gap-3 w-full">
                      <button 
                          onClick={handleUseRevive}
                          disabled={inventory.revives <= 0}
                          className="w-full py-4 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold shadow-lg shadow-pink-500/20 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                      >
                          <HeartPulse size={20} /> Use Revive ({inventory.revives})
                      </button>
                      <button 
                          onClick={() => { setShowRevivePrompt(false); setIsGameOver(true); playLevelFailSound(); }}
                          className="text-slate-500 hover:text-white font-bold py-2"
                      >
                          Give Up
                      </button>
                  </div>
              </div>
          )}

          {/* Game Over / Fail Overlay */}
          {isGameOver && !levelResult && !showRevivePrompt && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center rounded-xl z-20 animate-in zoom-in-95 duration-300 p-6 text-center">
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
                px-6 py-3 rounded-xl border mb-6 flex flex-col items-center
                ${isNewHighScore ? 'bg-yellow-500/10 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'bg-slate-800/50 border-slate-700'}
              `}>
                <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">Final Score</span>
                <span className={`text-3xl font-mono ${isNewHighScore ? 'text-yellow-400' : 'text-white'}`}>{score.toLocaleString()}</span>
              </div>

              {isLevelMode && (
                 <div className="text-slate-400 text-xs mb-6 max-w-xs">
                    Goal: {currentLevel?.targetScore.toLocaleString()} pts for 1 Crown
                 </div>
              )}
              
              <div className="flex flex-col gap-3 w-full">
                <button 
                  onClick={handleUndo}
                  disabled={history.length === 0 || getCurrentInventory('undos') <= 0}
                  className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                >
                  <RotateCcw size={18} />
                  Undo Last Move {getCurrentInventory('undos') > 0 && <span className="bg-black/20 px-1.5 py-0.5 rounded text-xs ml-1">{getCurrentInventory('undos')}</span>}
                </button>
                <button 
                  onClick={() => startNewGame(gameMode, currentLevel)}
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
                   onClick={() => startNewGame(gameMode, currentLevel)}
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
               {/* Undo */}
               <button 
                 onClick={handleUndo} 
                 disabled={history.length === 0 || !!clearingLines || showResetConfirm || getCurrentInventory('undos') <= 0 || !!levelResult || showRevivePrompt}
                 className="relative group p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-all active:scale-95 border border-slate-700/50"
               >
                 <RotateCcw size={20} />
                 <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full border-2 border-slate-950">{getCurrentInventory('undos')}</span>
               </button>
               
               {/* Rotate (Replaces Redo) */}
               <button 
                 onClick={handleRotate} 
                 disabled={selectedShapeIdx === null || !!clearingLines || showResetConfirm || isGameOver || getCurrentInventory('rotators') <= 0 || !!levelResult || showRevivePrompt}
                 className="relative group p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-all active:scale-95 border border-slate-700/50"
               >
                 <RefreshCw size={20} className={selectedShapeIdx !== null ? "animate-spin-once" : ""} />
                 <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-purple-600 text-white text-[10px] font-bold rounded-full border-2 border-slate-950">{getCurrentInventory('rotators')}</span>
               </button>
               
               {/* Refresh/Shuffle */}
               <button 
                 onClick={handleRefresh} 
                 disabled={!!clearingLines || showResetConfirm || isGameOver || getCurrentInventory('refreshes') <= 0 || !!levelResult || showRevivePrompt}
                 className="relative group p-3 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-all active:scale-95 border border-slate-700/50"
               >
                 <Shuffle size={20} />
                 <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full border-2 border-slate-950">{getCurrentInventory('refreshes')}</span>
               </button>
             </div>
  
             {/* Hint */}
             <button 
                onClick={handleHint}
                disabled={isGameOver || availableShapes.length === 0 || showResetConfirm || !!clearingLines || getCurrentInventory('hints') <= 0 || !!levelResult || showRevivePrompt}
                className="relative flex items-center gap-2 px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-xl disabled:opacity-30 disabled:bg-transparent transition-all border border-yellow-500/20 active:scale-95"
              >
                <Lightbulb size={18} className={hint ? "fill-yellow-500" : ""} />
                <span className="font-bold text-sm">HINT</span>
                <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">{getCurrentInventory('hints')}</span>
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
      {view === 'souvenirs' && renderSouvenirs()}
      {view === 'game' && renderGame()}
    </div>
  );
};

export default App;
