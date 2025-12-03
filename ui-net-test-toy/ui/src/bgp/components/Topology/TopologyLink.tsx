/**
 * Topology Link Component
 * Renders a single link (connection) between nodes on the topology canvas
 */

import React from 'react';
import { TopologyLink as TopologyLinkType, TopologyNode } from '../../types/topology';
import { useHoverDelete } from '../../hooks/useHoverDelete';

interface TopologyLinkProps {
  link: TopologyLinkType;
  sourceNode: TopologyNode | undefined;
  targetNode: TopologyNode | undefined;
  isHovered: boolean;
  isSelected: boolean;
  offset?: number; // Perpendicular offset for multiple links between same nodes
  onMouseEnter: (linkId: string) => void;
  onMouseLeave: () => void;
  onClick: (linkId: string) => void;
  onDelete: (linkId: string) => void;
  onArcDragStart?: (linkId: string) => void;
  onArcDrag?: (linkId: string, newArc: number) => void;
  onArcDragEnd?: (linkId: string, finalArc: number) => void;
}

// Helper function to calculate link midpoint (exported for use in tooltip layer)
export const calculateLinkMidpoint = (
  sourceNode: TopologyNode,
  targetNode: TopologyNode,
  offset: number = 0
): { midX: number; midY: number } => {
  const x1 = sourceNode.position.x;
  const y1 = sourceNode.position.y;
  const x2 = targetNode.position.x;
  const y2 = targetNode.position.y;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);

  const perpX = -dy / length;
  const perpY = dx / length;

  const offsetX = perpX * offset;
  const offsetY = perpY * offset;

  const controlX = (x1 + x2) / 2 + offsetX;
  const controlY = (y1 + y2) / 2 + offsetY;

  // Calculate actual midpoint on the curve (not the control point)
  // For quadratic Bezier at t=0.5: P(0.5) = 0.25*P0 + 0.5*P1 + 0.25*P2
  const t = 0.5;
  const midX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * controlX + t * t * x2;
  const midY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * controlY + t * t * y2;

  return { midX, midY };
};

