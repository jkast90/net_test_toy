import React, { useRef, useCallback } from 'react';
import type { TopologyNode, TopologyLink, Position } from '../types/topology';

interface TopologyCanvasProps {
  nodes: TopologyNode[];
  links: TopologyLink[];
  selectedNode?: string | null;
  hoveredNode?: string | null;
  draggedNode?: string | null;
  onNodeMouseDown?: (e: React.MouseEvent, nodeId: string) => void;
  onNodeMouseEnter?: (nodeId: string) => void;
  onNodeMouseLeave?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: () => void;
  width?: string;
  height?: string;
  interactive?: boolean;
  emptyMessage?: string;
}

const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  nodes,
  links,
  selectedNode,
  hoveredNode,
  draggedNode,
  onNodeMouseDown,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeDoubleClick,
  onMouseMove,
  onMouseUp,
  width = '100%',
  height = '600px',
  interactive = true,
  emptyMessage = 'This topology appears to be empty or has no configured resources.'
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);

  // Render a single node
  const renderNode = useCallback((node: TopologyNode) => {
    const isSelected = selectedNode === node.id;
    const isHovered = hoveredNode === node.id;

    const nodeStyle: React.CSSProperties = {
      position: 'absolute',
      left: node.position.x - 50,
      top: node.position.y - 30,
      width: node.type === 'network' ? '120px' : '100px',
      height: '60px',
      backgroundColor: node.color || (node.type === 'daemon' ? '#2196F3' : node.type === 'host' ? '#4CAF50' : '#9C27B0'),
      border: `3px solid ${
        isSelected ? '#FFC107' :
        isHovered ? 'rgba(255,255,255,0.8)' :
        'rgba(255,255,255,0.3)'
      }`,
      borderRadius: node.type === 'network' ? '4px' : node.type === 'daemon' ? '8px' : '50%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: interactive ? 'move' : 'default',
      userSelect: 'none',
      fontSize: '0.75rem',
      fontWeight: '600',
      color: 'white',
      boxShadow: isHovered || isSelected ? '0 6px 20px rgba(0,0,0,0.3)' : '0 3px 10px rgba(0,0,0,0.2)',
      transition: 'all 0.2s',
      zIndex: isSelected ? 10 : 1
    };

    return (
      <div
        key={node.id}
        onMouseDown={(e) => onNodeMouseDown?.(e, node.id)}
        onMouseEnter={() => onNodeMouseEnter?.(node.id)}
        onMouseLeave={() => onNodeMouseLeave?.(node.id)}
        onDoubleClick={() => onNodeDoubleClick?.(node.id)}
        style={nodeStyle}
      >
        <div style={{
          textAlign: 'center',
          padding: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%'
        }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
            {node.type === 'daemon' ? '🔧' : node.type === 'host' ? '💻' : '🌐'}
          </div>
          <div>{node.label}</div>
          {node.asn && <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>AS{node.asn}</div>}
        </div>
      </div>
    );
  }, [selectedNode, hoveredNode, interactive, onNodeMouseDown, onNodeMouseEnter, onNodeMouseLeave, onNodeDoubleClick]);

  // Render a single link
  const renderLink = useCallback((link: TopologyLink) => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);

    if (!sourceNode || !targetNode) return null;

    const x1 = sourceNode.position.x;
    const y1 = sourceNode.position.y;
    const x2 = targetNode.position.x;
    const y2 = targetNode.position.y;

    // Calculate midpoint for label
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    return (
      <g key={link.id}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={link.type === 'bgp' ? '#FFC107' : '#64B5F6'}
          strokeWidth={link.type === 'bgp' ? '3' : '2'}
          strokeDasharray={link.type === 'bgp' ? '8,4' : 'none'}
          opacity={0.8}
        />
        {link.label && (() => {
          const lines = link.label.split('\n');
          const lineHeight = 14;
          const startY = midY - ((lines.length - 1) * lineHeight) / 2;

          return (
            <text
              x={midX}
              y={startY}
              fill="white"
              fontSize="12"
              textAnchor="middle"
            >
              {lines.map((line, i) => (
                <tspan
                  key={i}
                  x={midX}
                  dy={i === 0 ? 0 : lineHeight}
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    padding: '2px 4px'
                  }}
                >
                  {line}
                </tspan>
              ))}
            </text>
          );
        })()}
      </g>
    );
  }, [nodes]);

  return (
    <div
      ref={canvasRef}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{
        width,
        height,
        position: 'relative',
        background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        borderRadius: '4px',
        overflow: 'hidden'
      }}
    >
      {/* Grid background */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Render links */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0
        }}
      >
        {links.map(link => renderLink(link))}
      </svg>

      {/* Render nodes */}
      {nodes.map(node => renderNode(node))}

      {/* Empty state */}
      {nodes.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '0.875rem',
          pointerEvents: 'none'
        }}>
          <p style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: '600' }}>
            🗺️ Topology Visualization
          </p>
          <p>{emptyMessage}</p>
        </div>
      )}
    </div>
  );
};

export default TopologyCanvas;
