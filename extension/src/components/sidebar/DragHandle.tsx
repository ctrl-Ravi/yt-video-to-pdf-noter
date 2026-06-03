import React from 'react';

interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function DragHandle({ onPointerDown, onPointerMove, onPointerUp }: DragHandleProps) {
  return (
    <div
      className="w-full h-6 bg-secondary/80 hover:bg-secondary flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none gap-[2px] py-1 border-b shrink-0 transition-colors"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="w-8 h-[2px] bg-muted-foreground/40 rounded-full" />
      <div className="w-8 h-[2px] bg-muted-foreground/40 rounded-full" />
      <div className="w-8 h-[2px] bg-muted-foreground/40 rounded-full" />
    </div>
  );
}
