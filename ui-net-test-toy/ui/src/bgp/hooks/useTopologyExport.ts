/**
 * Topology Export Hook
 * Handles exporting topology to various formats (JSON, PNG, SVG)
 */

import { useCallback, useState, RefObject } from 'react';
import { flushSync } from 'react-dom';
import html2canvas from 'html2canvas';
import type { TopologyNode, TopologyLink, TopologyNetwork } from '../types/topology';

export interface UseTopologyExportOptions {
  canvasRef: RefObject<HTMLDivElement>;
  nodes: TopologyNode[];
  links: TopologyLink[];
  networks: TopologyNetwork[];
  topologyName: string | null;
}

export const useTopologyExport = (options: UseTopologyExportOptions) => {
  const { canvasRef, nodes, links, networks, topologyName } = options;

  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleExportJSON = useCallback(() => {
    const data = {
      nodes,
      links,
      networks
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topology-${topologyName || 'untitled'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportDialog(false);
  }, [nodes, links, networks, topologyName]);

  const handleExportPNG = useCallback(async () => {
    if (!canvasRef.current) return;

    try {
      flushSync(() => {});
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: '#1a1a1a',
        scale: 2,
        logging: false
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `topology-${topologyName || 'untitled'}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      });

      setShowExportDialog(false);
    } catch (error) {
      console.error('Failed to export PNG:', error);
      alert('Failed to export PNG');
    }
  }, [canvasRef, topologyName]);

  const handleExportSVG = useCallback(() => {
    alert('SVG export coming soon');
    setShowExportDialog(false);
  }, []);

  const openExportDialog = useCallback(() => {
    setShowExportDialog(true);
  }, []);

  const closeExportDialog = useCallback(() => {
    setShowExportDialog(false);
  }, []);

  return {
    showExportDialog,
    openExportDialog,
    closeExportDialog,
    handleExportJSON,
    handleExportPNG,
    handleExportSVG
  };
};
