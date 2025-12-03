/**
 * Topology Drag and Drop Hook
 * Handles dragging nodes from sidebar to canvas and within canvas
 */

import { useState, useCallback, RefObject } from 'react';
import { TopologyNode, Position, InteractionMode } from '../types/topology';
import { getDaemonColor } from '../utils/topologyUtils';

interface UseTopologyDragDropProps {
  canvasRef: RefObject<HTMLDivElement>;
  interactionMode: InteractionMode;
  addNode: (node: TopologyNode) => { success: boolean; error?: string };
  updateNodePosition: (nodeId: string, position: Position) => void;
  findNode: (nodeId: string) => TopologyNode | undefined;
  onNodeClickForConnection: (nodeId: string) => void;
  onNodeDragEnd?: (nodeId: string, position: Position) => void;
}

export const useTopologyDragDrop = ({
  canvasRef,
  interactionMode,
  addNode,
  updateNodePosition,
  findNode,
  onNodeClickForConnection,
  onNodeDragEnd
}: UseTopologyDragDropProps) => {
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [currentDragPosition, setCurrentDragPosition] = useState<Position | null>(null);

  // Handle dragging from sidebar to canvas
  const handleDragStart = useCallback((
    e: React.DragEvent,
    type: 'daemon' | 'host',
    data: any
  ) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('nodeType', type);
    e.dataTransfer.setData('nodeData', JSON.stringify(data));
  }, []);

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const nodeType = e.dataTransfer.getData('nodeType') as 'daemon' | 'host';
    const nodeData = JSON.parse(e.dataTransfer.getData('nodeData'));

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newNode: TopologyNode = {
      id: `${nodeType}-${Date.now()}-${Math.random()}`,
      type: nodeType,
      label: nodeType === 'daemon'
        ? `${nodeData.name} (${nodeData.daemon_type || 'unknown'})`
        : nodeData.name || 'Unknown Host',
      position: { x, y },
      data: nodeData,
      asn: nodeType === 'daemon' ? (parseInt(nodeData.asn) || 65001) : undefined,
      color: nodeType === 'daemon' ? getDaemonColor(nodeData.daemon_type) : '#9C27B0'
    };

    const result = addNode(newNode);
    if (!result.success && result.error) {
      alert(result.error);
    }
  }, [canvasRef, addNode]);

  // Handle dragging nodes within canvas
  const handleNodeMouseDown = useCallback((
    e: React.MouseEvent,
    nodeId: string
  ) => {
    if (interactionMode !== 'select') {
      onNodeClickForConnection(nodeId);
      return;
    }

    const node = findNode(nodeId);
    if (!node) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Prevent text selection during drag
    e.preventDefault();

    setDraggedNode(nodeId);
    setDragOffset({
      x: e.clientX - rect.left - node.position.x,
      y: e.clientY - rect.top - node.position.y
    });
  }, [interactionMode, canvasRef, findNode, onNodeClickForConnection]);

  // Canvas mouse move handler (for when mouse is over canvas)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggedNode) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Node dimensions for clamping (position is center point)
    // Nodes are rendered with left: x - 50, top: y - 30
    // Network nodes: 80x40, other nodes: 100x70
    const node = findNode(draggedNode);
    const isNetwork = node?.type === 'network';
    const halfWidth = isNetwork ? 40 : 50;
    const halfHeight = isNetwork ? 20 : 35;

    // Calculate raw position
    let x = e.clientX - rect.left - dragOffset.x;
    let y = e.clientY - rect.top - dragOffset.y;

    // Clamp to keep node fully within canvas bounds
    x = Math.max(halfWidth, Math.min(rect.width - halfWidth, x));
    y = Math.max(halfHeight, Math.min(rect.height - halfHeight, y));

    const position = { x, y };

    updateNodePosition(draggedNode, position);
    setCurrentDragPosition(position);
  }, [draggedNode, dragOffset, canvasRef, updateNodePosition, findNode]);

  // Mouse up handler to complete the drag
  const handleMouseUp = useCallback(() => {
    if (draggedNode && onNodeDragEnd) {
      // Use the tracked position from dragging if available (to avoid stale state from findNode),
      // otherwise fall back to findNode for the case where user clicked but didn't move
      const position = currentDragPosition || findNode(draggedNode)?.position;
      if (position) {
        onNodeDragEnd(draggedNode, position);
      }
    }
    setDraggedNode(null);
    setCurrentDragPosition(null);
  }, [draggedNode, currentDragPosition, findNode, onNodeDragEnd]);

  return {
    // State
    draggedNode,
    dragOffset,

    // Handlers for sidebar drag to canvas
    handleDragStart,
    handleCanvasDragOver,
    handleCanvasDrop,

    // Handlers for dragging within canvas
    handleNodeMouseDown,
    handleMouseMove,
    handleMouseUp
  };
};
