import React from 'react';

interface GridCellProps {
  color: string | null;
  isGhost?: boolean;
  isHint?: boolean;
  isPlacement?: boolean;
  isValid?: boolean; // If ghost, is it a valid placement?
  onClick: () => void;
  onMouseEnter: () => void;
}

const GridCell: React.FC<GridCellProps> = ({ color, isGhost, isHint, isPlacement, isValid, onClick, onMouseEnter }) => {
  let opacity = 'opacity-100';
  let animation = '';
  let styleBackgroundColor: string | undefined = undefined;
  
  // Base style for empty cell:
  // Light: bg-zinc-100 with inner shadow for "slot" feel, darker border
  // Dark: bg-zinc-900 with inner shadow, subtle border
  let tailwindBgClass = 'bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 shadow-inner'; 

  if (isPlacement) {
    animation = 'animate-place';
  }

  if (isGhost) {
    if (isValid) {
      // Valid placement: semi-transparent shape color
      styleBackgroundColor = color || undefined;
      opacity = 'opacity-50'; 
      tailwindBgClass = 'shadow-none border-transparent'; // Remove slot effect for ghost
    } else {
      // Invalid placement: Distinct Red
      styleBackgroundColor = undefined;
      tailwindBgClass = 'bg-red-500/80 shadow-none border-red-600'; 
      opacity = 'opacity-100';
    }
  } else if (isHint) {
     styleBackgroundColor = color || undefined;
     animation = 'animate-pulse';
     opacity = 'opacity-70';
     tailwindBgClass = 'shadow-none border-transparent';
  } else if (color) {
     // Normal filled cell
     // Add a slight ring or bevel effect
     styleBackgroundColor = color;
     tailwindBgClass = 'shadow-sm border-black/5 dark:border-white/10 ring-1 ring-inset ring-white/20 dark:ring-white/10';
  }

  return (
    <div
      className={`
        w-full h-full rounded-[4px] 
        border 
        transition-all duration-150
        ${tailwindBgClass}
        ${opacity}
        ${animation}
      `}
      style={{ 
        backgroundColor: styleBackgroundColor,
        boxShadow: isHint ? `inset 0 0 10px 2px rgba(255,255,255,0.3)` : undefined
      }}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    />
  );
};

export default React.memo(GridCell);