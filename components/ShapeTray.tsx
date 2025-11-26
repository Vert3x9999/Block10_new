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
    <div className="flex justify-center items-center gap-4 w-full max-w-md h-32 mt-4 px-2 touch-none select-none">
      {shapes.map((shape, idx) => {
        const isSelected = selectedIndex === idx;
        const isDragging = draggingIndex === idx;
        
        // Base cell size for tray rendering
        const trayCellSize = 18;

        return (
          <div
            key={`${shape.id}-${idx}`} // Use index in key to ensure re-render if matrix updates inplace or position shifts
            onPointerDown={(e) => {
              // Prevent default browser drag behavior
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
                  ? 'bg-white dark:bg-zinc-700 ring-4 ring-blue-400/50 dark:ring-blue-500/50 shadow-xl scale-110 border-blue-200 dark:border-transparent z-10' 
                  : 'bg-white/50 dark:bg-zinc-800/60 hover:bg-white/80 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-700/50 shadow-sm'}
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
         <div className="text-zinc-400 dark:text-zinc-500 text-sm italic animate-pulse">Refilling...</div>
      )}
    </div>
  );
};

export default React.memo(ShapeTray);