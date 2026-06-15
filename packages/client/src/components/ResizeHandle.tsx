import React from 'react';

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ onMouseDown, className }) => (
  <div
    onMouseDown={onMouseDown}
    className={`w-1 shrink-0 cursor-col-resize select-none hover:bg-primary/30 active:bg-primary/50 transition-colors ${className ?? ''}`}
    aria-hidden
  />
);
