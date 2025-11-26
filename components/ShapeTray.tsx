
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
            key={shape.id}
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
              w-20 h-20 rounded-xl transition-all duration-200 transform cursor-grab active:cursor-grabbing
              ${isSelected ? 'bg-slate-700 ring-2 ring-white shadow-lg shadow-white/10' : 'bg-slate-800/50 hover:bg-slate-800'}
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
         <div className="text-slate-500 text-sm italic animate-pulse">Refilling...</div>
      )}
    </div>
  );
};

export default React.memo(ShapeTray);
