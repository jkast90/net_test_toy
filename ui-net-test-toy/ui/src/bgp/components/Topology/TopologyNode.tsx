/**
 * Topology Node Component
 * Renders a single node on the topology canvas
 */

import React from 'react';
import { TopologyNode as TopologyNodeType, InteractionMode } from '../../types/topology';
import { getNodeStyle } from '../../utils/topologyUtils';
import { useHoverDelete } from '../../hooks/useHoverDelete';

interface TapInfo {
  tap_name: string;
  target_container: string;
  target_interface: string;
  status: string;
}

interface TopologyNodeProps {
  node: TopologyNodeType;
  isSelected: boolean;
  isHovered: boolean;
  isFirstSelected: boolean;
  interactionMode: InteractionMode;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onMouseEnter: (nodeId: string) => void;
  onMouseLeave: () => void;
  onDoubleClick: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  taps?: TapInfo[];  // Taps configured on this node's interfaces
}

export const TopologyNode: React.FC<TopologyNodeProps> = ({
  node,
  isSelected,
  isHovered,
  isFirstSelected,
  interactionMode,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  onDoubleClick,
  onDelete,
  taps = []
}) => {
  const nodeStyle = getNodeStyle(node, {
    isSelected,
    isHovered,
    isFirstSelected,
    interactionMode
  });

  // Use hover delete hook
  const { showDeleteButton, deleteButtonProps } = useHoverDelete({
    isHovered,
    isSelected,
    enabled: interactionMode === 'select'
  });

  return (
    <div
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onMouseEnter={() => onMouseEnter(node.id)}
      onMouseLeave={onMouseLeave}
      onDoubleClick={() => onDoubleClick(node.id)}
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
          {node.type === 'daemon' ? '🔧' :
           node.type === 'host' ? '💻' :
           node.type === 'external_node' ? '🔌' :
           '🌐'}
        </div>
        <div>{node.label}</div>
        {node.asn !== undefined && node.asn !== null && node.asn !== 0 && (
          <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>AS{node.asn}</div>
        )}
      </div>

      {/* Tap indicator circles - shown on node edges where interfaces have taps */}
      {taps.length > 0 && taps.map((tap, index) => {
        // Position circles along the left edge of the node
        // Nodes are typically 100px wide x 70px tall, positioned from center
        // Distribute circles evenly along the left edge
        const totalTaps = taps.length;
        const spacing = 60 / (totalTaps + 1); // Distribute within 60px height
        const yOffset = spacing * (index + 1) - 30; // Center around 0
        // Handle both naming conventions from different API sources
        const interfaceName = (tap as any).interface_name || tap.target_interface || 'unknown';

        return (
          <div
            key={tap.tap_name}
            style={{
              position: 'absolute',
              left: '-6px',
              top: `calc(50% + ${yOffset}px)`,
              transform: 'translateY(-50%)',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#2196F3',
              border: '2px solid white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
              zIndex: 10
            }}
            title={`${interfaceName}-tap`}
          />
        );
      })}

      {/* Delete button - shown on hover or selection in select mode */}
      {showDeleteButton && (
        <button
          {...deleteButtonProps}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
          style={{
            position: 'absolute',
            top: '-10px',
            right: '-10px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#f44336',
            border: '2px solid white',
            color: 'white',
            fontSize: '14px',
            lineHeight: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ×
        </button>
      )}
    </div>
  );
};