export const TopologyLink: React.FC<TopologyLinkProps> = ({
  link,
  sourceNode,
  targetNode,
  isHovered,
  isSelected,
  offset = 0,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onDelete,
  onArcDragStart,
  onArcDrag,
  onArcDragEnd
}) => {
  const [isDraggingArc, setIsDraggingArc] = React.useState(false);
  const [showArcHandle, setShowArcHandle] = React.useState(false);
  const dragStartRef = React.useRef<{ x: number; y: number; initialArc: number } | null>(null);
  const hideTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Show arc handle immediately on hover, hide with 1s delay
  React.useEffect(() => {
    if (isHovered || isSelected || isDraggingArc) {
      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setShowArcHandle(true);
    } else {
      // Delay hiding by 1 second
      hideTimeoutRef.current = setTimeout(() => {
        setShowArcHandle(false);
      }, 1000);
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isHovered, isSelected, isDraggingArc]);

  if (!sourceNode || !targetNode) return null;

  const x1 = sourceNode.position.x;
  const y1 = sourceNode.position.y;
  const x2 = targetNode.position.x;
  const y2 = targetNode.position.y;

  // Calculate line direction and perpendicular
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy) || 1; // Avoid division by zero

  // Perpendicular unit vector (rotated 90 degrees counterclockwise)
  const perpX = -dy / length;
  const perpY = dx / length;

  // Determine if line is more vertical or horizontal
  const isVertical = Math.abs(dy) > Math.abs(dx);

  // Calculate offset along the perpendicular direction
  let offsetX: number;
  let offsetY: number;

  if (link.type === 'bgp' || link.type === 'gre') {
    // Use perpendicular offset for BGP/GRE links
    // Positive offset curves "left" of the line direction (counterclockwise)
    const sign = link.type === 'gre' ? -1 : 1; // GRE curves opposite direction
    offsetX = perpX * offset * sign;
    offsetY = perpY * offset * sign;
  } else {
    // Network links: use perpendicular offset
    offsetX = perpX * offset;
    offsetY = perpY * offset;
  }

  // Calculate control point for quadratic curve
  const controlX = (x1 + x2) / 2 + offsetX;
  const controlY = (y1 + y2) / 2 + offsetY;

  // Calculate midpoint for label (on the actual curve, not at the control point)
  // For quadratic Bezier at t=0.5: P(0.5) = 0.25*P0 + 0.5*P1 + 0.25*P2
  const t = 0.5;
  const midX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * controlX + t * t * x2;
  const midY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * controlY + t * t * y2;

  // Use hover delete hook
  const { showDeleteButton, deleteButtonProps } = useHoverDelete({
    isHovered,
    isSelected,
    enabled: true
  });

  // Create path string for quadratic curve
  const pathData = `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;

  return (
    <g>
      {/* Invisible thick path for easier clicking */}
      <path
        d={pathData}
        stroke="transparent"
        strokeWidth="20"
        fill="none"
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => onMouseEnter(link.id)}
        onMouseLeave={onMouseLeave}
        onClick={() => onClick(link.id)}
      />

      {/* Visible path */}
      <path
        d={pathData}
        stroke={
          link.type === 'bgp' ? '#FFC107' :
          link.type === 'gre' ? '#FF9800' :
          '#64B5F6'
        }
        strokeWidth={
          isHovered || isSelected ?
            (link.type === 'bgp' || link.type === 'gre' ? '5' : '4') :
            (link.type === 'bgp' || link.type === 'gre' ? '3' : '2')
        }
        strokeDasharray={
          link.type === 'bgp' ? '8,4' :
          link.type === 'gre' ? '12,6' :
          'none'
        }
        opacity={isHovered || isSelected ? 1 : 0.8}
        fill="none"
        style={{ pointerEvents: 'none', transition: 'all 0.2s' }}
      />

      {/* Label at midpoint */}
      {link.label && (() => {
        const lines = link.label.split('\n');
        const lineHeight = 14;
        const startY = midY + 5 - ((lines.length - 1) * lineHeight) / 2;

        return (
          <text
            x={midX}
            y={startY}
            fill="white"
            fontSize="12"
            textAnchor="middle"
            fontWeight={isHovered || isSelected ? 'bold' : 'normal'}
            style={{ pointerEvents: 'none' }}
          >
            {lines.map((line, i) => (
              <tspan
                key={i}
                x={midX}
                dy={i === 0 ? 0 : lineHeight}
              >
                {line}
              </tspan>
            ))}
          </text>
        );
      })()}

      {/* Source label at 1/3 from source */}
      {link.sourceLabel && (() => {
        const t = 0.33; // 1/3 from source
        const labelX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * controlX + t * t * x2;
        const labelY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * controlY + t * t * y2;
        const lines = link.sourceLabel.split('\n');
        const lineHeight = 14;
        const startY = labelY - ((lines.length - 1) * lineHeight) / 2;

        return (
          <text
            x={labelX}
            y={startY}
            fill="white"
            fontSize="11"
            textAnchor="middle"
            style={{ pointerEvents: 'none' }}
          >
            {lines.map((line, i) => (
              <tspan
                key={i}
                x={labelX}
                dy={i === 0 ? 0 : lineHeight}
              >
                {line}
              </tspan>
            ))}
          </text>
        );
      })()}

      {/* Target label at 1/3 from target */}
      {link.targetLabel && (() => {
        const t = 0.67; // 1/3 from target (2/3 from source)
        const labelX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * controlX + t * t * x2;
        const labelY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * controlY + t * t * y2;
        const lines = link.targetLabel.split('\n');
        const lineHeight = 14;
        const startY = labelY - ((lines.length - 1) * lineHeight) / 2;

        return (
          <text
            x={labelX}
            y={startY}
            fill="white"
            fontSize="11"
            textAnchor="middle"
            style={{ pointerEvents: 'none' }}
          >
            {lines.map((line, i) => (
              <tspan
                key={i}
                x={labelX}
                dy={i === 0 ? 0 : lineHeight}
              >
                {line}
              </tspan>
            ))}
          </text>
        );
      })()}

      {/* Delete button - visible on hover or selection */}
      {showDeleteButton && (
        <g {...deleteButtonProps}>
          <circle
            cx={midX}
            cy={midY + 25}
            r="12"
            fill="#f44336"
            style={{ cursor: 'pointer', pointerEvents: 'all' }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(link.id);
            }}
          />
          <text
            x={midX}
            y={midY + 31}
            fill="white"
            fontSize="16"
            fontWeight="bold"
            textAnchor="middle"
            style={{ pointerEvents: 'none' }}
          >
            ×
          </text>
        </g>
      )}

      {/* Arc drag handle - visible on hover for BGP and GRE links (with 1s delay before hiding), positioned at center of line */}
      {(link.type === 'bgp' || link.type === 'gre') && showArcHandle && onArcDrag && (() => {
        // Position handle at center of line
        const handleX = midX;
        const handleY = midY;
        // Cursor based on line orientation
        const cursor = isVertical ? 'ew-resize' : 'ns-resize';
        // Icon based on line orientation
        const icon = isVertical ? '↔' : '↕';

        return (
          <g>
            {/* Larger invisible hit area for easier grabbing */}
            <circle
              cx={handleX}
              cy={handleY}
              r="18"
              fill="transparent"
              style={{
                cursor,
                pointerEvents: 'all'
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsDraggingArc(true);
                dragStartRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  initialArc: offset
                };
                onArcDragStart?.(link.id);

                const handleMouseMove = (moveEvent: MouseEvent) => {
                  if (!dragStartRef.current) return;
                  // Calculate mouse movement along the perpendicular direction
                  const mouseDx = moveEvent.clientX - dragStartRef.current.x;
                  const mouseDy = moveEvent.clientY - dragStartRef.current.y;
                  // Project mouse movement onto perpendicular direction
                  // perpX, perpY point "left" of the line, so movement in that direction increases arc
                  const delta = mouseDx * perpX + mouseDy * perpY;
                  const newArc = dragStartRef.current.initialArc + delta;
                  onArcDrag(link.id, newArc);
                };

                const handleMouseUp = (upEvent: MouseEvent) => {
                  if (dragStartRef.current) {
                    const mouseDx = upEvent.clientX - dragStartRef.current.x;
                    const mouseDy = upEvent.clientY - dragStartRef.current.y;
                    const delta = mouseDx * perpX + mouseDy * perpY;
                    const finalArc = dragStartRef.current.initialArc + delta;
                    onArcDragEnd?.(link.id, finalArc);
                  }
                  setIsDraggingArc(false);
                  dragStartRef.current = null;
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            />
            {/* Visible drag handle */}
            <circle
              cx={handleX}
              cy={handleY}
              r="12"
              fill={isDraggingArc ? '#4CAF50' : (link.type === 'gre' ? '#FF9800' : '#FFC107')}
              stroke="white"
              strokeWidth="2"
              style={{
                cursor,
                pointerEvents: 'none',
                opacity: isDraggingArc ? 1 : 0.9
              }}
            />
            {/* Drag hint icon */}
            <text
              x={handleX}
              y={handleY + 5}
              fill="white"
              fontSize="14"
              fontWeight="bold"
              textAnchor="middle"
              style={{ pointerEvents: 'none' }}
            >
              {icon}
            </text>
          </g>
        );
      })()}
    </g>
  );
};
