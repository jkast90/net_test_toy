/**
 * Canvas Overlay Pane Component
 * Reusable draggable/minimizable pane for canvas overlays
 * When minimized, snaps to bottom of canvas
 */

import React, { useState, useRef, useEffect } from 'react';

interface CanvasOverlayPaneProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  // Position offset from left when minimized (for multiple panes)
  minimizedOffset?: 'left' | 'center' | 'right';
  defaultSize?: { width: number; height: number };
  defaultPosition?: { x: number; y: number };
  // Optional actions to display in the header (before minimize/close buttons)
  headerActions?: React.ReactNode;
}

export const CanvasOverlayPane: React.FC<CanvasOverlayPaneProps> = ({
  title,
  isOpen,
  onClose,
  children,
  minimizedOffset = 'center',
  defaultSize = { width: 400, height: 300 },
  defaultPosition = { x: 20, y: 20 },
  headerActions
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState(defaultPosition);
  const [size, setSize] = useState(defaultSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const dragRef = useRef<HTMLDivElement | null>(null);

  // Handle mouse dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragRef.current) {
        const parent = dragRef.current.parentElement;
        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          const relativeX = e.clientX - parentRect.left - dragOffset.x;
          const relativeY = e.clientY - parentRect.top - dragOffset.y;
          const maxX = parentRect.width - size.width;
          const maxY = parentRect.height - size.height;
          const newX = Math.max(0, Math.min(maxX, relativeX));
          const newY = Math.max(0, Math.min(maxY, relativeY));
          setPosition({ x: newX, y: newY });
        }
      } else if (isResizing && dragRef.current) {
        const parent = dragRef.current.parentElement;
        const parentRect = parent?.getBoundingClientRect();
        const maxWidth = parentRect ? parentRect.width - position.x : 800;
        const maxHeight = parentRect ? parentRect.height - position.y : 600;

        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        const newWidth = Math.max(250, Math.min(maxWidth, resizeStart.width + deltaX));
        const newHeight = Math.max(150, Math.min(maxHeight, resizeStart.height + deltaY));

        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, size, position, resizeStart]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current && !isMinimized) {
      const rect = dragRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  if (!isOpen) return null;

  // Calculate minimized position based on offset
  const getMinimizedLeft = () => {
    switch (minimizedOffset) {
      case 'left': return '10px';
      case 'right': return 'auto';
      case 'center':
      default: return '50%';
    }
  };

  const getMinimizedRight = () => {
    return minimizedOffset === 'right' ? '10px' : 'auto';
  };

  const getMinimizedTransform = () => {
    return minimizedOffset === 'center' ? 'translateX(-50%)' : 'none';
  };

  const minimizedStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '10px',
    left: getMinimizedLeft(),
    right: getMinimizedRight(),
    transform: getMinimizedTransform(),
    width: '200px',
    height: 'auto',
    background: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    cursor: 'default'
  };

  const expandedStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${size.width}px`,
    height: `${size.height}px`,
    background: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    cursor: isDragging ? 'grabbing' : 'default'
  };

  return (
    <div
      ref={dragRef}
      style={isMinimized ? minimizedStyle : expandedStyle}
    >
      {/* Header */}
      <div
        onMouseDown={isMinimized ? undefined : handleMouseDown}
        style={{
          padding: '0.5rem 0.75rem',
          borderBottom: isMinimized ? 'none' : '1px solid #444',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#2a2a2a',
          borderRadius: isMinimized ? '6px' : '6px 6px 0 0',
          cursor: isMinimized ? 'default' : (isDragging ? 'grabbing' : 'grab')
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{title}</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {headerActions}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            style={{
              padding: '0.15rem 0.4rem',
              fontSize: '0.7rem',
              background: '#3a3a3a',
              border: '1px solid #555',
              borderRadius: '3px',
              color: '#fff',
              cursor: 'pointer'
            }}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.15rem 0.4rem',
              fontSize: '0.7rem',
              background: '#3a3a3a',
              border: '1px solid #555',
              borderRadius: '3px',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content - only show when not minimized */}
      {!isMinimized && (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      )}

      {/* Resize Handle - only show when not minimized */}
      {!isMinimized && (
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            setResizeStart({
              x: e.clientX,
              y: e.clientY,
              width: size.width,
              height: size.height
            });
            setIsResizing(true);
          }}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '15px',
            height: '15px',
            cursor: 'nwse-resize',
            background: 'linear-gradient(135deg, transparent 50%, #555 50%)',
            borderBottomRightRadius: '6px'
          }}
        />
      )}
    </div>
  );
};
