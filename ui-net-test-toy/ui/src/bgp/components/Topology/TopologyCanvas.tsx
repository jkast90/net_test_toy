/**
 * Topology Canvas Component
 * Main canvas area for rendering topology nodes and links
 * Handles drag and drop internally
 */

import React, { forwardRef } from 'react';
import { DashboardPane } from '../../../_common/components';
import { TopologyNode as TopologyNodeComponent } from './TopologyNode';
import { TopologyLink as TopologyLinkComponent, calculateLinkMidpoint } from './TopologyLink';
import { TopologyNode, TopologyLink, InteractionMode, Position } from '../../types/topology';
import { useTopologyDragDrop } from '../../hooks/useTopologyDragDrop';

interface TopologyCanvasProps {
  // Canvas state
  nodes: TopologyNode[];
  links: TopologyLink[];
  selectedNode: string | null;
  hoveredNode: string | null;
  selectedLink: string | null;
  hoveredLink: string | null;
  interactionMode: InteractionMode;
  firstSelectedForLink: string | null;
  taps?: any[];  // List of taps from topology details
  children?: React.ReactNode;  // Allow rendering overlays inside canvas

  // Node operations (for drag and drop)
  addNode: (node: TopologyNode) => { success: boolean; error?: string };
  updateNodePosition: (nodeId: string, position: Position) => void;
  findNode: (nodeId: string) => TopologyNode | undefined;
  onNodeClickForConnection: (nodeId: string) => void;
  onNodeDragEnd?: (nodeId: string, position: Position) => void;

  // Node handlers
  onNodeMouseEnter: (nodeId: string) => void;
  onNodeMouseLeave: () => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onNodeDelete: (nodeId: string) => void;

  // Link handlers
  onLinkMouseEnter: (linkId: string) => void;
  onLinkMouseLeave: () => void;
  onLinkClick: (linkId: string) => void;
  onLinkDelete: (linkId: string) => void;

  // Arc drag handlers (for BGP links)
  onArcDragStart?: (linkId: string) => void;
  onArcDrag?: (linkId: string, newArc: number) => void;
  onArcDragEnd?: (linkId: string, finalArc: number) => void;
}

