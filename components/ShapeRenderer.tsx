import React from 'react';
import { ShapeDefinition } from '../types';

interface ShapeRendererProps {
  matrix: ShapeDefinition;
  color: string;
  cellSize?: number; // Size of one block in px for the output
  className?: string;
}

const ShapeRenderer: React.FC<ShapeRendererProps> = ({ matrix, color, cellSize = 20, className = '' }) => {
  const rows = matrix.length;
  const cols = matrix[0].length;
  
  // We use a fixed internal coordinate system (20 units per block) for the SVG viewBox
  // and scale it via width/height props
  const width = cols * cellSize;
  const height = rows * cellSize;

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox={`0 0 ${cols * 20} ${rows * 20}`} 
      className={className}
      style={{ overflow: 'visible', pointerEvents: 'none' }}
    >
      {matrix.map((row, r) => 
        row.map((cell, c) => {
          if (cell === 1) {
            return (
              <rect
                key={`${r}-${c}`}
                x={c * 20}
                y={r * 20}
                width="18"
                height="18"
                rx="4" // Slightly rounder for polished look
                fill={color}
                stroke="rgba(0,0,0,0.1)"
                strokeWidth="1"
              />
            );
          }
          return null;
        })
      )}
    </svg>
  );
};

export default React.memo(ShapeRenderer);