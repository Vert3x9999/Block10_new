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
  
  // Default empty cell styling
  // Light: bg-slate-200 (distinct from white container)
  // Dark: bg-slate-800 (distinct from slate-900 container)
  let tailwindBgClass = 'bg-slate-200 dark:bg-slate-800'; 

  if (isPlacement) {
    animation = 'animate-place';
  }

  if (isGhost) {
    if (isValid) {
      // Valid placement: semi-transparent shape color
      styleBackgroundColor = color || undefined;
      opacity = 'opacity-50'; 
      tailwindBgClass = ''; // Inline style takes precedence
    } else {
      // Invalid placement: Distinct Red
      styleBackgroundColor = undefined;
      tailwindBgClass = 'bg-red-500/80'; 
      opacity = 'opacity-100';
    }
  } else if (isHint) {
     styleBackgroundColor = color || undefined;
     animation = 'animate-pulse';
     opacity = 'opacity-70';
     tailwindBgClass = '';
  } else if (color) {
     // Normal filled cell
     styleBackgroundColor = color;
     tailwindBgClass = '';
  }

  return (
    <div
      className={`
        w-full h-full rounded-sm 
        border 
        border-slate-300 dark:border-slate-700/50 
        transition-colors duration-150
        ${tailwindBgClass}
        ${opacity}
        ${animation}
      `}
      style={{ 
        backgroundColor: styleBackgroundColor,
        boxShadow: isHint ? `inset 0 0 10px 2px rgba(255,255,255,0.3)` : 'none'
      }}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    />
  );
};

export default React.memo(GridCell);