export const TopologyCanvas = forwardRef<HTMLDivElement, TopologyCanvasProps>(({
  nodes,
  links,
  selectedNode,
  hoveredNode,
  selectedLink,
  hoveredLink,
  interactionMode,
  firstSelectedForLink,
  taps = [],
  children,
  // Node operations for drag and drop
  addNode,
  updateNodePosition,
  findNode,
  onNodeClickForConnection,
  onNodeDragEnd,
  // Node handlers
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeDoubleClick,
  onNodeDelete,
  // Link handlers
  onLinkMouseEnter,
  onLinkMouseLeave,
  onLinkClick,
  onLinkDelete,
  // Arc drag handlers
  onArcDragStart,
  onArcDrag,
  onArcDragEnd
}, ref) => {
  // Use internal ref if none provided
  const internalRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = (ref as React.RefObject<HTMLDivElement>) || internalRef;

  // Drag and drop handled internally
  const {
    handleCanvasDragOver,
    handleCanvasDrop,
    handleNodeMouseDown,
    handleMouseMove,
    handleMouseUp
  } = useTopologyDragDrop({
    canvasRef,
    interactionMode,
    addNode,
    updateNodePosition,
    findNode,
    onNodeClickForConnection,
    onNodeDragEnd
  });
  // Helper function to get taps for a node
  const getTapsForNode = (nodeName: string): any[] => {
    if (!taps || taps.length === 0) return [];
    return taps.filter(tap => tap.target_container === nodeName || tap.container_name === nodeName);
  };

  // Calculate link offsets for links between the same nodes
  const getLinkOffset = (link: TopologyLink, index: number): number => {
    // For BGP or GRE links with custom arc value, use that instead of auto-calculation
    if ((link.type === 'bgp' || link.type === 'gre') && link.arc !== undefined && link.arc !== 0) {
      return link.arc;
    }

    // Find all links between the same two nodes (in either direction)
    const pairKey1 = `${link.source}-${link.target}`;
    const pairKey2 = `${link.target}-${link.source}`;

    const sameNodeLinks = links.filter(l => {
      const key1 = `${l.source}-${l.target}`;
      const key2 = `${l.target}-${l.source}`;
      return key1 === pairKey1 || key1 === pairKey2 || key2 === pairKey1 || key2 === pairKey2;
    });

    // BGP links need a much larger arc to be visually distinct and avoid network nodes
    const isBGPLink = link.type === 'bgp';
    const isGRELink = link.type === 'gre';

    // If this is a single BGP link with no custom arc, give it a prominent upward arc
    if (isBGPLink && sameNodeLinks.length <= 1) {
      return 150; // Large upward arc for BGP links to avoid network nodes in between
    }

    // If this is a single GRE link, give it a prominent downward arc
    if (isGRELink && sameNodeLinks.length <= 1) {
      return -150; // Large downward arc for GRE tunnels to avoid network nodes in between
    }

    if (sameNodeLinks.length <= 1) return 0;

    // Find this link's position in the group
    const linkIndex = sameNodeLinks.findIndex(l => l.id === link.id);
    const totalLinks = sameNodeLinks.length;

    // Calculate offset: center the group and spread links
    const spreadDistance = (isBGPLink || isGRELink) ? 200 : 60;
    const centerOffset = ((totalLinks - 1) * spreadDistance) / 2;
    const offset = linkIndex * spreadDistance - centerOffset;

    // Invert offset for GRE links to create downward arcs
    const finalOffset = isGRELink ? -offset : offset;
    return finalOffset;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      <DashboardPane
        title="Topology Canvas"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          width: '100%',
          height: 'auto'
        }}
        bodyStyle={{
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          minWidth: 0
        }}
      >
        <div
          ref={canvasRef}
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            width: '100%',
            flex: 1,
            minHeight: '600px',
            position: 'relative',
            background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
            borderRadius: '4px',
            overflow: 'hidden',
            cursor: interactionMode !== 'select' ? 'crosshair' : 'default'
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
              zIndex: 0
            }}
            onClick={() => onLinkClick('')}
          >
            {links.map((link, index) => (
              <TopologyLinkComponent
                key={link.id}
                link={link}
                sourceNode={nodes.find(n => n.id === link.source)}
                targetNode={nodes.find(n => n.id === link.target)}
                isHovered={hoveredLink === link.id}
                isSelected={selectedLink === link.id}
                offset={getLinkOffset(link, index)}
                onMouseEnter={onLinkMouseEnter}
                onMouseLeave={onLinkMouseLeave}
                onClick={onLinkClick}
                onDelete={onLinkDelete}
                onArcDragStart={onArcDragStart}
                onArcDrag={onArcDrag}
                onArcDragEnd={onArcDragEnd}
              />
            ))}
          </svg>

          {/* Render nodes */}
          {nodes.map(node => (
            <TopologyNodeComponent
              key={node.id}
              node={node}
              isSelected={selectedNode === node.id}
              isHovered={hoveredNode === node.id}
              isFirstSelected={firstSelectedForLink === node.id}
              interactionMode={interactionMode}
              onMouseDown={handleNodeMouseDown}
              onMouseEnter={onNodeMouseEnter}
              onMouseLeave={onNodeMouseLeave}
              onDoubleClick={onNodeDoubleClick}
              onDelete={onNodeDelete}
              taps={getTapsForNode(node.data?.name || node.label)}
            />
          ))}

          {/* Tooltip layer - renders on top of everything */}
          {(hoveredLink || selectedLink) && (() => {
            const activeLink = links.find(l => l.id === hoveredLink || l.id === selectedLink);
            if (!activeLink) return null;

            const sourceNode = nodes.find(n => n.id === activeLink.source);
            const targetNode = nodes.find(n => n.id === activeLink.target);
            if (!sourceNode || !targetNode) return null;

            const offset = getLinkOffset(activeLink, links.indexOf(activeLink));
            const { midX, midY } = calculateLinkMidpoint(sourceNode, targetNode, offset);

            return (
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 999,
                  pointerEvents: 'none'
                }}
              >
                <g>
                  <rect
                    x={midX - 80}
                    y={midY - 45}
                    width="160"
                    height="30"
                    fill="rgba(0,0,0,0.9)"
                    rx="4"
                  />
                  <text
                    x={midX}
                    y={midY - 32}
                    fill="white"
                    fontSize="11"
                    textAnchor="middle"
                  >
                    {sourceNode.label} ↔ {targetNode.label}
                  </text>
                  <text
                    x={midX}
                    y={midY - 20}
                    fill="#FFC107"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {activeLink.type === 'bgp' ? 'BGP Peering' :
                     activeLink.type === 'gre' ? 'GRE Tunnel' :
                     'Network Link'}
                  </text>
                </g>
              </svg>
            );
          })()}

          {/* Instructions when empty */}
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
                🎨 Build Your Network Topology
              </p>
              <p style={{ marginBottom: '0.5rem' }}>
                Drag daemons and hosts from the left panel onto this canvas
              </p>
              <p>
                Use the toolbar to create networks, links, and BGP peers
              </p>
            </div>
          )}

          {/* Overlay children (e.g., test output pane) */}
          {children}
        </div>
      </DashboardPane>
    </div>
  );
});

TopologyCanvas.displayName = 'TopologyCanvas';
