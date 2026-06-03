import React, { useEffect, useRef, useState } from 'react';
import { useSidebarStore } from '@/src/store/sidebar';
import { cn } from '@/src/lib/utils';
import { Layout } from './Layout';

const MIN_WIDTH = 300;
const MAX_WIDTH = 640;
const COMPACT_THRESHOLD = 320;
const DEFAULT_WIDTH = 400;

export const sidebarWidthStorage = storage.defineItem<number>('local:sidebarWidth', {
  defaultValue: DEFAULT_WIDTH,
});

export const sidebarPositionStorage = storage.defineItem<{ x: number; y: number }>('local:sidebarPosition', {
  defaultValue: { x: -1, y: -1 },
});

export function Shell() {
  const { isOpen, setIsCompact } = useSidebarStore();
  const [isInitialized, setIsInitialized] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  const widthRef = useRef(DEFAULT_WIDTH);
  const posRef = useRef({ x: 0, y: 0 });
  
  const isResizing = useRef(false);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });
  
  useEffect(() => {
    async function loadDimensions() {
      const savedWidth = await sidebarWidthStorage.getValue();
      widthRef.current = savedWidth;
      setIsCompact(savedWidth < COMPACT_THRESHOLD);
      
      const savedPos = await sidebarPositionStorage.getValue();
      
      if (containerRef.current) {
        let x = savedPos.x;
        let y = savedPos.y;
        
        if (x === -1 || y === -1) {
          // Default position: right-anchored, vertical center
          const height = containerRef.current.offsetHeight || 600;
          x = window.innerWidth - savedWidth - 20;
          y = Math.max(0, (window.innerHeight - height) / 2);
        }
        
        // Clamp it just in case screen size changed
        x = Math.max(0, Math.min(x, window.innerWidth - savedWidth));
        y = Math.max(0, Math.min(y, window.innerHeight - 60));
        
        posRef.current = { x, y };
        
        containerRef.current.style.width = `${savedWidth}px`;
        containerRef.current.style.left = `${x}px`;
        containerRef.current.style.top = `${y}px`;
      }
      setIsInitialized(true);
    }
    loadDimensions();
  }, [setIsCompact]);

  if (!isOpen) {
    return null;
  }

  // --- Resize Logic ---
  const handleResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isResizing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing.current || !containerRef.current) return;
    
    // Resize calculates from the right edge of the screen, or actually
    // if it's freely positioned, resizing from left edge should change width AND left position?
    // The prompt says "calculate new left/top from delta" for dragging. For resizing, we are resizing the left edge.
    // If we pull the left edge left, width increases, left position decreases.
    // Wait, the previous implementation calculated width from window.innerWidth, assuming it was fixed to the right.
    // Since it's now draggable, we must calculate width based on delta!
    
    const currentRightEdge = posRef.current.x + widthRef.current;
    let newWidth = currentRightEdge - e.clientX;
    const clampedWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH));
    
    widthRef.current = clampedWidth;
    posRef.current.x = currentRightEdge - clampedWidth;
    
    containerRef.current.style.width = `${clampedWidth}px`;
    containerRef.current.style.left = `${posRef.current.x}px`;
    
    const isCurrentlyCompact = clampedWidth < COMPACT_THRESHOLD;
    if (useSidebarStore.getState().isCompact !== isCurrentlyCompact) {
      setIsCompact(isCurrentlyCompact);
    }
  };

  const handleResizeUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing.current) return;
    isResizing.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    e.currentTarget.style.cursor = 'col-resize';
    document.body.style.userSelect = '';
    
    await sidebarWidthStorage.setValue(widthRef.current);
    await sidebarPositionStorage.setValue(posRef.current);
  };

  // --- Drag Logic ---
  const handleDragDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    dragRef.current.isDragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    
    const rect = containerRef.current.getBoundingClientRect();
    dragRef.current.initialLeft = rect.left;
    dragRef.current.initialTop = rect.top;
    
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging || !containerRef.current) return;
    
    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;
    
    let newLeft = dragRef.current.initialLeft + deltaX;
    let newTop = dragRef.current.initialTop + deltaY;
    
    const shellWidth = widthRef.current;
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - shellWidth));
    newTop = Math.max(0, Math.min(newTop, window.innerHeight - 60));
    
    posRef.current = { x: newLeft, y: newTop };
    
    containerRef.current.style.left = `${newLeft}px`;
    containerRef.current.style.top = `${newTop}px`;
  };

  const handleDragUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.userSelect = '';
    
    await sidebarPositionStorage.setValue(posRef.current);
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "fixed bg-background border shadow-2xl z-[2147483647] flex flex-row text-foreground rounded-xl overflow-hidden h-[min(800px,calc(100vh-40px))]",
        !isInitialized && "opacity-0 pointer-events-none" // Hide until initialized to prevent FOUC
      )}
      style={{ 
        width: `${widthRef.current}px`,
        // We set initial pos via style too if already initialized
        ...(isInitialized ? { left: `${posRef.current.x}px`, top: `${posRef.current.y}px` } : {})
      }}
    >
      {/* Resize Handle (Left edge) */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/20 hover:opacity-100 z-10 opacity-0 transition-opacity touch-none"
        onPointerDown={handleResizeDown}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        onPointerCancel={handleResizeUp}
      />
      
      {/* Layout – owns drag handle, header, and tab panels */}
      <div className="flex-1 overflow-hidden flex flex-col h-full w-full">
        <Layout
          onDragDown={handleDragDown}
          onDragMove={handleDragMove}
          onDragUp={handleDragUp}
        />
      </div>
    </div>
  );
}

