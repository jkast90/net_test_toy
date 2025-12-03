/**
 * Topology Fixed Controls
 * Floating action bar with topology controls
 */

import React from 'react';
import { Button, ButtonGroup, FixedControls, ActionsPopup } from '../../../_common/components';
import buttonCss from '../../../_common/styles/Button.module.css';

interface TopologyFixedControlsProps {
  // Topology selection
  topologies: any[];
  selectedTopologyName: string | null;
  onSelectTopology: (name: string) => void;
  onOpenCreateTopologyDialog: () => void;
  onOpenEditTopology: () => void;
  onDeployTopology: () => void;
  onStopTopology: () => void;

  // Node buttons
  onOpenCreateDaemon: () => void;
  onOpenCreateHost: () => void;
  onOpenNetworkDialog: () => void;
  onOpenExternalNodeDialog: () => void;
  onOpenExternalNetworkDialog: () => void;

  // Route buttons
  onOpenRouteAdvertisementDialog: () => void;
  onOpenTriggerDialog: () => void;

  // Connection buttons
  onChangeMode: (mode: 'add-link' | 'add-bgp-neighbor' | 'add-gre-tunnel' | 'add-tap' | 'quick-test') => void;
  onOpenGRETunnelDialog: () => void;

  // Export
  onExportJSON: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
}

export const TopologyFixedControls: React.FC<TopologyFixedControlsProps> = ({
  topologies,
  selectedTopologyName,
  onSelectTopology,
  onOpenCreateTopologyDialog,
  onOpenEditTopology,
  onDeployTopology,
  onStopTopology,

  onOpenCreateDaemon,
  onOpenCreateHost,
  onOpenNetworkDialog,
  onOpenExternalNodeDialog,
  onOpenExternalNetworkDialog,

  onOpenRouteAdvertisementDialog,
  onOpenTriggerDialog,

  onChangeMode,
  onOpenGRETunnelDialog,

  onExportJSON,
  onExportPNG,
  onExportSVG
}) => {
  // Build actions arrays
  const nodeActions = [
    {
      label: 'Daemon',
      icon: '+',
      onClick: onOpenCreateDaemon,
      variant: 'primary' as const
    },
    {
      label: 'Host',
      icon: '+',
      onClick: onOpenCreateHost,
      variant: 'primary' as const
    },
    {
      label: 'Network',
      icon: '+',
      onClick: onOpenNetworkDialog,
      variant: 'primary' as const
    },
    {
      label: 'External Node',
      icon: '+',
      onClick: onOpenExternalNodeDialog,
      variant: 'primary' as const
    },
    {
      label: 'External Network',
      icon: '+',
      onClick: onOpenExternalNetworkDialog,
      variant: 'primary' as const
    }
  ];

  const routeActions = [
    {
      label: 'Advertisement',
      icon: '+',
      onClick: onOpenRouteAdvertisementDialog,
      variant: 'primary' as const
    },
    {
      label: 'Trigger',
      icon: '+',
      onClick: onOpenTriggerDialog,
      variant: 'primary' as const
    }
  ];

  const connectionActions = [
    {
      label: 'Link',
      icon: '+',
      onClick: () => onChangeMode('add-link'),
      variant: 'primary' as const
    },
    {
      label: 'BGP Peer',
      icon: '+',
      onClick: () => onChangeMode('add-bgp-neighbor'),
      variant: 'primary' as const
    },
    {
      label: 'GRE Tunnel',
      icon: '+',
      onClick: onOpenGRETunnelDialog,
      variant: 'primary' as const
    },
    {
      label: 'Tap',
      icon: '+',
      onClick: () => onChangeMode('add-tap'),
      variant: 'primary' as const
    }
  ];

  const exportActions = [
    {
      label: 'JSON',
      icon: '📄',
      onClick: onExportJSON,
      variant: 'secondary' as const
    },
    {
      label: 'PNG',
      icon: '🖼️',
      onClick: onExportPNG,
      variant: 'secondary' as const
    }
  ];

  return (
    <FixedControls>
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        {/* Topology Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Topology:</span>
          <select
            value={selectedTopologyName || ''}
            onChange={(e) => {
              if (e.target.value === '__add_new__') {
                onOpenCreateTopologyDialog();
              } else if (e.target.value) {
                onSelectTopology(e.target.value);
              }
            }}
            style={{
              padding: '0.4rem 0.6rem',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--background-primary)',
              color: 'var(--text)',
              fontSize: '0.8rem',
              minWidth: '150px'
            }}
          >
            <option value="">Select topology...</option>
            {topologies.map((topo) => (
              <option key={topo.name} value={topo.name}>
                {topo.name}
              </option>
            ))}
            <option value="__add_new__">➕ Add New...</option>
          </select>
          {selectedTopologyName && (
            <>
              <Button
                onClick={onOpenEditTopology}
                className={buttonCss.buttonSecondary}
              >
                Edit
              </Button>
              <Button
                onClick={onDeployTopology}
                className={buttonCss.buttonPrimary}
              >
                Deploy
              </Button>
              <Button
                onClick={onStopTopology}
                className={buttonCss.buttonSecondary}
              >
                Stop
              </Button>
            </>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border)' }} />

        {/* Node Creation */}
        <ActionsPopup
          actions={nodeActions}
          buttonLabel="+ Node"
          buttonClassName={buttonCss.buttonPrimary}
        />

        {/* Route Creation */}
        <ActionsPopup
          actions={routeActions}
          buttonLabel="+ Route"
          buttonClassName={buttonCss.buttonPrimary}
        />

        {/* Connection Creation */}
        <ActionsPopup
          actions={connectionActions}
          buttonLabel="+ Connection"
          buttonClassName={buttonCss.buttonPrimary}
        />

        {/* Quick Test */}
        <Button
          onClick={() => onChangeMode('quick-test')}
          className={buttonCss.buttonPrimary}
        >
          Quick Test
        </Button>

        {/* Divider */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border)' }} />

        {/* Export */}
        <ActionsPopup
          actions={exportActions}
          buttonLabel="Export"
          buttonClassName={buttonCss.buttonSecondary}
        />
      </div>
    </FixedControls>
  );
};
