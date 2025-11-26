import React from 'react';
import { ShapeObj } from '../types';
import ShapeRenderer from './ShapeRenderer';

interface ShapeTrayProps {
  shapes: ShapeObj[];
  selectedIndex: number | null;
  draggingIndex: number | null;
  onSelectShape: (index: number) => void;
  onDragStart: (index: number, e: React.PointerEvent, cellSize: number) => void;
}

const ShapeTray: React.FC<ShapeTrayProps> = ({ shapes, selectedIndex, draggingIndex, onSelectShape, onDragStart }) => {
  return (
    <div className="flex justify-center items-center gap-4 w-full h-32 px-4 touch-none select-none">
      {shapes.map((shape, idx) => {
        const isSelected = selectedIndex === idx;
        const isDragging = draggingIndex === idx;
        
        // Base cell size for tray rendering
        const trayCellSize = 18;

        return (
          <div
            key={`${shape.id}-${idx}`} 
            onPointerDown={(e) => {
              e.preventDefault(); 
              onDragStart(idx, e, trayCellSize);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectShape(idx);
            }}
            className={`
              relative flex items-center justify-center
              w-20 h-20 rounded-2xl transition-all duration-200 transform cursor-grab active:cursor-grabbing border
              ${isSelected 
                  ? 'bg-white dark:bg-zinc-800 ring-4 ring-blue-500/30 dark:ring-blue-500/50 shadow-xl scale-110 border-blue-500 dark:border-blue-400 z-10' 
                  : 'bg-zinc-50 dark:bg-zinc-900 hover:bg-white dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-700 shadow-md hover:shadow-lg hover:-translate-y-1'}
              ${isDragging ? 'opacity-0' : 'opacity-100'}
            `}
          >
             <ShapeRenderer 
                matrix={shape.matrix} 
                color={shape.color} 
                cellSize={trayCellSize}
             />
          </div>
        );
      })}
      {shapes.length === 0 && (
         <div className="text-zinc-400 dark:text-zinc-600 text-sm font-bold tracking-widest animate-pulse uppercase">Refilling...</div>
      )}
    </div>
  );
};

export default React.memo(ShapeTray);